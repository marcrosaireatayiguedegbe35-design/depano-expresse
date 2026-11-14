import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { hmac, safeEqualHex } from '../../common/crypto';
import { dateRange, escapeRegex, paginate } from '../../common/http';

export interface AuditEntry {
  adminId?: string;
  adminEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  result: 'success' | 'failure';
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

const SENSITIVE = /password|code|token|secret|ticket/i;

/** Retire les champs sensibles avant écriture dans le journal. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      // Les clés « $… » (tentatives d'injection) sont neutralisées avant stockage.
      k.startsWith('$') ? `_${k.slice(1)}` : k,
      SENSITIVE.test(k) ? '[masqué]' : redact(v, depth + 1),
    ]),
  );
}

/**
 * Journal d'activité infalsifiable (CDC §16.7) :
 * - numéro de séquence atomique → toute suppression laisse un trou détectable ;
 * - sceau HMAC par entrée (clé serveur) → toute modification est détectable ;
 * - aucune route de modification ou de suppression n'est exposée.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(
    @InjectM('AuditLog') private readonly logs: Model<any>,
    @InjectM('Counter') private readonly counters: Model<any>,
  ) {}

  private static payload(e: Record<string, any>) {
    return JSON.stringify([
      e.seq, new Date(e.at).toISOString(), e.adminId ? String(e.adminId) : null, e.adminEmail ?? null,
      e.action, e.targetType ?? null, e.targetId ?? null, e.result, e.ip ?? null, e.details ?? null,
    ]);
  }

  async log(entry: AuditEntry): Promise<void> {
    try {
      const counter = await this.counters.findOneAndUpdate(
        { _id: 'audit_logs' }, { $inc: { seq: 1 } }, { upsert: true, new: true },
      );
      const doc: Record<string, any> = {
        ...entry,
        // Aller-retour JSON : forme stable après stockage, pour que le sceau reste vérifiable.
        details: entry.details ? JSON.parse(JSON.stringify(redact(entry.details)) ?? 'null') : undefined,
        seq: counter.seq,
        at: new Date(),
      };
      doc.hmac = hmac(AuditService.payload(doc));
      await this.logs.create(doc);
    } catch (err) {
      // Un échec de journalisation ne doit jamais passer inaperçu.
      this.logger.error(`Échec d'écriture du journal d'audit : ${(err as Error).message}`);
    }
  }

  private filterOf(query: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    if (typeof query.action === 'string' && query.action) filter.action = new RegExp('^' + escapeRegex(query.action), 'i');
    if (typeof query.admin === 'string' && query.admin) filter.adminEmail = new RegExp(escapeRegex(query.admin), 'i');
    if (query.result === 'success' || query.result === 'failure') filter.result = query.result;
    const at = dateRange(query.from, query.to);
    if (at) filter.at = at;
    return filter;
  }

  list(query: Record<string, unknown>) {
    return paginate(this.logs, this.filterOf(query), query, { sort: { seq: -1 } });
  }

  listAll(query: Record<string, unknown>) {
    return this.logs.find(this.filterOf(query)).sort({ seq: -1 }).limit(100_000).lean();
  }

  /** Vérifie l'intégrité complète du journal. */
  async verify() {
    const problems: { seq: number; issue: string }[] = [];
    let expected = 1;
    let checked = 0;
    const cursor = this.logs.find().sort({ seq: 1 }).lean().cursor();
    for await (const e of cursor as AsyncIterable<any>) {
      if (e.seq !== expected) problems.push({ seq: expected, issue: `Entrées manquantes ${expected} → ${e.seq - 1}` });
      if (!safeEqualHex(hmac(AuditService.payload(e)), e.hmac)) problems.push({ seq: e.seq, issue: 'Sceau invalide (entrée modifiée)' });
      expected = e.seq + 1;
      checked++;
    }
    const counter = await this.counters.findById('audit_logs').lean<any>();
    if (counter && counter.seq >= expected) problems.push({ seq: expected, issue: `Dernières entrées manquantes ${expected} → ${counter.seq}` });
    return { checked, intact: problems.length === 0, problems: problems.slice(0, 100) };
  }
}
