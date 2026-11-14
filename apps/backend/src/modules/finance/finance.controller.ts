import { Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import {
  AdminContext, Audit, CurrentAdmin, dateRange, IdempotencyKey, oid, oneOf, paginate, Perm, toCsv,
} from '../../common/http';
import { BASE_MODES, BaseMode, bpsToPercent, percentToBps } from '../../common/commission';
import { FinanceService } from './finance.service';

class RefundDto {
  @IsMongoId() paymentId: string;
  @IsInt() @Min(1) amount: number;
  @IsString() @Length(5, 1000) reason: string;
}

class PayoutDto {
  @IsMongoId() professionalId: string;
}

class PayoutActionDto {
  @IsIn(['processing', 'paid', 'failed', 'retry', 'cancel']) action: 'processing' | 'paid' | 'failed' | 'retry' | 'cancel';
  @IsOptional() @IsString() @Length(2, 200) providerRef?: string;
  @IsOptional() @IsString() @Length(2, 500) reason?: string;
}

class CommissionSettingsDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(50) ratePercent: number;
  @IsIn(BASE_MODES) baseMode: BaseMode;
  @IsString() @Length(5, 500) reason: string;
}

const pop = {
  pro: { path: 'professionalId', select: 'firstName lastName businessName trade' },
  client: { path: 'clientId', select: 'firstName lastName phone' },
};

@Controller()
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    @InjectM('Payment') private readonly payments: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('Payout') private readonly payouts: Model<any>,
    @InjectM('Refund') private readonly refunds: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
  ) {}

  @Get('finance/summary')
  @Perm('finance.read')
  summary(@Query() q: Record<string, unknown>) {
    return this.finance.summary(q.from, q.to, q.groupBy === 'month' ? 'month' : 'day');
  }

  @Get('finance/invoices')
  @Perm('finance.read')
  listInvoices(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    const status = oneOf(q.status, ['submitted', 'approved', 'contested', 'superseded', 'paid', 'partially_refunded', 'refunded', 'cancelled'] as const);
    if (status) filter.status = status;
    return paginate(this.invoices, filter, q, { select: '-photos', populate: [pop.pro, pop.client] });
  }

  @Get('finance/payments')
  @Perm('finance.read')
  listPayments(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    const status = oneOf(q.status, ['pending', 'succeeded', 'failed', 'partially_refunded', 'refunded'] as const);
    const kind = oneOf(q.kind, ['intervention', 'order'] as const);
    if (status) filter.status = status;
    if (kind) filter.kind = kind;
    const createdAt = dateRange(q.from, q.to);
    if (createdAt) filter.createdAt = createdAt;
    return paginate(this.payments, filter, q, { populate: [pop.pro, pop.client] });
  }

  @Get('finance/commissions')
  @Perm('finance.read')
  listCommissions(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    if (typeof q.professionalId === 'string' && q.professionalId) filter.professionalId = oid(q.professionalId);
    const collectedAt = dateRange(q.from, q.to);
    if (collectedAt) filter.collectedAt = collectedAt;
    return paginate(this.commissions, filter, q, { sort: { collectedAt: -1 }, populate: [pop.pro] });
  }

  @Get('finance/payouts')
  @Perm('finance.read')
  listPayouts(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    const status = oneOf(q.status, ['pending', 'processing', 'paid', 'failed', 'cancelled'] as const);
    if (status) filter.status = status;
    return paginate(this.payouts, filter, q, { populate: [pop.pro] });
  }

  @Get('finance/balances/:professionalId')
  @Perm('finance.read')
  balance(@Param('professionalId') id: string) {
    return this.finance.availableBalance(oid(id)).then(({ fromCommissions, adjustments, available, commissions }) => ({
      fromCommissions, adjustments, available, commissionsCount: commissions.length,
    }));
  }

  @Post('finance/payouts')
  @Perm('finance.payout')
  @Audit('finance.payout_create')
  createPayout(@CurrentAdmin() me: AdminContext, @Body() dto: PayoutDto, @IdempotencyKey() key: string) {
    return this.finance.createPayout(me, oid(dto.professionalId), key);
  }

  @Post('finance/payouts/:id/action')
  @Perm('finance.payout')
  @Audit('finance.payout_update')
  payoutAction(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: PayoutActionDto) {
    return this.finance.updatePayout(me, oid(id), dto.action, dto);
  }

  @Get('finance/refunds')
  @Perm('finance.read')
  listRefunds(@Query() q: Record<string, unknown>) {
    return paginate(this.refunds, {}, q, { populate: [pop.pro] });
  }

  @Post('finance/refunds')
  @Perm('finance.refund')
  @Audit('finance.refund')
  refund(@CurrentAdmin() me: AdminContext, @Body() dto: RefundDto, @IdempotencyKey() key: string) {
    return this.finance.refund(me, oid(dto.paymentId), dto.amount, dto.reason, key);
  }

  @Get('finance/export')
  @Perm('finance.export')
  @Audit('finance.export')
  async export(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const type = oneOf(q.type, ['payments', 'commissions', 'payouts', 'refunds'] as const) ?? 'payments';
    const range = dateRange(q.from, q.to);
    const filter = range ? { createdAt: range } : {};
    const model = { payments: this.payments, commissions: this.commissions, payouts: this.payouts, refunds: this.refunds }[type];
    const rows: any[] = await model.find(filter).sort({ createdAt: -1 }).limit(50_000).populate(pop.pro).lean();
    const proName = (p: any) => (p ? p.businessName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '');
    const flat = rows.map((r) => ({ ...r, id: String(r._id), professional: proName(r.professionalId), rate: r.rateBps ? bpsToPercent(r.rateBps) : '' }));
    const columns = {
      payments: [
        { key: 'id', label: 'ID' }, { key: 'createdAt', label: 'Date' }, { key: 'kind', label: 'Type' },
        { key: 'professional', label: 'Professionnel' }, { key: 'amount', label: 'Montant (FCFA)' },
        { key: 'refundedAmount', label: 'Remboursé (FCFA)' }, { key: 'method', label: 'Moyen' },
        { key: 'provider', label: 'Prestataire' }, { key: 'providerRef', label: 'Réf. prestataire' }, { key: 'status', label: 'Statut' },
      ],
      commissions: [
        { key: 'id', label: 'ID' }, { key: 'collectedAt', label: 'Date' }, { key: 'professional', label: 'Professionnel' },
        { key: 'trade', label: 'Métier' }, { key: 'paymentAmount', label: 'Payé client (FCFA)' }, { key: 'base', label: 'Base (FCFA)' },
        { key: 'rate', label: 'Taux (%)' }, { key: 'amount', label: 'Commission (FCFA)' }, { key: 'professionalNet', label: 'Net pro (FCFA)' },
      ],
      payouts: [
        { key: 'reference', label: 'Référence' }, { key: 'createdAt', label: 'Date' }, { key: 'professional', label: 'Professionnel' },
        { key: 'amount', label: 'Montant (FCFA)' }, { key: 'status', label: 'Statut' }, { key: 'providerRef', label: 'Réf. prestataire' },
        { key: 'paidAt', label: 'Payé le' }, { key: 'failureReason', label: "Motif d'échec" },
      ],
      refunds: [
        { key: 'id', label: 'ID' }, { key: 'createdAt', label: 'Date' }, { key: 'professional', label: 'Professionnel' },
        { key: 'amount', label: 'Montant (FCFA)' }, { key: 'commissionDelta', label: 'Ajust. commission' },
        { key: 'professionalNetDelta', label: 'Ajust. net pro' }, { key: 'reason', label: 'Motif' }, { key: 'byEmail', label: 'Par' },
      ],
    }[type];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(toCsv(flat, columns));
  }

  /* ---------- Paramètres ---------- */

  @Get('settings/commission')
  @Perm('settings.read')
  async commissionSettings() {
    const current = await this.finance.getCommissionSettings();
    return { ...current, ratePercent: bpsToPercent(current.rateBps), history: await this.finance.rateHistoryList() };
  }

  @Put('settings/commission')
  @Perm('settings.commission.write')
  @Audit('settings.commission_update')
  setCommission(@CurrentAdmin() me: AdminContext, @Body() dto: CommissionSettingsDto) {
    return this.finance.setCommissionSettings(me, percentToBps(dto.ratePercent), dto.baseMode, dto.reason);
  }
}
