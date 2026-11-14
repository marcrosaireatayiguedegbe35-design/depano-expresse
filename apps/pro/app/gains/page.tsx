'use client';

import { date, fcfa, STATUS } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, PageHead, SecHead } from '@/components/ds';
import { Empty, Loading, useFetch } from '@/components/ui';
import Link from 'next/link';

/** Gains : chiffre d'affaires, commission, net, reversements Mobile Money. */
export default function EarningsPage() {
  const { data } = useFetch<any>('/earnings');
  const t = data?.totals;
  return (
    <div className="screen">
      <Blob />
      <PageHead title="Mes gains" back={false} />
      <section className="earn-banner">
        <small>Gains nets cumulés</small>
        <span className="amt">{t ? fcfa(t.net) : '—'}</span>
        <div className="row">
          <span><b>{t ? fcfa(t.awaitingPayout) : '—'}</b>à reverser</span>
          <span><b>{t ? fcfa(t.paidOut) : '—'}</b>déjà reversés</span>
        </div>
      </section>
      <section className="section stat-row">
        <div className="stat-card"><span className="ic"><Icon name="card" /></span><b style={{ fontSize: 15 }}>{t ? fcfa(t.gross) : '—'}</b><small>Payé par les clients</small></div>
        <div className="stat-card"><span className="ic"><Icon name="tag" /></span><b style={{ fontSize: 15 }}>{t ? fcfa(t.commission) : '—'}</b><small>Commission plateforme</small></div>
        <div className="stat-card"><span className="ic"><Icon name="checkCircle" /></span><b style={{ fontSize: 15 }}>{t ? fcfa(t.net) : '—'}</b><small>Votre part nette</small></div>
      </section>

      <section className="section">
        <SecHead title="Reversements" icon="truckFast" right={<Link className="see-all" href="/profil/reversement">Compte<Icon name="chevR" /></Link>} />
        {!data ? <Loading rows={1} height={70} /> : data.payouts.length === 0 ? <p className="small text-2">Aucun reversement pour le moment.</p> : (
          <div className="stack" style={{ gap: 10 }}>{data.payouts.map((p: any) => (
            <div key={p._id} className="money-row"><span className="ic"><Icon name="truckFast" /></span><span><b>{p.reference}</b><small>{p.beneficiary?.operator?.toUpperCase()} {p.beneficiary?.msisdn} · {date(p.paidAt ?? p.createdAt)}</small></span>
              <span className="amt">{fcfa(p.amount)}<small style={{ color: 'var(--text-2)' }}>{STATUS[p.status]?.[0] ?? ({ pending: 'En attente', processing: 'En cours', paid: 'Versé', failed: 'Échec', cancelled: 'Annulé' } as any)[p.status]}</small></span></div>
          ))}</div>
        )}
      </section>

      <section className="section">
        <SecHead title="Interventions payées" icon="docFill" />
        {!data ? <Loading rows={2} height={70} /> : data.commissions.length === 0 ? <Empty icon="card" title="Aucun paiement encore">Les montants apparaissent ici dès que le client a payé une facture confirmée.</Empty> : (
          <div className="stack" style={{ gap: 10 }}>{data.commissions.map((c: any) => (
            <Link key={c._id} href={c.invoiceId?.interventionId ? `/interventions/${c.invoiceId.interventionId}` : '/gains'} className="money-row">
              <span className="ic"><Icon name="docFill" /></span>
              <span><b>{c.invoiceId?.number ?? 'Facture'}</b><small>{c.invoiceId?.problem ?? ''} · {date(c.createdAt)}</small></span>
              <span className="amt">{fcfa(c.professionalNet)}<small style={{ color: 'var(--text-2)' }}>sur {fcfa(c.paymentAmount)} · {c.payoutId ? 'reversé' : 'à reverser'}</small></span>
            </Link>
          ))}</div>
        )}
      </section>
    </div>
  );
}
