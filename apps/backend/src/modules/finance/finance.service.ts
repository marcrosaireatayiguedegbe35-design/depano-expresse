import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InjectM } from '../../database.module';
import { AdminContext, dateRange } from '../../common/http';
import { BaseMode, DEFAULT_RATE_BPS, prorateAfterRefund } from '../../common/commission';
import { randomToken } from '../../common/crypto';

const PAID_STATUSES = ['succeeded', 'partially_refunded', 'refunded'];

@Injectable()
export class FinanceService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectM('Payment') private readonly payments: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('Payout') private readonly payouts: Model<any>,
    @InjectM('Refund') private readonly refunds: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('Dispute') private readonly disputes: Model<any>,
    @InjectM('SystemSetting') private readonly settings: Model<any>,
    @InjectM('CommissionRateHistory') private readonly rateHistory: Model<any>,
  ) {}

  /* ---------- Tableau de bord financier (CDC §10.9) ---------- */

  async summary(from?: unknown, to?: unknown, groupBy: 'day' | 'month' = 'day') {
    const range = dateRange(from, to);
    const cMatch = range ? { collectedAt: range } : {};
    const pMatch: Record<string, unknown> = { kind: 'intervention', status: { $in: PAID_STATUSES } };
    if (range) pMatch.paidAt = range;
    const invMatch: Record<string, unknown> = { status: { $in: ['approved', 'paid', 'partially_refunded', 'refunded'] } };
    if (range) invMatch.approvedAt = range;

    const group = (field: string) => ({ $group: { _id: null, v: { $sum: field }, n: { $sum: 1 } } });
    const one = async (model: Model<any>, match: object, field: string) => {
      const [r] = await model.aggregate([{ $match: match }, group(field)]);
      return { amount: r?.v ?? 0, count: r?.n ?? 0 };
    };
    const fmt = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const [
      generated, collected, paid, awaitingPayment, payoutsPaid, payoutsPending, payoutsFailed,
      refunds, openDisputes, byPeriod, byProfessional, byTrade, settings,
    ] = await Promise.all([
      one(this.invoices, invMatch, '$commissionAmount'),
      one(this.commissions, cMatch, '$amount'),
      one(this.payments, pMatch, '$amount'),
      one(this.invoices, { status: 'approved' }, '$total'),
      one(this.payouts, { status: 'paid', ...(range ? { paidAt: range } : {}) }, '$amount'),
      one(this.payouts, { status: { $in: ['pending', 'processing'] } }, '$amount'),
      one(this.payouts, { status: 'failed' }, '$amount'),
      one(this.refunds, { status: 'succeeded', ...(range ? { createdAt: range } : {}) }, '$amount'),
      this.disputes.countDocuments({ status: { $ne: 'resolved' } }),
      this.commissions.aggregate([
        { $match: cMatch },
        { $group: { _id: { $dateToString: { format: fmt, date: '$collectedAt' } }, revenue: { $sum: '$paymentAmount' }, commission: { $sum: '$amount' }, net: { $sum: '$professionalNet' } } },
        { $sort: { _id: 1 } },
      ]),
      this.commissions.aggregate([
        { $match: cMatch },
        { $group: { _id: '$professionalId', revenue: { $sum: '$paymentAmount' }, commission: { $sum: '$amount' }, net: { $sum: '$professionalNet' }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 20 },
        { $lookup: { from: 'professionals', localField: '_id', foreignField: '_id', as: 'pro' } },
        { $project: { revenue: 1, commission: 1, net: 1, count: 1, pro: { $arrayElemAt: ['$pro', 0] } } },
        { $project: { revenue: 1, commission: 1, net: 1, count: 1, 'pro.firstName': 1, 'pro.lastName': 1, 'pro.businessName': 1, 'pro.trade': 1 } },
      ]),
      this.commissions.aggregate([
        { $match: cMatch },
        { $group: { _id: '$trade', revenue: { $sum: '$paymentAmount' }, commission: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
      ]),
      this.getCommissionSettings(),
    ]);

    return {
      commissionsGenerated: generated,
      commissionsCollected: collected,
      interventionPayments: paid,
      awaitingPayment,
      payoutsPaid,
      payoutsPending,
      payoutsFailed,
      refunds,
      openDisputes,
      byPeriod,
      byProfessional,
      byTrade,
      settings,
    };
  }

  /* ---------- Paramètres de commission (CDC §16.5) ---------- */

  async getCommissionSettings(): Promise<{ rateBps: number; baseMode: BaseMode }> {
    const s = await this.settings.findOne({ key: 'commission' }).lean<any>();
    return s?.value ?? { rateBps: DEFAULT_RATE_BPS, baseMode: 'services_only' };
  }

  async setCommissionSettings(me: AdminContext, rateBps: number, baseMode: BaseMode, reason: string) {
    // Double contrôle : permission ET rôle super administrateur.
    if (me.role !== 'super_admin') throw new ForbiddenException('Réservé au super administrateur');
    const now = new Date();
    await this.settings.updateOne({ key: 'commission' }, { value: { rateBps, baseMode }, updatedBy: me.id }, { upsert: true });
    await this.rateHistory.create({ rateBps, baseMode, effectiveFrom: now, setBy: me.id, setByEmail: me.email, reason });
    // Les factures déjà validées conservent leur taux figé (commissionRateBps) : aucune rétroactivité.
    return { rateBps, baseMode, effectiveFrom: now };
  }

  rateHistoryList() {
    return this.rateHistory.find().sort({ effectiveFrom: -1 }).limit(50).lean();
  }

  /* ---------- Remboursements (CDC §10.8) ---------- */

  async refund(me: AdminContext, paymentId: Types.ObjectId, amount: number, reason: string, idempotencyKey: string) {
    const existing = await this.refunds.findOne({ idempotencyKey }).lean<any>();
    if (existing) {
      if (String(existing.paymentId) !== String(paymentId) || existing.amount !== amount) {
        throw new ConflictException('Clé d’idempotence déjà utilisée pour une autre opération');
      }
      return existing; // rejeu : aucune double opération
    }

    const session = await this.connection.startSession();
    let refundDoc: any;
    try {
      await session.withTransaction(async () => {
        const payment = await this.payments.findById(paymentId).session(session);
        if (!payment) throw new NotFoundException('Paiement introuvable');
        if (payment.kind !== 'intervention') throw new BadRequestException('Les remboursements marketplace sont gérés dans les commandes');
        if (!['succeeded', 'partially_refunded'].includes(payment.status)) throw new BadRequestException('Paiement non remboursable');
        const remaining = payment.amount - payment.refundedAmount;
        if (amount > remaining) throw new BadRequestException(`Montant maximum remboursable : ${remaining} FCFA`);

        const commission = await this.commissions.findOne({ paymentId }).session(session);
        if (!commission) throw new BadRequestException('Commission introuvable pour ce paiement');

        // Commission recalculée sur la base de la commission d'origine (avant ajustements).
        const originalCommission = commission.amount - commission.adjustments.reduce((s: number, a: any) => s + a.commissionDelta, 0);
        const newRefundedTotal = payment.refundedAmount + amount;
        const next = prorateAfterRefund(originalCommission, payment.amount, newRefundedTotal);
        const commissionDelta = next.commission - commission.amount;
        const netDelta = next.professionalNet - commission.professionalNet;

        // Si le professionnel a déjà été reversé, la régularisation sera imputée au prochain reversement.
        let needsSettlement = false;
        if (commission.payoutId) {
          const payout = await this.payouts.findById(commission.payoutId).session(session);
          needsSettlement = !!payout && payout.status !== 'cancelled';
        }

        [refundDoc] = await this.refunds.create(
          [{
            paymentId, professionalId: payment.professionalId, amount, reason, idempotencyKey,
            commissionDelta, professionalNetDelta: netDelta, needsSettlement, by: me.id, byEmail: me.email, status: 'succeeded',
          }],
          { session },
        );

        payment.refundedAmount = newRefundedTotal;
        payment.status = newRefundedTotal === payment.amount ? 'refunded' : 'partially_refunded';
        await payment.save({ session });

        commission.amount = next.commission;
        commission.professionalNet = next.professionalNet;
        commission.adjustments.push({ refundId: refundDoc._id, commissionDelta, netDelta, at: new Date() });
        await commission.save({ session });

        await this.invoices.updateOne({ _id: payment.invoiceId }, { status: payment.status === 'refunded' ? 'refunded' : 'partially_refunded' }, { session });
      });
    } finally {
      await session.endSession();
    }
    return refundDoc.toObject();
  }

  /* ---------- Reversements (CDC §10.7) ---------- */

  /** Solde disponible d'un professionnel : nets non reversés + régularisations négatives en attente. */
  async availableBalance(professionalId: Types.ObjectId) {
    const [commissions, refunds] = await Promise.all([
      this.commissions.find({ professionalId, payoutId: null }).select('professionalNet').lean(),
      this.refunds.find({ professionalId, needsSettlement: true, settledInPayoutId: null }).select('professionalNetDelta').lean(),
    ]);
    const fromCommissions = commissions.reduce((s: number, c: any) => s + c.professionalNet, 0);
    const adjustments = refunds.reduce((s: number, r: any) => s + r.professionalNetDelta, 0);
    return { commissions, refunds, fromCommissions, adjustments, available: fromCommissions + adjustments };
  }

  async createPayout(me: AdminContext, professionalId: Types.ObjectId, idempotencyKey: string) {
    const existing = await this.payouts.findOne({ idempotencyKey }).lean<any>();
    if (existing) {
      if (String(existing.professionalId) !== String(professionalId)) throw new ConflictException('Clé d’idempotence déjà utilisée');
      return existing;
    }
    const pro = await this.pros.findById(professionalId).lean<any>();
    if (!pro) throw new NotFoundException('Professionnel introuvable');
    if (!pro.payoutAccount?.msisdn) throw new BadRequestException('Aucun compte Mobile Money enregistré pour ce professionnel');

    const session = await this.connection.startSession();
    let payout: any;
    try {
      await session.withTransaction(async () => {
        const commissions = await this.commissions.find({ professionalId, payoutId: null }).session(session);
        const refunds = await this.refunds.find({ professionalId, needsSettlement: true, settledInPayoutId: null }).session(session);
        const amount =
          commissions.reduce((s: number, c: any) => s + c.professionalNet, 0) +
          refunds.reduce((s: number, r: any) => s + r.professionalNetDelta, 0);
        if (amount <= 0) throw new BadRequestException('Aucun solde disponible à reverser');

        [payout] = await this.payouts.create(
          [{
            reference: `RV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomToken(4).toUpperCase()}`,
            professionalId, amount, idempotencyKey,
            commissionIds: commissions.map((c: any) => c._id),
            refundIds: refunds.map((r: any) => r._id),
            beneficiary: pro.payoutAccount,
            status: 'pending',
            history: [{ status: 'pending', at: new Date(), by: me.email }],
          }],
          { session },
        );
        await this.commissions.updateMany({ _id: { $in: payout.commissionIds }, payoutId: null }, { payoutId: payout._id }, { session });
        await this.refunds.updateMany({ _id: { $in: payout.refundIds } }, { settledInPayoutId: payout._id }, { session });
      });
    } finally {
      await session.endSession();
    }
    return payout.toObject();
  }

  async updatePayout(me: AdminContext, id: Types.ObjectId, action: 'processing' | 'paid' | 'failed' | 'retry' | 'cancel', data: { providerRef?: string; reason?: string }) {
    const payout = await this.payouts.findById(id);
    if (!payout) throw new NotFoundException('Reversement introuvable');
    const allowed: Record<string, string[]> = {
      processing: ['pending'],
      paid: ['pending', 'processing'],
      failed: ['pending', 'processing'],
      retry: ['failed'],
      cancel: ['pending', 'failed'],
    };
    if (!allowed[action].includes(payout.status)) throw new BadRequestException(`Action « ${action} » impossible depuis le statut « ${payout.status} »`);

    if (action === 'paid') {
      if (!data.providerRef) throw new BadRequestException('Référence de transaction du prestataire obligatoire');
      payout.status = 'paid';
      payout.providerRef = data.providerRef;
      payout.paidAt = new Date();
    } else if (action === 'failed') {
      if (!data.reason) throw new BadRequestException("Motif d'échec obligatoire");
      payout.status = 'failed';
      payout.failureReason = data.reason;
    } else if (action === 'retry') {
      payout.status = 'pending';
      payout.attempts += 1;
    } else if (action === 'cancel') {
      // Libère les lignes pour un futur reversement.
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          await this.commissions.updateMany({ payoutId: payout._id }, { payoutId: null }, { session });
          await this.refunds.updateMany({ settledInPayoutId: payout._id }, { settledInPayoutId: null }, { session });
          payout.status = 'cancelled';
          payout.history.push({ status: 'cancelled', at: new Date(), by: me.email, note: data.reason });
          await payout.save({ session });
        });
      } finally {
        await session.endSession();
      }
      return payout.toObject();
    } else {
      payout.status = 'processing';
    }
    payout.history.push({ status: payout.status, at: new Date(), by: me.email, note: data.reason ?? data.providerRef });
    await payout.save();
    return payout.toObject();
  }
}
