import { Controller, Get } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { Perm } from '../../common/http';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectM('User') private readonly users: Model<any>,
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    @InjectM('ServiceRequest') private readonly requests: Model<any>,
    @InjectM('Payment') private readonly payments: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('Payout') private readonly payouts: Model<any>,
    @InjectM('Dispute') private readonly disputes: Model<any>,
    @InjectM('Order') private readonly orders: Model<any>,
    @InjectM('Product') private readonly products: Model<any>,
    @InjectM('Company') private readonly companies: Model<any>,
    @InjectM('Advertisement') private readonly ads: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
  ) {}

  private async sum(model: Model<any>, match: Record<string, unknown>, field: string) {
    const [r] = await model.aggregate([{ $match: match }, { $group: { _id: null, v: { $sum: field } } }]);
    return r?.v ?? 0;
  }

  @Get()
  @Perm('dashboard.read')
  async stats() {
    const paid = { kind: 'intervention', status: { $in: ['succeeded', 'partially_refunded', 'refunded'] } };
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const [
      clients, professionals, verifiedPros, pendingPros, interventions, pendingRequests, completed,
      revenue, refunded, commissions, payoutsPaid, payoutsPending, openDisputes, orders, pendingOrders,
      products, companies, activeAds, invoicesAwaiting, series, byTrade,
    ] = await Promise.all([
      this.users.countDocuments(),
      this.pros.countDocuments(),
      this.pros.countDocuments({ verificationStatus: 'validated' }),
      this.pros.countDocuments({ verificationStatus: { $in: ['pending', 'in_review'] } }),
      this.interventions.countDocuments(),
      this.requests.countDocuments({ status: { $in: ['sent', 'pending', 'response_received'] } }),
      this.interventions.countDocuments({ status: 'completed' }),
      this.sum(this.payments, paid, '$amount'),
      this.sum(this.payments, paid, '$refundedAmount'),
      this.sum(this.commissions, {}, '$amount'),
      this.sum(this.payouts, { status: 'paid' }, '$amount'),
      this.sum(this.payouts, { status: { $in: ['pending', 'processing', 'failed'] } }, '$amount'),
      this.disputes.countDocuments({ status: { $ne: 'resolved' } }),
      this.orders.countDocuments(),
      this.orders.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing'] } }),
      this.products.countDocuments({ status: 'published' }),
      this.companies.countDocuments({ status: 'validated' }),
      this.ads.countDocuments({ status: 'active' }),
      this.invoices.countDocuments({ status: 'submitted' }),
      this.commissions.aggregate([
        { $match: { collectedAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$collectedAt' } },
            revenue: { $sum: '$paymentAmount' },
            commission: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.commissions.aggregate([
        { $group: { _id: '$trade', revenue: { $sum: '$paymentAmount' }, commission: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    // Série continue sur 30 jours (jours sans activité = 0).
    const map = new Map(series.map((d: any) => [d._id, d]));
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const v: any = map.get(key);
      return { date: key, revenue: v?.revenue ?? 0, commission: v?.commission ?? 0 };
    });

    return {
      counts: {
        clients, professionals, verifiedPros, pendingPros, interventions, pendingRequests, completed,
        openDisputes, orders, pendingOrders, products, companies, activeAds, invoicesAwaiting,
      },
      finance: {
        interventionRevenue: revenue - refunded,
        refunded,
        commissions,
        payoutsPaid,
        payoutsPending,
      },
      last30Days: days,
      byTrade,
    };
  }
}
