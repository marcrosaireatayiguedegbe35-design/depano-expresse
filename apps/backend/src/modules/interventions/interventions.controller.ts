import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { IsIn, IsString, Length } from 'class-validator';
import { Connection, Model } from 'mongoose';
import { InjectM } from '../../database.module';
import {
  AdminContext, Audit, CurrentAdmin, dateRange, escapeRegex, oid, oneOf, paginate, Perm, tradeKey,
} from '../../common/http';
import { INTERVENTION_STATUSES } from '../../models';

class DisputeNoteDto {
  @IsString() @Length(2, 2000) text: string;
}

class ResolveDisputeDto {
  /**
   * request_new_version : le professionnel doit soumettre une facture corrigée, que le client revalidera.
   * dismiss              : contestation non fondée ; la facture redevient « à valider » par le client.
   * cancel_intervention  : l'intervention et sa facture sont annulées.
   * L'administration ne valide jamais un montant à la place du client (CDC §9.6).
   */
  @IsIn(['request_new_version', 'dismiss', 'cancel_intervention']) decision: string;
  @IsString() @Length(5, 2000) note: string;
}

@Controller()
export class InterventionsController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    @InjectM('ServiceRequest') private readonly requests: Model<any>,
    @InjectM('Quotation') private readonly quotations: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
    @InjectM('ClientApproval') private readonly approvals: Model<any>,
    @InjectM('Payment') private readonly payments: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('Refund') private readonly refunds: Model<any>,
    @InjectM('Dispute') private readonly disputes: Model<any>,
  ) {}

  /* ---------- Demandes ---------- */

  @Get('service-requests')
  @Perm('interventions.read')
  listRequests(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    const status = oneOf(q.status, INTERVENTION_STATUSES);
    const mode = oneOf(q.mode, ['individual', 'grouped'] as const);
    const trade = tradeKey(q.trade);
    if (status) filter.status = status;
    if (mode) filter.mode = mode;
    if (trade) filter.trade = trade;
    return paginate(this.requests, filter, q, {
      populate: [
        { path: 'clientId', select: 'firstName lastName phone' },
        { path: 'selectedProfessionalId', select: 'firstName lastName businessName' },
      ],
    });
  }

  /* ---------- Interventions ---------- */

  @Get('interventions')
  @Perm('interventions.read')
  list(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    const status = oneOf(q.status, INTERVENTION_STATUSES);
    const trade = tradeKey(q.trade);
    if (status) filter.status = status;
    if (trade) filter.trade = trade;
    if (typeof q.q === 'string' && q.q.trim()) filter.reference = new RegExp(escapeRegex(q.q.trim()), 'i');
    const createdAt = dateRange(q.from, q.to);
    if (createdAt) filter.createdAt = createdAt;
    return paginate(this.interventions, filter, q, {
      populate: [
        { path: 'clientId', select: 'firstName lastName phone' },
        { path: 'professionalId', select: 'firstName lastName businessName trade' },
        { path: 'currentInvoiceId', select: 'number version total status' },
      ],
    });
  }

  @Get('interventions/:id')
  @Perm('interventions.read')
  async get(@Param('id') id: string) {
    const _id = oid(id);
    const intervention = await this.interventions
      .findById(_id)
      .populate('clientId', 'firstName lastName phone email')
      .populate('professionalId', 'firstName lastName businessName trade phone verificationStatus')
      .lean<any>();
    if (!intervention) throw new NotFoundException('Intervention introuvable');

    const [request, quotations, invoices, disputes, payments] = await Promise.all([
      intervention.requestId ? this.requests.findById(intervention.requestId).lean() : null,
      this.quotations.find({ interventionId: _id }).sort({ createdAt: 1 }).lean(),
      this.invoices.find({ interventionId: _id }).sort({ version: 1 }).lean(),
      this.disputes.find({ interventionId: _id }).sort({ createdAt: -1 }).lean(),
      this.payments.find({ interventionId: _id }).sort({ createdAt: 1 }).lean(),
    ]);
    const invoiceIds = invoices.map((i: any) => i._id);
    const paymentIds = payments.map((p: any) => p._id);
    const [approvals, commissions, refunds] = await Promise.all([
      this.approvals.find({ invoiceId: { $in: invoiceIds } }).sort({ createdAt: 1 }).lean(),
      this.commissions.find({ paymentId: { $in: paymentIds } }).lean(),
      this.refunds.find({ paymentId: { $in: paymentIds } }).sort({ createdAt: 1 }).lean(),
    ]);
    return { intervention, request, quotations, invoices, approvals, disputes, payments, commissions, refunds };
  }

  /* ---------- Litiges ---------- */

  @Get('disputes')
  @Perm('disputes.read')
  listDisputes(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    const status = oneOf(q.status, ['open', 'in_review', 'resolved'] as const);
    if (status) filter.status = status;
    return paginate(this.disputes, filter, q, {
      populate: [
        { path: 'clientId', select: 'firstName lastName phone' },
        { path: 'professionalId', select: 'firstName lastName businessName' },
        { path: 'invoiceId', select: 'number version total' },
        { path: 'interventionId', select: 'reference trade' },
      ],
    });
  }

  @Post('disputes/:id/notes')
  @Perm('disputes.resolve')
  @Audit('disputes.note')
  async addNote(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: DisputeNoteDto) {
    const d = await this.disputes.findById(oid(id));
    if (!d) throw new NotFoundException('Litige introuvable');
    if (d.status === 'resolved') throw new BadRequestException('Litige déjà clos');
    d.notes.push({ text: dto.text, by: me.id, byEmail: me.email, at: new Date() });
    if (d.status === 'open') d.status = 'in_review';
    await d.save();
    return { ok: true };
  }

  @Post('disputes/:id/resolve')
  @Perm('disputes.resolve')
  @Audit('disputes.resolve')
  async resolve(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const d = await this.disputes.findById(oid(id)).session(session);
        if (!d) throw new NotFoundException('Litige introuvable');
        if (d.status === 'resolved') throw new BadRequestException('Litige déjà clos');
        const invoice = await this.invoices.findById(d.invoiceId).session(session);
        const intervention = await this.interventions.findById(d.interventionId).session(session);
        if (!invoice || !intervention) throw new BadRequestException('Facture ou intervention introuvable');
        if (invoice.status !== 'contested') throw new BadRequestException("La facture n'est plus en contestation");

        const now = new Date();
        if (dto.decision === 'dismiss') {
          invoice.status = 'submitted'; // le client doit à nouveau confirmer ou contester
          intervention.status = 'completed';
        } else if (dto.decision === 'cancel_intervention') {
          invoice.status = 'cancelled';
          intervention.status = 'cancelled';
        }
        // request_new_version : la facture reste « contestée » (paiement bloqué) jusqu'à la nouvelle version.
        intervention.timeline.push({ status: intervention.status, at: now, note: `Litige : ${dto.decision}` });
        d.status = 'resolved';
        d.resolution = { decision: dto.decision, note: dto.note, by: me.id, byEmail: me.email, at: now };
        await Promise.all([invoice.save({ session }), intervention.save({ session }), d.save({ session })]);
      });
    } finally {
      await session.endSession();
    }
    return { ok: true };
  }
}
