import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { Audit, dateRange, Perm, toCsv } from '../../common/http';

/**
 * Plan de comptes indicatif (inspiré du SYSCOHADA révisé) — à valider avec l'expert-comptable.
 * Les fonds des interventions transitent pour le compte des professionnels : seule la commission
 * est un produit de la plateforme (CDC §10.6–10.7).
 */
export const ACCOUNTS: Record<string, string> = {
  '5211': 'Banque / Mobile Money',
  '4011': 'Professionnels – sommes à reverser',
  '4111': 'Clients annonceurs',
  '7011': 'Ventes de marchandises (marketplace)',
  '7061': 'Commissions sur interventions',
  '7062': 'Recettes publicitaires',
};

interface Entry {
  date: Date;
  piece: string;
  journal: 'BQ' | 'VT' | 'OD';
  account: string;
  label: string;
  debit: number;
  credit: number;
  source: string;
}

@Controller('accounting')
export class AccountingController {
  constructor(
    @InjectM('Payment') private readonly payments: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('Refund') private readonly refunds: Model<any>,
    @InjectM('Payout') private readonly payouts: Model<any>,
    @InjectM('Order') private readonly orders: Model<any>,
    @InjectM('Advertisement') private readonly ads: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
  ) {}

  /** Construit les écritures en partie double de la période à partir des opérations financières. */
  private async entries(from?: unknown, to?: unknown): Promise<Entry[]> {
    const range = dateRange(from, to);
    const out: Entry[] = [];
    const push = (e: Entry) => { if (e.debit || e.credit) out.push(e); };

    // 1. Encaissements d'interventions : banque au débit ; commission (produit) + part du pro (dette) au crédit.
    const coms = await this.commissions.find(range ? { collectedAt: range } : {}).lean<any[]>();
    const invIds = coms.map((c) => c.invoiceId);
    const invs = await this.invoices.find({ _id: { $in: invIds } }).select('number').lean<any[]>();
    const num = new Map(invs.map((i) => [String(i._id), i.number]));
    for (const c of coms) {
      const piece = num.get(String(c.invoiceId)) ?? String(c.paymentId).slice(-8);
      // Montants d'origine (avant remboursements, qui sont passés séparément).
      const comOrig = c.amount - (c.adjustments ?? []).reduce((s: number, a: any) => s + a.commissionDelta, 0);
      const netOrig = c.professionalNet - (c.adjustments ?? []).reduce((s: number, a: any) => s + a.netDelta, 0);
      const label = `Encaissement intervention ${piece}`;
      push({ date: c.collectedAt, piece, journal: 'BQ', account: '5211', label, debit: c.paymentAmount, credit: 0, source: 'payment' });
      push({ date: c.collectedAt, piece, journal: 'BQ', account: '7061', label: `Commission ${c.rateBps / 100} % – ${piece}`, debit: 0, credit: comOrig, source: 'commission' });
      push({ date: c.collectedAt, piece, journal: 'BQ', account: '4011', label: `Part professionnel – ${piece}`, debit: 0, credit: netOrig, source: 'commission' });
    }

    // 2. Remboursements : écritures inverses.
    for (const r of await this.refunds.find({ status: 'succeeded', ...(range ? { createdAt: range } : {}) }).lean<any[]>()) {
      const piece = `RB-${String(r._id).slice(-6).toUpperCase()}`;
      push({ date: r.createdAt, piece, journal: 'BQ', account: '7061', label: `Annulation commission – ${r.reason}`, debit: Math.abs(r.commissionDelta ?? 0), credit: 0, source: 'refund' });
      push({ date: r.createdAt, piece, journal: 'BQ', account: '4011', label: 'Réduction part professionnel (remboursement)', debit: Math.abs(r.professionalNetDelta ?? 0), credit: 0, source: 'refund' });
      push({ date: r.createdAt, piece, journal: 'BQ', account: '5211', label: 'Remboursement client', debit: 0, credit: r.amount, source: 'refund' });
    }

    // 3. Reversements aux professionnels.
    for (const p of await this.payouts.find({ status: 'paid', ...(range ? { paidAt: range } : {}) }).populate('professionalId', 'firstName lastName businessName').lean<any[]>()) {
      const name = p.professionalId?.businessName || `${p.professionalId?.firstName ?? ''} ${p.professionalId?.lastName ?? ''}`.trim();
      push({ date: p.paidAt, piece: p.reference, journal: 'BQ', account: '4011', label: `Reversement ${name}`, debit: p.amount, credit: 0, source: 'payout' });
      push({ date: p.paidAt, piece: p.reference, journal: 'BQ', account: '5211', label: `Reversement ${name} (${p.providerRef ?? ''})`, debit: 0, credit: p.amount, source: 'payout' });
    }

    // 4. Ventes marketplace : reconnues à la livraison.
    for (const o of await this.orders.find({ status: 'delivered', ...(range ? { updatedAt: range } : {}) }).lean<any[]>()) {
      push({ date: o.updatedAt, piece: o.number, journal: 'VT', account: '5211', label: `Vente marketplace ${o.number}`, debit: o.total, credit: 0, source: 'order' });
      push({ date: o.updatedAt, piece: o.number, journal: 'VT', account: '7011', label: `Vente marketplace ${o.number}`, debit: 0, credit: o.total, source: 'order' });
    }

    // 5. Campagnes publicitaires facturées : reconnues au démarrage.
    for (const a of await this.ads.find({ 'campaign.price': { $gt: 0 }, status: { $in: ['active', 'ended', 'paused'] }, ...(range ? { startAt: range } : {}) }).populate('companyId', 'name').lean<any[]>()) {
      const piece = `PUB-${String(a._id).slice(-6).toUpperCase()}`;
      const label = `Campagne « ${a.campaign?.name || a.title} »${a.companyId?.name ? ` – ${a.companyId.name}` : ''}`;
      push({ date: a.startAt, piece, journal: 'VT', account: '4111', label, debit: a.campaign.price, credit: 0, source: 'ad' });
      push({ date: a.startAt, piece, journal: 'VT', account: '7062', label, debit: 0, credit: a.campaign.price, source: 'ad' });
    }

    return out.sort((a, b) => +new Date(a.date) - +new Date(b.date) || a.piece.localeCompare(b.piece));
  }

  @Get('ledger')
  @Perm('finance.read')
  async ledger(@Query() q: Record<string, unknown>) {
    const entries = await this.entries(q.from, q.to);
    const balances = Object.entries(ACCOUNTS).map(([account, label]) => {
      const rows = entries.filter((e) => e.account === account);
      const debit = rows.reduce((s, e) => s + e.debit, 0);
      const credit = rows.reduce((s, e) => s + e.credit, 0);
      return { account, label, debit, credit, balance: debit - credit };
    });
    const credit = (a: string) => balances.find((b) => b.account === a)!.credit - balances.find((b) => b.account === a)!.debit;
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Math.max(10, Number(q.limit) || 50));
    return {
      summary: {
        commissions: credit('7061'),
        marketplace: credit('7011'),
        advertising: credit('7062'),
        platformRevenue: credit('7061') + credit('7011') + credit('7062'),
        dueToProfessionals: credit('4011'),
        treasury: balances.find((b) => b.account === '5211')!.balance,
        totalDebit,
        totalCredit,
        balanced: totalDebit === totalCredit,
      },
      balances,
      accounts: ACCOUNTS,
      total: entries.length,
      page,
      limit,
      items: [...entries].reverse().slice((page - 1) * limit, page * limit),
    };
  }

  @Get('export')
  @Perm('finance.export')
  @Audit('accounting.export')
  async export(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const entries = await this.entries(q.from, q.to);
    const rows = entries.map((e) => ({ ...e, date: new Date(e.date).toISOString().slice(0, 10), accountLabel: ACCOUNTS[e.account] }));
    const csv = toCsv(rows, [
      { key: 'date', label: 'Date' }, { key: 'journal', label: 'Journal' }, { key: 'piece', label: 'N° pièce' },
      { key: 'account', label: 'Compte' }, { key: 'accountLabel', label: 'Intitulé du compte' }, { key: 'label', label: 'Libellé' },
      { key: 'debit', label: 'Débit (FCFA)' }, { key: 'credit', label: 'Crédit (FCFA)' },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="journal-comptable-${q.from || 'debut'}-${q.to || new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
