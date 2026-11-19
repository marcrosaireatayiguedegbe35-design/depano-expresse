import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUrl, Length, Max, Min, ValidateNested,
} from 'class-validator';
import { Connection, Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { InjectM } from '../database.module';
import { oid, paginate } from '../common/http';
import { lineTotal, LINE_TYPES } from '../common/commission';
import { NotificationsService } from '../common/notifications.service';
import { ProContractService } from '../common/pro-contract.service';
import { DOC_KEYS, docType } from '../common/pro-requirements';
import { CurrentPro, ProContext, ProPublic } from './pro.guard';
import { CONFIRMABLE, TRACKING_STATUSES } from '../common/steps';
import { currentEngagement, engagePro } from '../common/pro-lock';
import { randomToken } from '../common/crypto';
import { IsUploadUrl } from '../common/upload-url';
import { ALLOWED_FORMATS } from '../common/upload-url';

class LineDto {
  @IsIn(LINE_TYPES as unknown as string[]) type: string;
  @IsString() @Length(2, 160) label: string;
  @IsInt() @Min(1) @Max(1000) quantity: number;
  @IsInt() @Min(0) @Max(50_000_000) unitPrice: number;
}
class RespondDto {
  @IsIn(['propose', 'decline', 'info']) action: 'propose' | 'decline' | 'info';
  @IsOptional() @IsString() @Length(0, 1000) message?: string;
  @IsOptional() @IsInt() @Min(0) @Max(50_000_000) estimatedPrice?: number;
  @IsOptional() @IsInt() @Min(5) @Max(2880) etaMinutes?: number;
}
class StatusDto {
  @IsIn(['en_route', 'on_site', 'in_progress', 'completed']) status: string;
  @IsOptional() @IsString() @Length(0, 300) note?: string;
}
class QuotationDto {
  @IsIn(['initial', 'supplement']) kind: string;
  @IsString() @Length(3, 2000) diagnosis: string;
  @IsString() @Length(3, 2000) plannedWork: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
  @IsOptional() @IsBoolean() emergencyAuthorized?: boolean;
}
class PhotosDto {
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsUploadUrl({ each: true }) before?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsUploadUrl({ each: true }) after?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsUploadUrl({ each: true }) replacedParts?: string[];
}
class InvoiceDto {
  @IsString() @Length(3, 2000) diagnosis: string;
  @IsString() @Length(3, 2000) workDone: string;
  @IsOptional() @IsString() @Length(0, 2000) observations?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
  @IsOptional() @ValidateNested() @Type(() => PhotosDto) photos?: PhotosDto;
  @IsOptional() @IsString() @Length(5, 1000) changeReason?: string;
}
class DocumentDto {
  @IsIn(DOC_KEYS) type: string;
  @IsOptional() @IsString() @Length(2, 120) label?: string;
  @IsUploadUrl() url: string;
  @IsOptional() @IsString() @Length(3, 40) number?: string;
  @IsOptional() @IsISO8601() expiresAt?: string;
  @IsOptional() @IsISO8601() issuedAt?: string;
}
class LocationDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) accuracy?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(360) heading?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) speed?: number;
}
class SignatureDto { @IsIn(['photos', 'documents', 'invoices']) folder: string; }

/** Enchaînement autorisé des étapes d'une intervention côté professionnel. */
const NEXT: Record<string, string[]> = {
  accepted: ['en_route', 'on_site'],
  en_route: ['on_site'],
  on_site: ['in_progress'],
  in_progress: ['completed'],
};
const STATUS_LABEL: Record<string, string> = {
  en_route: 'Le professionnel est en route', on_site: 'Le professionnel est arrivé', in_progress: 'Intervention en cours', completed: 'Intervention terminée',
};
const CLIENT_SAFE = 'firstName lastName phone';

/** Espace professionnels : demandes reçues, interventions, devis, factures, gains (CDC §6–§11). */
/** Distance à vol d'oiseau en km (1 décimale) entre deux positions [lng, lat]. */
function kmBetween(a?: number[], b?: number[]) {
  if (!a || !b) return undefined;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

@Controller()
export class ProWorkController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('ServiceRequest') private readonly requests: Model<any>,
    @InjectM('ServiceResponse') private readonly responses: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    @InjectM('Quotation') private readonly quotations: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
    @InjectM('Dispute') private readonly disputes: Model<any>,
    @InjectM('Payment') private readonly payments: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('Payout') private readonly payouts: Model<any>,
    @InjectM('Review') private readonly reviews: Model<any>,
    @InjectM('Notification') private readonly notifications: Model<any>,
    @InjectM('ProfessionalDocument') private readonly documents: Model<any>,
    @InjectM('ServiceCategory') private readonly categories: Model<any>,
    private readonly notify: NotificationsService,
    private readonly contract: ProContractService,
  ) {}

  /* ---------- Tableau de bord ---------- */

  @Get('dashboard')
  async dashboard(@CurrentPro() me: ProContext) {
    const pid = oid(me.id);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const [pending, active, done, monthAgg, totalAgg, waitingPayout, pro, unread] = await Promise.all([
      this.responses.countDocuments({ professionalId: pid, status: { $in: ['pending', 'info_requested'] } }),
      this.interventions.countDocuments({ professionalId: pid, status: { $in: ['accepted', 'en_route', 'on_site', 'in_progress', 'contested'] } }),
      this.interventions.countDocuments({ professionalId: pid, status: 'completed' }),
      this.commissions.aggregate([{ $match: { professionalId: pid, createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, net: { $sum: '$professionalNet' }, n: { $sum: 1 } } }]),
      this.commissions.aggregate([{ $match: { professionalId: pid } }, { $group: { _id: null, net: { $sum: '$professionalNet' } } }]),
      this.commissions.aggregate([{ $match: { professionalId: pid, payoutId: null, collection: { $ne: 'cash' } } }, { $group: { _id: null, net: { $sum: '$professionalNet' } } }]),
      this.pros.findById(pid).select('availability verificationStatus rating reviewsCount firstName businessName').lean<any>(),
      this.notifications.countDocuments({ recipientType: 'professional', recipientId: pid, readAt: null }),
    ]);
    const latestRequests = await this.myRequests(pid, ['pending', 'info_requested'], 3);
    const current = await this.interventions.find({ professionalId: pid, status: { $in: ['accepted', 'en_route', 'on_site', 'in_progress'] } })
      .sort({ updatedAt: -1 }).limit(3).select('reference problem address status trade createdAt').lean();
    const engaged = await currentEngagement(this.pros, this.interventions, pid);
    return {
      pro, unread, counts: { pending, active, done }, engaged,
      earnings: { month: monthAgg[0]?.net ?? 0, monthJobs: monthAgg[0]?.n ?? 0, total: totalAgg[0]?.net ?? 0, awaitingPayout: waitingPayout[0]?.net ?? 0 },
      latestRequests, current,
    };
  }

  /* ---------- Demandes reçues ---------- */

  private async myRequests(pid: Types.ObjectId, statuses: string[] | null, limit = 50) {
    const filter: Record<string, unknown> = { professionalId: pid };
    if (statuses) filter.status = { $in: statuses };
    const list = await this.responses.find(filter).sort({ createdAt: -1 }).limit(limit)
      .populate({ path: 'requestId', select: 'mode trade problem description vehicle address location area urgency preferredDate status createdAt photos' })
      .lean<any[]>();
    const me = await this.pros.findById(pid).select('location').lean<any>();
    return list.filter((r) => r.requestId).map((r) => ({ ...r, distanceKm: kmBetween(me?.location?.coordinates, r.requestId.location?.coordinates) }));
  }

  @Get('requests')
  async listRequests(@CurrentPro() me: ProContext, @Query('tab') tab?: string) {
    const statuses = tab === 'history' ? ['proposed', 'declined', 'selected', 'closed'] : ['pending', 'info_requested', 'proposed'];
    return this.myRequests(oid(me.id), statuses);
  }

  @Get('requests/:id')
  async getRequest(@CurrentPro() me: ProContext, @Param('id') id: string) {
    const response = await this.responses.findOne({ requestId: oid(id), professionalId: oid(me.id) }).lean<any>();
    if (!response) throw new NotFoundException('Demande introuvable');
    const request = await this.requests.findById(response.requestId).populate('clientId', 'firstName').lean<any>();
    if (!request) throw new NotFoundException('Demande introuvable');
    const others = request.mode === 'grouped' ? await this.responses.countDocuments({ requestId: request._id, status: 'proposed' }) : 0;
    const intervention = await this.interventions.findOne({ requestId: request._id, professionalId: oid(me.id) }).select('_id reference status').lean();
    // Le numéro du client n'est communiqué qu'au professionnel choisi.
    if (response.status !== 'selected') delete request.phone;
    const engaged = await currentEngagement(this.pros, this.interventions, me.id);
    const self = await this.pros.findById(me.id).select('location').lean<any>();
    return { request, response, competingProposals: others, intervention, engaged, distanceKm: kmBetween(self?.location?.coordinates, request.location?.coordinates) };
  }

  @Post('requests/:id/respond')
  @HttpCode(200)
  async respond(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: RespondDto) {
    if (me.verificationStatus !== 'validated') throw new ForbiddenException('Votre compte doit être validé pour répondre aux demandes.');
    if (!ProContractService.signed(await this.pros.findById(me.id).select('contract').lean())) throw new ForbiddenException('Signez votre contrat de partenariat pour répondre aux demandes.');
    const response = await this.responses.findOne({ requestId: oid(id), professionalId: oid(me.id) });
    if (!response) throw new NotFoundException('Demande introuvable');
    const request = await this.requests.findById(response.requestId);
    if (!request || ['cancelled', 'expired'].includes(request.status) || request.selectedProfessionalId) throw new BadRequestException('Cette demande est close');
    if (!['pending', 'info_requested', 'proposed'].includes(response.status)) throw new BadRequestException('Vous avez déjà répondu à cette demande');

    const now = new Date();
    if (dto.action === 'propose') {
      if (!dto.etaMinutes) throw new BadRequestException('Indiquez votre délai d’arrivée');
      const busy = await currentEngagement(this.pros, this.interventions, me.id);
      if (busy) throw new ConflictException(`Vous avez déjà une intervention en cours (${busy.reference}). Terminez-la avant de proposer vos services à un autre client.`);
      // Demande adressée à ce seul professionnel : son acceptation lance directement l'intervention.
      if (request.mode === 'individual' && (request.recipients?.length ?? 0) <= 1) return this.acceptDirect(me, request, response, dto);
      Object.assign(response, { status: 'proposed', message: dto.message, estimatedPrice: dto.estimatedPrice, etaMinutes: dto.etaMinutes, respondedAt: now });
      if (['sent', 'pending'].includes(request.status)) { request.status = 'response_received'; await request.save(); }
    } else if (dto.action === 'decline') {
      Object.assign(response, { status: 'declined', message: dto.message, respondedAt: now });
    } else {
      if (!dto.message || dto.message.length < 5) throw new BadRequestException('Précisez votre question au client');
      Object.assign(response, { status: 'info_requested', message: dto.message, respondedAt: now });
    }
    await response.save();
    const titles = { propose: 'Nouvelle proposition reçue', decline: 'Un professionnel a décliné votre demande', info: 'Un professionnel demande des précisions' };
    const types = { propose: 'request.proposed', decline: 'request.declined', info: 'request.info_requested' };
    await this.notify.notify({
      recipientType: 'client', recipientId: request.clientId, type: types[dto.action], title: titles[dto.action],
      body: dto.action === 'propose' ? `${me.name} · arrivée estimée ${dto.etaMinutes} min${dto.estimatedPrice ? ` · ~${dto.estimatedPrice} FCFA` : ''}` : (dto.message ?? me.name),
      link: `/compte/demande?id=${request._id}`,
    }, { actorType: 'professional', actorId: me.id, refType: 'request', refId: String(request._id), body: `${me.name} · ${request.problem}` });
    return { ok: true, status: response.status };
  }

  /** Acceptation d'une demande directe : le professionnel est engagé et l'intervention démarre aussitôt. */
  private async acceptDirect(me: ProContext, request: any, response: any, dto: RespondDto) {
    const session = await this.connection.startSession();
    let intervention: any;
    try {
      await session.withTransaction(async () => {
        const interventionId = new Types.ObjectId();
        if (!(await engagePro(this.pros, this.interventions, oid(me.id), interventionId, session))) {
          throw new ConflictException('Vous avez déjà une intervention en cours : terminez-la avant d’en accepter une autre.');
        }
        const now = new Date();
        const fresh = await this.requests.findOneAndUpdate(
          { _id: request._id, selectedProfessionalId: null, status: { $nin: ['cancelled', 'expired'] } },
          { selectedProfessionalId: oid(me.id), status: 'pro_selected' },
          { new: true, session },
        );
        if (!fresh) throw new ConflictException('Cette demande n’est plus disponible.');
        await this.responses.updateOne({ _id: response._id }, { status: 'selected', message: dto.message, estimatedPrice: dto.estimatedPrice, etaMinutes: dto.etaMinutes, respondedAt: now }, { session });
        [intervention] = await this.interventions.create([{
          _id: interventionId,
          reference: `INT-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${randomToken(3).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`,
          requestId: fresh._id, clientId: fresh.clientId, professionalId: oid(me.id), trade: fresh.trade,
          problem: fresh.problem, address: fresh.address, status: 'accepted', timeline: [{ status: 'accepted', at: now, by: 'professional', note: `Arrivée estimée ${dto.etaMinutes} min` }],
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    await this.notify.notify({
      recipientType: 'client', recipientId: request.clientId, type: 'request.selected',
      title: `${me.name} a accepté votre demande`, body: `Arrivée estimée ${dto.etaMinutes} min${dto.estimatedPrice ? ` · ~${dto.estimatedPrice} FCFA` : ''}`,
      link: `/compte/intervention?id=${intervention._id}`,
    }, { actorType: 'professional', actorId: me.id, refType: 'intervention', refId: String(intervention._id), body: `${intervention.reference} · ${request.problem} · accepté par ${me.name}` });
    return { ok: true, status: 'selected', interventionId: String(intervention._id) };
  }

  /* ---------- Interventions ---------- */

  private async own(me: ProContext, id: string) {
    const i = await this.interventions.findOne({ _id: oid(id), professionalId: oid(me.id) });
    if (!i) throw new NotFoundException('Intervention introuvable');
    return i;
  }

  @Get('interventions')
  listInterventions(@CurrentPro() me: ProContext, @Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = { professionalId: oid(me.id) };
    if (q.tab === 'active') filter.status = { $in: ['accepted', 'en_route', 'on_site', 'in_progress', 'contested'] };
    if (q.tab === 'done') filter.status = { $in: ['completed', 'cancelled'] };
    return paginate(this.interventions, filter, q, {
      sort: { updatedAt: -1 },
      populate: [{ path: 'clientId', select: 'firstName lastName' }, { path: 'requestId', select: 'area' }, { path: 'currentInvoiceId', select: 'number version total status professionalNet' }],
    });
  }

  @Get('interventions/:id')
  async getIntervention(@CurrentPro() me: ProContext, @Param('id') id: string) {
    const i = await this.interventions.findOne({ _id: oid(id), professionalId: oid(me.id) }).populate('clientId', CLIENT_SAFE).lean<any>();
    if (!i) throw new NotFoundException('Intervention introuvable');
    const [request, quotations, invoices, dispute, review, payment] = await Promise.all([
      i.requestId ? this.requests.findById(i.requestId).select('description vehicle location area urgency preferredDate photos phone mode').lean() : null,
      this.quotations.find({ interventionId: i._id }).sort({ createdAt: -1 }).lean(),
      this.invoices.find({ interventionId: i._id }).sort({ version: -1 }).lean(),
      this.disputes.findOne({ interventionId: i._id }).sort({ createdAt: -1 }).select('reason status resolution createdAt').lean(),
      this.reviews.findOne({ interventionId: i._id, hidden: { $ne: true } }).select('rating comment createdAt').lean(),
      this.payments.findOne({ interventionId: i._id, status: { $in: ['pending', 'succeeded', 'partially_refunded', 'refunded'] } }).sort({ createdAt: -1 }).select('amount method status paidAt').lean(),
    ]);
    return { intervention: i, request, quotations, invoices, dispute, review, payment, next: NEXT[i.status] ?? [] };
  }

  @Post('interventions/:id/status')
  @HttpCode(200)
  async setStatus(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: StatusDto) {
    const i = await this.own(me, id);
    if (i.awaitingConfirmation) {
      throw new BadRequestException(`En attente de la confirmation du client : « ${STATUS_LABEL[i.awaitingConfirmation] ?? i.awaitingConfirmation} ».`);
    }
    if (!(NEXT[i.status] ?? []).includes(dto.status)) throw new BadRequestException('Étape non autorisée à ce stade');
    if (dto.status === 'completed') {
      const inv = i.currentInvoiceId ? await this.invoices.findById(i.currentInvoiceId).select('status').lean<any>() : null;
      if (!inv) throw new BadRequestException('Soumettez d’abord la facture détaillée au client.');
    }
    const awaiting = CONFIRMABLE[dto.status] ? dto.status : null;
    const r = await this.interventions.updateOne(
      { _id: i._id, status: i.status, awaitingConfirmation: { $in: [null, undefined] } },
      { status: dto.status, awaitingConfirmation: awaiting, $push: { timeline: { status: dto.status, at: new Date(), note: dto.note, by: 'professional' } } },
    );
    if (!r.modifiedCount) throw new ConflictException('L’intervention a changé entre-temps, rechargez la page');
    await this.notify.notify({
      recipientType: 'client', recipientId: i.clientId, type: 'intervention.status',
      title: awaiting ? `${STATUS_LABEL[dto.status]} – confirmation demandée` : STATUS_LABEL[dto.status],
      body: awaiting ? CONFIRMABLE[dto.status].ask : i.reference, link: `/compte/intervention?id=${i._id}`,
    }, { actorType: 'professional', actorId: me.id, refType: 'intervention', refId: String(i._id), body: `${i.reference} · ${STATUS_LABEL[dto.status]}` });
    return { ok: true, status: dto.status, awaitingConfirmation: awaiting };
  }

  /** Position GPS du professionnel pendant le trajet (envoyée par le navigateur toutes les ~10 s). */
  @Post('interventions/:id/location')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async location(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: LocationDto) {
    const i = await this.interventions.findOne({ _id: oid(id), professionalId: oid(me.id) }).select('status awaitingConfirmation tracking').lean<any>();
    if (!i) throw new NotFoundException('Intervention introuvable');
    const sharing = i.status === 'accepted' || i.status === 'en_route' || (i.status === 'on_site' && i.awaitingConfirmation === 'on_site');
    if (!TRACKING_STATUSES.includes(i.status) || !sharing) return { ok: true, sharing: false };
    const at = new Date();
    const point = { lat: dto.lat, lng: dto.lng, at };
    await this.interventions.updateOne({ _id: i._id }, {
      tracking: { ...point, accuracy: dto.accuracy, heading: dto.heading, speed: dto.speed },
      $push: { trail: { $each: [point], $slice: -300 } },
    });
    return { ok: true, sharing: true };
  }

  @Post('interventions/:id/quotations')
  async createQuotation(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: QuotationDto) {
    const i = await this.own(me, id);
    if (['completed', 'cancelled'].includes(i.status)) throw new BadRequestException('Intervention close');
    if (await this.quotations.exists({ interventionId: i._id, status: 'pending' })) throw new ConflictException('Un devis attend déjà la décision du client');
    const lines = dto.lines.map((l) => ({ ...l, total: lineTotal(l as any) }));
    const q = await this.quotations.create({
      interventionId: i._id, professionalId: oid(me.id), kind: dto.kind, diagnosis: dto.diagnosis, plannedWork: dto.plannedWork,
      lines, total: lines.reduce((s, l) => s + l.total, 0), emergencyAuthorized: !!dto.emergencyAuthorized, status: 'pending',
    });
    await this.notify.notify({ recipientType: 'client', recipientId: i.clientId, type: 'quotation.submitted', title: 'Nouveau devis à valider', body: `${i.reference} · ${q.total} FCFA`, link: `/compte/intervention?id=${i._id}` },
      { actorType: 'professional', actorId: me.id, refType: 'quotation', refId: String(q._id), amount: q.total, body: `${i.reference} · devis ${q.total} FCFA` });
    return q;
  }

  /**
   * Facture détaillée soumise à la validation du client. Une nouvelle version n'est possible que si
   * l'administration l'a demandée après une contestation (la précédente passe en « superseded »).
   */
  @Post('interventions/:id/invoices')
  async createInvoice(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: InvoiceDto) {
    const i = await this.own(me, id);
    if (!['on_site', 'in_progress', 'completed', 'contested'].includes(i.status)) throw new BadRequestException('La facture se soumet une fois sur place.');
    const current = i.currentInvoiceId ? await this.invoices.findById(i.currentInvoiceId) : null;
    let version = 1;
    if (current) {
      // Facture contestée : le professionnel peut la corriger directement (le client la revalidera).
      if (current.status !== 'contested') throw new ConflictException('Une facture existe déjà pour cette intervention.');
      if (!dto.changeReason) throw new BadRequestException('Indiquez le motif de la nouvelle version.');
      version = (current.version ?? 1) + 1;
    }
    const lines = dto.lines.map((l) => ({ ...l, total: lineTotal(l as any) }));
    const total = lines.reduce((s, l) => s + l.total, 0);
    const now = new Date();
    const session = await this.connection.startSession();
    let inv: any;
    try {
      await session.withTransaction(async () => {
        if (current) {
          await this.invoices.updateOne({ _id: current._id, status: 'contested' }, { status: 'superseded' }, { session });
          await this.disputes.updateMany({ invoiceId: current._id, status: { $ne: 'resolved' } }, {
            status: 'resolved', resolution: { decision: 'request_new_version', note: `Facture corrigée par le professionnel : ${dto.changeReason ?? ''}`.trim(), byEmail: 'professionnel', at: new Date() },
          }, { session });
        }
        [inv] = await this.invoices.create([{
          number: `FAC-${i.reference.replace(/^INT-/, '')}`, version, previousVersionId: current?._id, changeReason: dto.changeReason,
          interventionId: i._id, professionalId: oid(me.id), clientId: i.clientId, problem: i.problem,
          diagnosis: dto.diagnosis, workDone: dto.workDone, observations: dto.observations, lines,
          photos: { before: dto.photos?.before ?? [], after: dto.photos?.after ?? [], replacedParts: dto.photos?.replacedParts ?? [] },
          total, status: 'submitted', submittedAt: now,
        }], { session });
        await this.interventions.updateOne({ _id: i._id }, {
          currentInvoiceId: inv._id, ...(i.status === 'contested' ? { status: 'in_progress' } : {}),
          $push: { timeline: { status: i.status === 'contested' ? 'in_progress' : i.status, at: now, note: `Facture ${inv.number} v${version} soumise` } },
        }, { session });
      });
    } finally {
      await session.endSession();
    }
    await this.notify.notify({ recipientType: 'client', recipientId: i.clientId, type: 'invoice.submitted', title: 'Facture à confirmer', body: `${inv.number} · ${total} FCFA`, link: `/compte/intervention?id=${i._id}` },
      { actorType: 'professional', actorId: me.id, refType: 'invoice', refId: String(inv._id), amount: total, body: `${inv.number} v${version} · ${total} FCFA` });
    return inv;
  }

  /** Le professionnel confirme avoir reçu le paiement en espèces annoncé par le client. */
  @Post('invoices/:id/cash-received')
  @HttpCode(200)
  async cashReceived(@CurrentPro() me: ProContext, @Param('id') id: string) {
    const inv = await this.invoices.findOne({ _id: oid(id), professionalId: oid(me.id) }).lean<any>();
    if (!inv) throw new NotFoundException('Facture introuvable');
    if (inv.status !== 'approved') throw new BadRequestException(inv.status === 'paid' ? 'Facture déjà payée' : 'Le client doit d’abord accepter la facture.');
    const pending = await this.payments.findOne({ invoiceId: inv._id, method: 'cash', status: 'pending' });
    if (!pending) throw new BadRequestException('Le client n’a pas encore choisi le paiement en espèces.');
    const intervention = await this.interventions.findById(inv.interventionId).lean<any>();
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const fresh = await this.invoices.findOneAndUpdate({ _id: inv._id, status: 'approved' }, { status: 'paid' }, { new: true, session });
        if (!fresh) throw new ConflictException('Facture déjà payée');
        const now = new Date();
        await this.payments.updateOne({ _id: pending._id }, { status: 'succeeded', paidAt: now }, { session });
        await this.commissions.create([{
          paymentId: pending._id, invoiceId: inv._id, professionalId: inv.professionalId, trade: intervention?.trade,
          paymentAmount: inv.total, base: fresh.commissionBase, rateBps: fresh.commissionRateBps,
          amount: fresh.commissionAmount, professionalNet: fresh.professionalNet, collectedAt: now, collection: 'cash',
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    await this.notify.notify([
      { recipientType: 'client', recipientId: inv.clientId, type: 'payment.confirmed', title: 'Paiement confirmé', body: `${inv.total} FCFA en espèces – ${inv.number}`, link: `/compte/intervention?id=${inv.interventionId}` },
    ], { actorType: 'professional', actorId: me.id, refType: 'payment', refId: String(pending._id), amount: inv.total, body: `${inv.number} – ${inv.total} FCFA en espèces` });
    return { ok: true };
  }

  /* ---------- Gains, avis, notifications, documents ---------- */

  @Get('earnings')
  async earnings(@CurrentPro() me: ProContext) {
    const pid = oid(me.id);
    const [commissions, payouts] = await Promise.all([
      this.commissions.find({ professionalId: pid }).sort({ createdAt: -1 }).limit(100)
        .populate({ path: 'invoiceId', select: 'number interventionId problem' }).lean<any[]>(),
      this.payouts.find({ professionalId: pid }).sort({ createdAt: -1 }).limit(50).select('reference amount status paidAt createdAt beneficiary').lean(),
    ]);
    const sum = (list: any[], k: string) => list.reduce((s, c) => s + (c[k] ?? 0), 0);
    return {
      totals: {
        gross: sum(commissions, 'paymentAmount'), commission: sum(commissions, 'amount'), net: sum(commissions, 'professionalNet'),
        awaitingPayout: sum(commissions.filter((c) => !c.payoutId && c.collection !== 'cash'), 'professionalNet'),
        cashCommissionDue: sum(commissions.filter((c) => c.collection === 'cash' && !c.commissionSettledAt), 'amount'),
        paidOut: sum((payouts as any[]).filter((p) => p.status === 'paid'), 'amount'),
      },
      commissions, payouts,
    };
  }

  @Get('reviews')
  async myReviews(@CurrentPro() me: ProContext) {
    const list = await this.reviews.find({ professionalId: oid(me.id), hidden: { $ne: true } }).sort({ createdAt: -1 }).limit(100)
      .populate('clientId', 'firstName').lean<any[]>();
    return list.map((r) => ({ _id: r._id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, author: r.clientId?.firstName ?? 'Client' }));
  }

  @Get('notifications')
  async listNotifications(@CurrentPro() me: ProContext, @Query() q: Record<string, unknown>) {
    const filter = { recipientType: 'professional', recipientId: oid(me.id) };
    const [page, unread] = await Promise.all([paginate(this.notifications, filter, q), this.notifications.countDocuments({ ...filter, readAt: null })]);
    return { ...page, unread };
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  async readAll(@CurrentPro() me: ProContext) {
    await this.notifications.updateMany({ recipientType: 'professional', recipientId: oid(me.id), readAt: null }, { readAt: new Date() });
    return { ok: true };
  }

  @Get('documents')
  listDocuments(@CurrentPro() me: ProContext) {
    return this.documents.find({ professionalId: oid(me.id) }).sort({ createdAt: -1 }).lean();
  }

  /** Pièces et étapes exigées (selon le métier et l'atelier déclaré), avec l'état de chacune. */
  @Get('documents/checklist')
  documentsChecklist(@CurrentPro() me: ProContext) {
    return this.contract.checklistFor(me.id);
  }

  @Post('documents')
  async addDocument(@CurrentPro() me: ProContext, @Body() dto: DocumentDto) {
    const t = docType(dto.type)!;
    if ((await this.documents.countDocuments({ professionalId: oid(me.id) })) >= 40) throw new BadRequestException('40 documents maximum : contactez l’assistance');
    if (t.number && !dto.number?.trim()) throw new BadRequestException(`Indiquez le ${t.number.toLowerCase()}.`);
    if (t.expiry) {
      if (!dto.expiresAt) throw new BadRequestException('Indiquez la date d’expiration du document.');
      if (new Date(dto.expiresAt) < new Date()) throw new BadRequestException('Ce document est expiré : déposez un document en cours de validité.');
    }
    if (t.issuedMaxDays) {
      if (!dto.issuedAt) throw new BadRequestException('Indiquez la date de délivrance du document.');
      const age = (Date.now() - +new Date(dto.issuedAt)) / 86400_000;
      if (age < -1) throw new BadRequestException('La date de délivrance ne peut pas être dans le futur.');
      if (age > t.issuedMaxDays) throw new BadRequestException('Ce document a plus de 3 mois : demandez un extrait récent.');
    }
    const d = await this.documents.create({
      type: dto.type, label: t.label, url: dto.url, number: dto.number?.trim().toUpperCase() || undefined,
      expiresAt: t.expiry ? dto.expiresAt : undefined, issuedAt: t.issuedMaxDays ? dto.issuedAt : undefined,
      professionalId: oid(me.id), status: 'pending',
    });
    if (me.verificationStatus === 'pending' || me.verificationStatus === 'rejected') {
      await this.pros.updateOne({ _id: me.id, verificationStatus: me.verificationStatus }, { verificationStatus: 'in_review' });
    }
    this.notify.emit('pro.document', `${me.name} – ${t.label}`, 1, { actorType: 'professional', actorId: me.id, refType: 'professional', refId: me.id });
    return d;
  }

  @Get('service-categories')
  @ProPublic()
  async serviceCategories() {
    const cats = await this.categories.find({ active: true }).sort({ order: 1 }).lean<any[]>();
    return cats.map((c) => ({ trade: c.trade, name: c.name, icon: c.icon, imageUrl: c.imageUrl || undefined, description: c.description, problems: c.problems.filter((p: any) => p.active).map((p: any) => ({ key: p.key, label: p.label, imageUrl: p.imageUrl || undefined })) }));
  }

  /** Signature d'envoi Cloudinary (photos de profil/chantier, documents) : le secret reste sur le serveur. */
  @Post('uploads/signature')
  @HttpCode(200)
  sign(@CurrentPro() me: ProContext, @Body() dto: SignatureDto) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME; const apiKey = process.env.CLOUDINARY_API_KEY; const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !secret) throw new ServiceUnavailableException('Envoi d’images indisponible');
    const params: Record<string, string> = { folder: `plateforme-auto/pros/${me.id}/${dto.folder}`, timestamp: String(Math.floor(Date.now() / 1000)), allowed_formats: ALLOWED_FORMATS };
    const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    return { ...params, signature: createHash('sha1').update(toSign + secret).digest('hex'), apiKey, uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` };
  }
}
