import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectM } from '../database.module';
import { DEFAULT_RATE_BPS } from './commission';
import { buildContract, CompanyInfo, CONTRACT_VERSION, contractText, DEFAULT_COMPANY, sha256 } from './contract';
import { contractPdf } from './contract-pdf';
import { NotificationsService } from './notifications.service';
import { checklist, docType } from './pro-requirements';

export const COMPANY_KEY = 'legal.company';
const PREVIEW_TTL_MS = 6 * 3600_000;
const EXPIRY_NOTICE_DAYS = 30;

/** Contrat de partenariat des professionnels et liste des pièces exigées. */
@Injectable()
export class ProContractService implements OnApplicationBootstrap {
  private readonly logger = new Logger('ProContract');

  constructor(
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('ProfessionalDocument') private readonly docs: Model<any>,
    @InjectM('ProContract') private readonly contracts: Model<any>,
    @InjectM('SystemSetting') private readonly settings: Model<any>,
    private readonly notify: NotificationsService,
  ) {}

  async company(): Promise<CompanyInfo> {
    const s = await this.settings.findOne({ key: COMPANY_KEY }).lean<any>();
    return { ...DEFAULT_COMPANY, ...(s?.value ?? {}) };
  }

  async setCompany(input: CompanyInfo & { stampUrl?: string }, adminId?: string) {
    // Champs vides ignorés : les valeurs par défaut (ville, qualité du représentant…) s'appliquent.
    const value = Object.fromEntries(Object.entries({ ...input }).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]));
    await this.settings.updateOne({ key: COMPANY_KEY }, { $set: { value, updatedBy: adminId } }, { upsert: true });
    return this.company();
  }

  private async commission(): Promise<{ rateBps: number; baseMode: string }> {
    const s = await this.settings.findOne({ key: 'commission' }).lean<any>();
    return s?.value ?? { rateBps: DEFAULT_RATE_BPS, baseMode: 'services_only' };
  }

  /** Le pro a signé la version en vigueur du contrat. */
  static signed(pro: any) {
    return pro?.contract?.version === CONTRACT_VERSION;
  }

  private place(pro: any) {
    const a = pro.area ?? {};
    const label = (v: string | undefined, word: string) => (v ? (new RegExp(word, 'i').test(v) ? v : `${word} ${v}`) : undefined);
    const parts = [a.quartier || pro.quartier, label(a.arrondissement, 'arrondissement'), a.commune || pro.commune, label(a.departement, 'département')];
    return [...new Set(parts.filter(Boolean))].join(', ') || 'République du Bénin';
  }

  private async build(pro: any, idKind: string, idNumber: string, date: Date) {
    const [company, com] = await Promise.all([this.company(), this.commission()]);
    const doc = buildContract({
      proId: String(pro._id), firstName: pro.firstName, lastName: pro.lastName, businessName: pro.businessName, trade: pro.trade,
      phone: pro.phone, email: pro.email, place: this.place(pro), idKind, idNumber: idNumber.trim().toUpperCase(),
      rateBps: com.rateBps, baseMode: com.baseMode, company, date,
    });
    const text = contractText(doc);
    return { doc, text, textHash: sha256(text), company, com };
  }

  /** Texte personnalisé à lire avant de signer (l'empreinte renvoyée doit être celle signée). */
  async preview(proId: string, idKind: string, idNumber: string) {
    const pro = await this.pros.findById(proId).lean<any>();
    if (!pro) throw new NotFoundException('Compte introuvable');
    const issuedAt = new Date();
    const { doc, textHash } = await this.build(pro, idKind, idNumber, issuedAt);
    return { doc, textHash, issuedAt, version: CONTRACT_VERSION };
  }

  async sign(proId: string, input: { idKind: string; idNumber: string; issuedAt: string; textHash: string; signature: string }, client: { ip: string; userAgent: string }) {
    const pro = await this.pros.findById(proId).lean<any>();
    if (!pro) throw new NotFoundException('Compte introuvable');
    const issuedAt = new Date(input.issuedAt);
    if (Number.isNaN(+issuedAt) || Math.abs(Date.now() - +issuedAt) > PREVIEW_TTL_MS) {
      throw new BadRequestException('Le contrat affiché a expiré : rechargez la page pour le relire avant de signer.');
    }
    const { doc, text, textHash, company, com } = await this.build(pro, input.idKind, input.idNumber, issuedAt);
    if (textHash !== input.textHash) {
      throw new BadRequestException('Le contrat a changé depuis son affichage : relisez la nouvelle version avant de signer.');
    }
    const signedAt = new Date();
    const signedName = `${pro.firstName} ${pro.lastName}`.trim();
    await this.contracts.updateMany({ professionalId: pro._id, supersededAt: null }, { supersededAt: signedAt });
    const c = await this.contracts.create({
      professionalId: pro._id, version: CONTRACT_VERSION, reference: doc.reference, doc, text, textHash,
      signatureDataUrl: input.signature, signedName, signedAt, ip: client.ip, userAgent: client.userAgent,
      idKind: input.idKind, idNumber: input.idNumber.trim().toUpperCase(), rateBps: com.rateBps, baseMode: com.baseMode, company,
    });
    await this.pros.updateOne({ _id: pro._id }, {
      identity: { kind: input.idKind, number: input.idNumber.trim().toUpperCase() },
      contract: { id: c._id, version: CONTRACT_VERSION, signedAt },
    });
    void this.notify.emit('pro.contract_signed', `${signedName} – ${doc.reference}`, 1, { actorType: 'professional', actorId: String(pro._id), refType: 'professional', refId: String(pro._id) });
    return this.summary(c);
  }

  summary(c: any) {
    return c ? { _id: c._id, version: c.version, reference: c.reference, textHash: c.textHash, signedAt: c.signedAt, signedName: c.signedName, current: c.version === CONTRACT_VERSION && !c.supersededAt } : null;
  }

  latest(proId: string | Types.ObjectId) {
    return this.contracts.findOne({ professionalId: new Types.ObjectId(String(proId)) }).sort({ signedAt: -1 }).lean<any>();
  }

  /** Contrat signé (texte + signature) pour l'affichage dans l'espace pro ou au back-office. */
  async signedDetail(proId: string) {
    const c = await this.latest(proId);
    if (!c) return null;
    return { ...this.summary(c), doc: c.doc, signatureDataUrl: c.signatureDataUrl, idKind: c.idKind, idNumber: c.idNumber, ip: c.ip, userAgent: c.userAgent };
  }

  async pdf(proId: string) {
    const c = await this.latest(proId);
    if (!c) throw new NotFoundException('Aucun contrat signé');
    const company = c.company ?? (await this.company());
    let stamp: Uint8Array | null = null;
    const stampUrl = (await this.company() as any).stampUrl as string | undefined;
    if (stampUrl?.startsWith('https://')) {
      try {
        const r = await fetch(stampUrl.replace('/upload/', '/upload/f_png/'), { signal: AbortSignal.timeout(8000) });
        if (r.ok) stamp = new Uint8Array(await r.arrayBuffer());
      } catch { /* cachet indisponible : PDF sans cachet */ }
    }
    const bytes = await contractPdf({
      doc: c.doc, textHash: c.textHash, signatureDataUrl: c.signatureDataUrl, signedName: c.signedName, signedAt: new Date(c.signedAt),
      ip: c.ip, userAgent: c.userAgent, idKind: c.idKind, idNumber: c.idNumber, contractId: String(c._id),
      companyStamp: stamp, companyName: company.name, companyRepresentative: company.representative,
    });
    return { bytes, filename: `contrat-${c.reference}.pdf` };
  }

  /** Liste de contrôle des pièces et étapes obligatoires d'un professionnel. */
  async checklistFor(proId: string | Types.ObjectId) {
    const id = new Types.ObjectId(String(proId));
    const [pro, docs] = await Promise.all([this.pros.findById(id).lean<any>(), this.docs.find({ professionalId: id }).lean<any[]>()]);
    if (!pro) throw new NotFoundException('Professionnel introuvable');
    return { ...checklist(pro, docs, ProContractService.signed(pro)), contractVersion: CONTRACT_VERSION };
  }

  /** Au démarrage puis toutes les 12 h : prévient les pros dont une pièce expire dans les 30 jours. */
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.remindExpiring().catch((e) => this.logger.warn(`Rappels d’expiration interrompus : ${(e as Error).message}`));
    setTimeout(run, 60_000);
    setInterval(run, 12 * 3600_000).unref();
  }

  async remindExpiring(now = new Date()) {
    const limit = new Date(+now + EXPIRY_NOTICE_DAYS * 86400_000);
    const soon = await this.docs.find({ expiresAt: { $ne: null, $lte: limit }, expiryNotifiedAt: null, status: { $ne: 'rejected' } }).limit(500).lean<any[]>();
    for (const d of soon) {
      const expired = new Date(d.expiresAt) < now;
      const label = docType(d.type)?.label ?? d.label;
      const when = new Date(d.expiresAt).toLocaleDateString('fr-FR', { timeZone: 'Africa/Porto-Novo' });
      await this.notify.notify({
        recipientType: 'professional', recipientId: d.professionalId, type: 'pro.document_expiring',
        title: expired ? `${label} expiré(e)` : `${label} : expire le ${when}`,
        body: 'Déposez la nouvelle version dans « Documents » pour continuer à recevoir des demandes.', link: '/profil/documents',
      }, { refType: 'professional', refId: String(d.professionalId) });
      await this.docs.updateOne({ _id: d._id }, { expiryNotifiedAt: now });
    }
    return soon.length;
  }
}
