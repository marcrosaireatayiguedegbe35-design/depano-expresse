import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { Audit, dateRange, escapeRegex, paginate, Perm, toCsv } from '../../common/http';
import { OPS_LABELS } from '../../common/notifications.service';

const ACTORS: Record<string, string> = { client: 'Client', professional: 'Professionnel', admin: 'Administrateur', system: 'Système' };

/** Journal des opérations de la plateforme : consultation et export (CDC §10.8, §16.7). */
@Controller('operations')
export class OperationsController {
  constructor(@InjectM('OperationLog') private readonly logs: Model<any>) {}

  private filter(q: Record<string, unknown>) {
    const f: Record<string, unknown> = {};
    if (typeof q.type === 'string' && /^[a-z_.]{2,60}$/.test(q.type)) f.type = q.type;
    if (typeof q.actorType === 'string' && ACTORS[q.actorType]) f.actorType = q.actorType;
    if (typeof q.q === 'string' && q.q.trim()) {
      const rx = new RegExp(escapeRegex(q.q.trim().slice(0, 100)), 'i');
      f.$or = [{ title: rx }, { body: rx }, { refId: rx }];
    }
    const at = dateRange(q.from, q.to);
    if (at) f.at = at;
    return f;
  }

  @Get('types')
  @Perm('operations.read')
  types() {
    return Object.entries(OPS_LABELS).map(([key, label]) => ({ key, label }));
  }

  @Get()
  @Perm('operations.read')
  async list(@Query() q: Record<string, unknown>) {
    const filter = this.filter(q);
    const [page, totals] = await Promise.all([
      paginate(this.logs, filter, q, { sort: { at: -1 } }),
      this.logs.aggregate([{ $match: filter }, { $group: { _id: '$type', count: { $sum: 1 }, amount: { $sum: { $ifNull: ['$amount', 0] } } } }, { $sort: { count: -1 } }]),
    ]);
    return { ...page, totals };
  }

  @Get('export')
  @Perm('operations.read')
  @Audit('operations.export')
  async export(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const rows: any[] = await this.logs.find(this.filter(q)).sort({ at: -1 }).limit(100_000).lean();
    const csv = toCsv(
      rows.map((r) => ({ ...r, actor: ACTORS[r.actorType] ?? r.actorType })),
      [
        { key: 'at', label: 'Date et heure' }, { key: 'title', label: 'Opération' }, { key: 'type', label: 'Code' },
        { key: 'body', label: 'Détail' }, { key: 'amount', label: 'Montant (FCFA)' }, { key: 'actor', label: 'Acteur' },
        { key: 'actorId', label: 'ID acteur' }, { key: 'refType', label: 'Objet' }, { key: 'refId', label: 'ID objet' },
      ],
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="journal-operations-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
