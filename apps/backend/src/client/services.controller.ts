import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsLatitude, IsLongitude, IsMongoId, IsOptional, IsString,
  IsUrl, Length, Matches, Max, Min, ValidateNested,
} from 'class-validator';
import { Connection, Model, Types } from 'mongoose';
import { config } from '../config';
import { InjectM } from '../database.module';
import { IdempotencyKey, oid, paginate, Client, ClientInfo, tradeKey } from '../common/http';
import { computeCommission, DEFAULT_RATE_BPS, BaseMode } from '../common/commission';
import { randomToken } from '../common/crypto';
import { NotificationsService } from '../common/notifications.service';
import { ClientContext, ClientPublic, CurrentClient } from './client.guard';
import { CONFIRMABLE } from '../common/steps';
import { currentEngagement, engagePro, releasePro } from '../common/pro-lock';

/** Champs publics d'un professionnel (jamais les documents, le compte de reversement ni l'historique). */
const PUBLIC_PRO = 'firstName lastName businessName photoUrl coverUrl trade commune quartier description services zoneRadiusKm hours indicativeRates availability rating reviewsCount verificationStatus location createdAt';
/** Le numéro du professionnel n'est communiqué qu'au client qui l'a choisi (intervention en cours). */
const PRO_WITH_CONTACT = `${PUBLIC_PRO} phone`;

class VehicleInfoDto {
  @IsString() @Length(1, 40) brand: string;
  @IsString() @Length(1, 60) model: string;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) year?: number;
}

class CreateRequestDto {
  @IsIn(['individual', 'grouped']) mode: 'individual' | 'grouped';
  @IsString() @Matches(/^[a-z0-9_]{2,40}$/) trade: string;
  @IsString() @Length(2, 120) problem: string;
  @IsString() @Length(5, 2000) description: string;
  @ValidateNested() @Type(() => VehicleInfoDto) vehicle: VehicleInfoDto;
  @IsOptional() @IsMongoId() vehicleId?: string;
  @IsLatitude() lat: number;
  @IsLongitude() lng: number;
  @IsString() @Length(3, 300) address: string;
  @IsString() @Matches(/^\+229(01\d{8}|\d{8})$/, { message: 'Numéro au format +229 01XXXXXXXX' }) phone: string;
  @IsIn(['low', 'normal', 'high']) urgency: 'low' | 'normal' | 'high';
  @IsOptional() @IsDateString() preferredDate?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true }) photos?: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsMongoId({ each: true }) professionalIds: string[];
}

class StepDecisionDto {
  @IsIn(['on_site', 'in_progress', 'completed']) status: string;
  @IsIn(['confirm', 'reject']) decision: 'confirm' | 'reject';
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

class ContestDto {
  @IsString() @Length(10, 2000) reason: string;
}

class PayDto {
  @IsIn(['mobile_money', 'card', 'cash']) method: 'mobile_money' | 'card' | 'cash';
  @IsOptional() @IsString() @Matches(/^\+229(01\d{8}|\d{8})$/) phone?: string;
}

class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @Length(0, 1000) comment?: string;
}

const toRad = (d: number) => (d * Math.PI) / 180;
function haversineKm(a: [number, number], b: [number, number]) {
  const [lng1, lat1] = a; const [lng2, lat2] = b;
  const h = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

@Controller()
export class ClientServicesController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectM('ServiceCategory') private readonly categories: Model<any>,
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('Review') private readonly reviews: Model<any>,
    @InjectM('ServiceRequest') private readonly requests: Model<any>,
    @InjectM('ServiceResponse') private readonly responses: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    @InjectM('Quotation') private readonly quotations: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
    @InjectM('ClientApproval') private readonly approvals: Model<any>,
    @InjectM('Dispute') private readonly disputes: Model<any>,
    @InjectM('Payment') private readonly payments: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('SystemSetting') private readonly settings: Model<any>,
    private readonly notify: NotificationsService,
  ) {}

  /* ===================== Catalogue & recherche (public) ===================== */

  @Get('site-images')
  @ClientPublic()
  async siteImages() {
    const s = await this.settings.findOne({ key: 'siteImages' }).lean<any>();
    return s?.value ?? {};
  }

  @Get('service-categories')
  @ClientPublic()
  async listCategories() {
    const cats = await this.categories.find({ active: true }).sort({ order: 1 }).lean<any[]>();
    return cats.map((c) => ({ trade: c.trade, name: c.name, icon: c.icon, imageUrl: c.imageUrl || undefined, description: c.description, problems: c.problems.filter((p: any) => p.active).map((p: any) => ({ key: p.key, label: p.label, imageUrl: p.imageUrl || undefined })) }));
  }

  /**
   * Recherche géolocalisée (CDC §5.3–5.4) : métier, position, comptes validés uniquement,
   * disponibilité, distance, zone d'intervention, puis classement. Le rayon s'élargit
   * automatiquement (10 → 25 → 50 → 100 km) tant qu'il y a moins de 3 résultats.
   */
  @Get('professionals/search')
  @ClientPublic()
  async search(@Query() q: Record<string, unknown>) {
    const trade = tradeKey(q.trade);
    const lat = Number(q.lat), lng = Number(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new BadRequestException('Position (lat, lng) requise');
    }
    const includeUnavailable = q.includeUnavailable === 'true';
    const steps = [10, 25, 50, 100];
    let results: any[] = [];
    let radiusKm = steps[0];
    for (const r of steps) {
      radiusKm = r;
      const match: Record<string, unknown> = { verificationStatus: 'validated' };
      if (trade) match.trade = trade;
      if (!includeUnavailable) match.availability = { $ne: 'unavailable' };
      results = await this.pros.aggregate([
        { $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, distanceField: 'distanceM', maxDistance: r * 1000, query: match, spherical: true } },
        { $limit: 100 },
        // Champs publics uniquement (l'agrégation ignore les « select: false » du schéma).
        { $project: { ...Object.fromEntries(PUBLIC_PRO.split(' ').map((f) => [f, 1])), distanceM: 1 } },
      ]);
      // Zone d'intervention déclarée par le professionnel.
      results = results.filter((p) => !p.zoneRadiusKm || p.distanceM / 1000 <= p.zoneRadiusKm * 1.2);
      if (results.length >= 3) break;
    }

    const ranked = results
      .map((p) => {
        const km = p.distanceM / 1000;
        const proximity = Math.max(0, 1 - km / radiusKm);
        const availability = p.availability === 'available' ? 1 : p.availability === 'busy' ? 0.4 : 0;
        const confidence = Math.min(p.reviewsCount ?? 0, 10) / 10;
        const rating = ((p.rating || 3.5) / 5) * confidence + 0.7 * (1 - confidence);
        const score = 0.45 * proximity + 0.25 * availability + 0.25 * rating + 0.05;
        return { ...p, distanceKm: Math.round(km * 10) / 10, score: Math.round(score * 1000) / 1000, verified: true };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
    return { radiusKm, expanded: radiusKm > steps[0], items: ranked };
  }

  @Get('professionals/recommended')
  @ClientPublic()
  recommended() {
    return this.pros
      .find({ verificationStatus: 'validated', reviewsCount: { $gte: 1 } })
      .sort({ rating: -1, reviewsCount: -1 })
      .limit(8)
      .select(PUBLIC_PRO)
      .lean();
  }

  @Get('professionals/:id')
  @ClientPublic()
  async proProfile(@Param('id') id: string) {
    const pro = await this.pros.findOne({ _id: oid(id), verificationStatus: 'validated' }).select(PUBLIC_PRO).lean<any>();
    if (!pro) throw new NotFoundException('Professionnel introuvable');
    const reviews = await this.reviews
      .find({ professionalId: pro._id, hidden: false })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('clientId', 'firstName')
      .select('rating comment createdAt clientId')
      .lean<any[]>();
    // Interventions menées à leur terme sur la plateforme (fin confirmée par le client) : un gage de sérieux.
    const completedCount = await this.interventions.countDocuments({ professionalId: pro._id, status: 'completed' });
    // Seul le prénom de l'auteur est rendu public.
    return { professional: pro, completedCount, reviews: reviews.map((r) => ({ ...r, clientId: undefined, author: r.clientId?.firstName ?? 'Client' })) };
  }

  /* ===================== Demandes ===================== */

  @Post('requests')
  async createRequest(@CurrentClient() me: ClientContext, @Body() dto: CreateRequestDto) {
    if (!(await this.categories.exists({ trade: dto.trade, active: true }))) throw new BadRequestException('Service indisponible');
    const ids = [...new Set(dto.professionalIds)];
    if (dto.mode === 'individual' && ids.length !== 1) throw new BadRequestException('Une demande individuelle vise un seul professionnel');
    if (dto.mode === 'grouped' && ids.length < 2) throw new BadRequestException('Une demande groupée vise au moins 2 professionnels');
    const pros = await this.pros.find({ _id: { $in: ids.map((i) => oid(i)) }, verificationStatus: 'validated', trade: dto.trade }).select('_id').lean<any[]>();
    if (pros.length !== ids.length) throw new BadRequestException('Un ou plusieurs professionnels ne sont pas disponibles pour ce métier');

    const request = await this.requests.create({
      clientId: oid(me.id), mode: dto.mode, trade: dto.trade, problem: dto.problem, description: dto.description,
      vehicle: dto.vehicle, vehicleId: dto.vehicleId ? oid(dto.vehicleId) : undefined, address: dto.address,
      location: { type: 'Point', coordinates: [dto.lng, dto.lat] }, phone: dto.phone, urgency: dto.urgency,
      preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined, photos: dto.photos ?? [],
      recipients: pros.map((p) => p._id), status: 'sent',
    });
    await this.responses.insertMany(pros.map((p) => ({ requestId: request._id, professionalId: p._id, status: 'pending' })));
    await this.notify.notify(pros.map((p) => ({
      recipientType: 'professional' as const, recipientId: p._id, type: 'request.new',
      title: dto.urgency === 'high' ? 'Nouvelle demande URGENTE' : 'Nouvelle demande', body: `${dto.problem} – ${dto.address}`, link: `/demandes/${request._id}`,
    })), { actorType: 'client', actorId: me.id, refType: 'service_request', refId: String(request._id), body: `${dto.mode === 'grouped' ? `Groupée (${pros.length} pros)` : 'Individuelle'} · ${dto.problem} – ${dto.address}` });
    return request.toObject();
  }

  @Get('requests')
  listRequests(@CurrentClient() me: ClientContext, @Query() q: Record<string, unknown>) {
    return paginate(this.requests, { clientId: oid(me.id) }, q, { select: '-location' });
  }

  @Get('requests/:id')
  async getRequest(@CurrentClient() me: ClientContext, @Param('id') id: string) {
    const request = await this.requests.findOne({ _id: oid(id), clientId: oid(me.id) }).lean<any>();
    if (!request) throw new NotFoundException('Demande introuvable');
    const responses = await this.responses.find({ requestId: request._id }).populate('professionalId', PUBLIC_PRO).lean<any[]>();
    // Signale au client les professionnels déjà engagés chez un autre client (non sélectionnables pour l'instant).
    if (!request.selectedProfessionalId) {
      for (const r of responses) {
        const busyWith = r.professionalId?._id ? await currentEngagement(this.pros, this.interventions, r.professionalId._id) : null;
        r.proBusy = !!busyWith;
      }
    }
    const intervention = await this.interventions.findOne({ requestId: request._id }).select('_id reference status').lean();
    return { request, responses, intervention };
  }

  /** Le client conserve le choix final (CDC §8.2). */
  @Post('requests/:id/select/:responseId')
  @HttpCode(200)
  async select(@CurrentClient() me: ClientContext, @Param('id') id: string, @Param('responseId') responseId: string) {
    const session = await this.connection.startSession();
    let intervention: any;
    let others: any[] = [];
    try {
      await session.withTransaction(async () => {
        const request = await this.requests.findOne({ _id: oid(id), clientId: oid(me.id) }).session(session);
        if (!request) throw new NotFoundException('Demande introuvable');
        if (request.selectedProfessionalId) throw new ConflictException('Un professionnel a déjà été choisi');
        if (['cancelled', 'expired'].includes(request.status)) throw new BadRequestException('Demande close');
        const response = await this.responses.findOne({ _id: oid(responseId), requestId: request._id }).session(session);
        if (!response) throw new NotFoundException('Réponse introuvable');
        // Individuelle : le pro doit avoir accepté ; groupée : il doit avoir fait une proposition.
        if (response.status !== 'proposed') throw new BadRequestException("Ce professionnel n'a pas encore fait de proposition");

        // Un professionnel ne prend qu'un client à la fois : verrou atomique sur sa fiche.
        const interventionId = new Types.ObjectId();
        if (!(await engagePro(this.pros, this.interventions, response.professionalId, interventionId, session))) {
          throw new ConflictException('Ce professionnel vient d’être engagé sur une autre intervention. Choisissez une autre proposition ou attendez qu’il soit libre.');
        }

        request.selectedProfessionalId = response.professionalId;
        request.status = 'pro_selected';
        await request.save({ session });
        response.status = 'selected';
        await response.save({ session });
        others = await this.responses.find({ requestId: request._id, _id: { $ne: response._id } }).session(session).lean();
        await this.responses.updateMany({ requestId: request._id, _id: { $ne: response._id } }, { status: 'closed' }, { session });
        const now = new Date();
        [intervention] = await this.interventions.create([{
          _id: interventionId,
          reference: `INT-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${randomToken(3).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`,
          requestId: request._id, clientId: request.clientId, professionalId: response.professionalId, trade: request.trade,
          problem: request.problem, address: request.address, status: 'accepted', timeline: [{ status: 'accepted', at: now }],
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    await this.notify.notify([
      { recipientType: 'professional', recipientId: intervention.professionalId, type: 'request.selected', title: 'Vous avez été choisi', body: intervention.problem, link: `/interventions/${intervention._id}` },
      ...others.map((o) => ({ recipientType: 'professional' as const, recipientId: o.professionalId, type: 'request.closed', title: 'Demande clôturée', body: 'Le client a choisi un autre professionnel.' })),
    ], { actorType: 'client', actorId: me.id, refType: 'intervention', refId: String(intervention._id), body: `${intervention.reference} · ${intervention.problem}` });
    return { interventionId: intervention._id, reference: intervention.reference };
  }

  @Post('requests/:id/cancel')
  @HttpCode(200)
  async cancel(@CurrentClient() me: ClientContext, @Param('id') id: string) {
    const request = await this.requests.findOne({ _id: oid(id), clientId: oid(me.id) });
    if (!request) throw new NotFoundException('Demande introuvable');
    if (request.selectedProfessionalId) throw new BadRequestException("Un professionnel est déjà engagé : annulez depuis l'intervention");
    request.status = 'cancelled';
    await request.save();
    await this.responses.updateMany({ requestId: request._id }, { status: 'closed' });
    await this.notify.notify(request.recipients.map((p: Types.ObjectId) => ({ recipientType: 'professional' as const, recipientId: p, type: 'request.cancelled', title: 'Demande annulée par le client' })));
    return { ok: true };
  }

  /* ===================== Interventions, devis, factures ===================== */

  private async ownIntervention(me: ClientContext, id: string) {
    const i = await this.interventions.findOne({ _id: oid(id), clientId: oid(me.id) });
    if (!i) throw new NotFoundException('Intervention introuvable');
    return i;
  }

  @Get('interventions')
  listInterventions(@CurrentClient() me: ClientContext, @Query() q: Record<string, unknown>) {
    return paginate(this.interventions, { clientId: oid(me.id) }, q, {
      populate: [{ path: 'professionalId', select: 'firstName lastName businessName trade phone photoUrl' }, { path: 'currentInvoiceId', select: 'number version total status' }],
    });
  }

  @Get('interventions/:id')
  async getIntervention(@CurrentClient() me: ClientContext, @Param('id') id: string) {
    const i = await this.interventions.findOne({ _id: oid(id), clientId: oid(me.id) }).populate('professionalId', PRO_WITH_CONTACT).lean<any>();
    if (!i) throw new NotFoundException('Intervention introuvable');
    delete i.trail; // trajet complet réservé à l'administration
    // Le client voit ses factures, sans le détail de la commission (retenue sur la part du pro, CDC §10.6).
    const invoiceFields = '-commissionBase -excludedFromBase -commissionRateBps -commissionBaseMode -commissionAmount -professionalNet';
    const [quotations, invoices, payments, review, dispute] = await Promise.all([
      this.quotations.find({ interventionId: i._id }).sort({ createdAt: 1 }).lean(),
      this.invoices.find({ interventionId: i._id }).select(invoiceFields).sort({ version: 1 }).lean(),
      this.payments.find({ interventionId: i._id }).select('amount method provider status paidAt refundedAmount createdAt').lean(),
      this.reviews.findOne({ interventionId: i._id }).lean(),
      this.disputes.findOne({ interventionId: i._id }).sort({ createdAt: -1 }).select('reason status resolution.decision createdAt').lean(),
    ]);
    // Suivi : position de la demande et délai annoncé par le professionnel retenu.
    const request = i.requestId ? await this.requests.findById(i.requestId).select('location address vehicle urgency mode').lean() : null;
    const response = i.requestId ? await this.responses.findOne({ requestId: i.requestId, professionalId: i.professionalId?._id }).select('etaMinutes estimatedPrice message respondedAt').lean() : null;
    return { intervention: i, request, response, quotations, invoices, payments, review, dispute, paymentAvailable: config.paymentSimulation, cashAvailable: true };
  }

  /**
   * Le client confirme (ou conteste) l'étape déclarée par le professionnel : arrivée, début, fin des travaux.
   * Tant qu'il n'a pas répondu, le professionnel ne peut pas passer à l'étape suivante.
   */
  @Post('interventions/:id/step')
  @HttpCode(200)
  async decideStep(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: StepDecisionDto) {
    const i = await this.ownIntervention(me, id);
    if (i.awaitingConfirmation !== dto.status) throw new BadRequestException('Cette étape n’attend pas de confirmation (rechargez la page).');
    const rule = CONFIRMABLE[dto.status];
    if (dto.decision === 'reject' && (!dto.note || dto.note.trim().length < 3)) throw new BadRequestException('Expliquez en quelques mots ce qui ne va pas.');
    const now = new Date();
    const update = dto.decision === 'confirm'
      ? { awaitingConfirmation: null, $push: { confirmations: { status: dto.status, decision: 'confirmed', by: 'client', note: dto.note, at: now }, timeline: { status: dto.status, at: now, note: rule.confirmed, by: 'client' } } }
      : { status: rule.previous, awaitingConfirmation: null, $push: { confirmations: { status: dto.status, decision: 'rejected', by: 'client', note: dto.note, at: now }, timeline: { status: rule.previous, at: now, note: `Étape contestée par le client : ${dto.note}`, by: 'client' } } };
    const r = await this.interventions.updateOne({ _id: i._id, awaitingConfirmation: dto.status }, update);
    if (!r.modifiedCount) throw new ConflictException('L’intervention a changé entre-temps, rechargez la page');
    if (dto.decision === 'confirm' && dto.status === 'completed') await releasePro(this.pros, i.professionalId, i._id);
    await this.notify.notify({
      recipientType: 'professional', recipientId: i.professionalId,
      type: dto.decision === 'confirm' ? 'intervention.step_confirmed' : 'intervention.step_rejected',
      title: dto.decision === 'confirm' ? rule.confirmed : 'Le client conteste l’étape déclarée',
      body: dto.decision === 'confirm' ? i.reference : `${i.reference} – ${dto.note}`, link: `/interventions/${i._id}`,
    }, { actorType: 'client', actorId: me.id, refType: 'intervention', refId: String(i._id), body: `${i.reference} · ${dto.status} · ${dto.decision === 'confirm' ? 'confirmé' : `contesté : ${dto.note}`}` });
    return { ok: true };
  }

  @Post('quotations/:id/:decision')
  @HttpCode(200)
  async decideQuotation(@CurrentClient() me: ClientContext, @Param('id') id: string, @Param('decision') decision: string) {
    if (decision !== 'accept' && decision !== 'reject') throw new NotFoundException();
    const q = await this.quotations.findById(oid(id));
    if (!q) throw new NotFoundException('Devis introuvable');
    await this.ownIntervention(me, String(q.interventionId));
    if (q.status !== 'pending') throw new BadRequestException('Ce devis a déjà été traité');
    q.status = decision === 'accept' ? 'accepted' : 'rejected';
    q.decidedAt = new Date();
    await q.save();
    await this.notify.notify({ recipientType: 'professional', recipientId: q.professionalId, type: `quotation.${q.status}`, title: decision === 'accept' ? 'Devis accepté' : 'Devis refusé', link: `/interventions/${q.interventionId}` },
      { actorType: 'client', actorId: me.id, refType: 'quotation', refId: String(q._id), amount: q.total });
    return { ok: true, status: q.status };
  }

  private async currentInvoice(me: ClientContext, invoiceId: string) {
    const inv = await this.invoices.findById(oid(invoiceId));
    if (!inv || String(inv.clientId) !== me.id) throw new NotFoundException('Facture introuvable');
    return inv;
  }

  /** Confirmation du montant final par le client — et par lui seul (CDC §9.4, §9.6). */
  @Post('invoices/:id/confirm')
  @HttpCode(200)
  async confirm(@CurrentClient() me: ClientContext, @Param('id') id: string, @Client() client: ClientInfo) {
    const inv = await this.currentInvoice(me, id);
    if (inv.status !== 'submitted') throw new BadRequestException('Cette facture ne peut pas être confirmée');
    const s = await this.settings.findOne({ key: 'commission' }).lean<any>();
    const rateBps: number = s?.value?.rateBps ?? DEFAULT_RATE_BPS;
    const baseMode: BaseMode = s?.value?.baseMode ?? 'services_only';
    const calc = computeCommission(inv.lines.map((l: any) => ({ type: l.type, label: l.label, quantity: l.quantity, unitPrice: l.unitPrice })), rateBps, baseMode);
    if (calc.total !== inv.total) throw new ConflictException('Incohérence de montant : contactez le support');

    // Mise à jour conditionnelle : impossible de confirmer deux fois ou une version remplacée.
    const r = await this.invoices.updateOne(
      { _id: inv._id, status: 'submitted' },
      {
        status: 'approved', approvedAt: new Date(), commissionRateBps: rateBps, commissionBaseMode: baseMode,
        commissionBase: calc.commissionBase, excludedFromBase: calc.excludedFromBase, commissionAmount: calc.commission, professionalNet: calc.professionalNet,
      },
    );
    if (!r.modifiedCount) throw new ConflictException('La facture a changé entre-temps, rechargez la page');
    await this.approvals.create({ invoiceId: inv._id, clientId: oid(me.id), decision: 'confirmed', ip: client.ip });
    await this.notify.notify({ recipientType: 'professional', recipientId: inv.professionalId, type: 'invoice.confirmed', title: 'Montant confirmé par le client', body: `${inv.number} – ${inv.total} FCFA`, link: `/interventions/${inv.interventionId}` },
      { actorType: 'client', actorId: me.id, refType: 'invoice', refId: String(inv._id), amount: inv.total });
    return { ok: true };
  }

  @Post('invoices/:id/contest')
  @HttpCode(200)
  async contest(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: ContestDto, @Client() client: ClientInfo) {
    const inv = await this.currentInvoice(me, id);
    if (inv.status !== 'submitted') throw new BadRequestException('Cette facture ne peut pas être contestée');
    const r = await this.invoices.updateOne({ _id: inv._id, status: 'submitted' }, { status: 'contested' });
    if (!r.modifiedCount) throw new ConflictException('La facture a changé entre-temps, rechargez la page');
    await this.interventions.updateOne(
      { _id: inv.interventionId },
      { status: 'contested', $push: { timeline: { status: 'contested', at: new Date(), note: 'Facture contestée par le client' } } },
    );
    await this.approvals.create({ invoiceId: inv._id, clientId: oid(me.id), decision: 'contested', reason: dto.reason, ip: client.ip });
    await this.disputes.create({ interventionId: inv.interventionId, invoiceId: inv._id, clientId: oid(me.id), professionalId: inv.professionalId, reason: dto.reason, status: 'open' });
    await this.notify.notify({ recipientType: 'professional', recipientId: inv.professionalId, type: 'invoice.contested', title: 'Facture contestée', body: dto.reason.slice(0, 140), link: `/interventions/${inv.interventionId}` },
      { actorType: 'client', actorId: me.id, refType: 'invoice', refId: String(inv._id), amount: inv.total, body: `${inv.number} – ${dto.reason.slice(0, 120)}` });
    return { ok: true };
  }

  /**
   * Paiement : uniquement après confirmation du client (CDC §9.6, règle 16).
   * Tant qu'aucun prestataire Mobile Money n'est branché, un mode « simulation »
   * (développement uniquement) permet de tester le parcours complet.
   */
  @Post('invoices/:id/pay')
  @HttpCode(200)
  async pay(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: PayDto, @IdempotencyKey() key: string) {
    const existing = await this.payments.findOne({ idempotencyKey: key }).lean<any>();
    if (existing) {
      if (String(existing.invoiceId) !== id) throw new ConflictException('Clé d’idempotence déjà utilisée');
      return { payment: existing };
    }
    const inv = await this.currentInvoice(me, id);
    if (inv.status === 'submitted') throw new ForbiddenException('Confirmez d’abord le montant de la facture');
    if (inv.status === 'contested') throw new ForbiddenException('Paiement suspendu : facture contestée');
    if (inv.status === 'paid') throw new ConflictException('Facture déjà payée');
    if (inv.status !== 'approved') throw new BadRequestException('Cette facture ne peut pas être payée');
    if (dto.method === 'cash') {
      // Espèces : le client remet l'argent au professionnel, qui confirme la réception dans son espace.
      const pending = await this.payments.findOne({ invoiceId: inv._id, method: 'cash', status: 'pending' }).lean<any>();
      if (pending) return { payment: pending, awaitingCashConfirmation: true };
      const payment = await this.payments.create({
        kind: 'intervention', invoiceId: inv._id, interventionId: inv.interventionId, clientId: oid(me.id), professionalId: inv.professionalId,
        amount: inv.total, method: 'cash', provider: 'CASH', idempotencyKey: key, status: 'pending',
      });
      await this.notify.notify({ recipientType: 'professional', recipientId: inv.professionalId, type: 'payment.cash_declared', title: 'Paiement en espèces', body: `Le client va vous remettre ${inv.total} FCFA – confirmez la réception`, link: `/interventions/${inv.interventionId}` },
        { actorType: 'client', actorId: me.id, refType: 'payment', refId: String(payment._id), amount: inv.total, body: `${inv.number} – espèces annoncées` });
      return { payment: payment.toObject(), awaitingCashConfirmation: true };
    }
    if (!config.paymentSimulation) {
      throw new ServiceUnavailableException('Le paiement Mobile Money sera disponible très prochainement.');
    }

    const intervention = await this.interventions.findById(inv.interventionId).lean<any>();
    const session = await this.connection.startSession();
    let payment: any;
    try {
      await session.withTransaction(async () => {
        const fresh = await this.invoices.findOneAndUpdate({ _id: inv._id, status: 'approved' }, { status: 'paid' }, { new: true, session });
        if (!fresh) throw new ConflictException('Facture déjà payée');
        const now = new Date();
        [payment] = await this.payments.create([{
          kind: 'intervention', invoiceId: inv._id, interventionId: inv.interventionId, clientId: oid(me.id), professionalId: inv.professionalId,
          amount: inv.total, method: dto.method, provider: 'SIMULATION', providerRef: `SIM-${randomToken(6)}`, idempotencyKey: key,
          status: 'succeeded', paidAt: now,
        }], { session });
        // Commission calculée par le backend à partir du taux figé à la validation.
        await this.commissions.create([{
          paymentId: payment._id, invoiceId: inv._id, professionalId: inv.professionalId, trade: intervention?.trade,
          paymentAmount: inv.total, base: fresh.commissionBase, rateBps: fresh.commissionRateBps,
          amount: fresh.commissionAmount, professionalNet: fresh.professionalNet, collectedAt: now,
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    await this.notify.notify([
      { recipientType: 'client', recipientId: me.id, type: 'payment.confirmed', title: 'Paiement confirmé', body: `${inv.total} FCFA – ${inv.number}`, link: `/compte/interventions/${inv.interventionId}` },
      { recipientType: 'professional', recipientId: inv.professionalId, type: 'payment.confirmed', title: 'Paiement reçu', body: inv.number, link: `/gains` },
    ], { actorType: 'client', actorId: me.id, refType: 'payment', refId: String(payment._id), amount: inv.total, body: `${inv.number} – ${inv.total} FCFA` });
    return { payment: payment.toObject() };
  }

  /** Avis : uniquement pour une intervention réellement payée (règle 29). */
  @Post('interventions/:id/review')
  async review(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: ReviewDto) {
    const i = await this.ownIntervention(me, id);
    const paid = await this.payments.exists({ interventionId: i._id, status: { $in: ['succeeded', 'partially_refunded'] } });
    if (!paid) throw new ForbiddenException('Vous pourrez donner votre avis après le paiement de l’intervention');
    if (await this.reviews.exists({ interventionId: i._id })) throw new ConflictException('Vous avez déjà donné votre avis');
    await this.reviews.create({ interventionId: i._id, clientId: oid(me.id), professionalId: i.professionalId, rating: dto.rating, comment: dto.comment });
    const [agg] = await this.reviews.aggregate([
      { $match: { professionalId: i.professionalId, hidden: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]);
    await this.pros.updateOne({ _id: i.professionalId }, { rating: Math.round((agg?.avg ?? 0) * 10) / 10, reviewsCount: agg?.n ?? 0 });
    return { ok: true };
  }

  /** Distance indicative entre deux points (utilisée par le site pour l'affichage). */
  static distanceKm = haversineKm;
}
