'use client';

import Link from 'next/link';
import { date, fcfa } from '@/lib/format';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/session';
import { Empty, Loading, useFetch } from '@/components/ui';

const PAYOUT: Record<string, [string, string]> = { pending: ['En attente', 'wait'], processing: ['En cours', 'wait'], paid: ['Versé', 'ok'], failed: ['Échec', 'no'], cancelled: ['Annulé', 'off'] };
const OPS: Record<string, string> = { mtn: 'MTN MoMo', moov: 'Moov Money', celtiis: 'Celtiis Cash' };

/** Gains : part nette cumulée, détail du calcul, compte et historique des reversements, interventions payées. */
export default function EarningsPage() {
  const { pro } = useSession();
  const { data } = useFetch<any>('/earnings');
  const t = data?.totals;
  const share = t?.gross ? Math.round((t.net / t.gross) * 100) : 0;
  const acc = pro?.payoutAccount;

  return (
    <div className="screen pg">
      <header className="pg-head"><div><h1>Mes gains</h1><p>Ce que vous avez gagné sur Depanno Expresse</p></div></header>

      <section className="pg-hero">
        <small>Gains nets cumulés</small>
        <strong>{t ? fcfa(t.net) : '—'}</strong>
        <div className="pg-hero-row">
          <span><small>À reverser</small><b>{t ? fcfa(t.awaitingPayout) : '—'}</b></span>
          <span><small>Déjà reversés</small><b>{t ? fcfa(t.paidOut) : '—'}</b></span>
        </div>
      </section>

      {t?.cashCommissionDue > 0 && (
        <div className="pg-alert"><Icon name="info" /><span><b>Commission due sur paiements en espèces : {fcfa(t.cashCommissionDue)}</b><small>Les clients vous ont payé en main propre : cette commission est à régler à la plateforme.</small></span></div>
      )}

      <section className="pg-card">
        <h2><Icon name="tag" />Détail du calcul</h2>
        <div className="pg-line"><span>Payé par les clients</span><b>{t ? fcfa(t.gross) : '—'}</b></div>
        <div className="pg-line minus"><span>Commission de la plateforme</span><b>− {t ? fcfa(t.commission) : '—'}</b></div>
        <div className="pg-line total"><span>Votre part nette</span><b>{t ? fcfa(t.net) : '—'}</b></div>
        {t?.gross > 0 && <div className="pg-bar" aria-label={`Part nette : ${share} %`}><i style={{ width: `${share}%` }} /><small>{share} % pour vous</small></div>}
      </section>

      <Link href="/profil/reversement" className="pg-acc">
        <span className="ic"><Icon name="cardFill" /></span>
        <span className="grow">{acc?.msisdn ? <><small>Compte de reversement</small><b>{OPS[acc.operator ?? ""] ?? acc.operator} · {acc.msisdn}</b></> : <><small>Aucun compte de reversement</small><b>Ajouter mon numéro Mobile Money</b></>}</span>
        <Icon name="chevR" />
      </Link>

      <section className="pg-card">
        <h2><Icon name="truckFast" />Reversements</h2>
        {!data ? <Loading rows={1} height={70} /> : data.payouts.length === 0 ? <p className="pg-empty">Aucun reversement pour le moment.</p> : data.payouts.map((p: any) => {
          const st = PAYOUT[p.status] ?? [p.status, 'off'];
          return (
            <div key={p._id} className="pg-row">
              <span className="ic"><Icon name="truckFast" /></span>
              <span className="grow"><b>{p.reference}</b><small>{OPS[p.beneficiary?.operator] ?? p.beneficiary?.operator?.toUpperCase()} {p.beneficiary?.msisdn} · {date(p.paidAt ?? p.createdAt)}</small></span>
              <span className="end"><b>{fcfa(p.amount)}</b><i className={`pill ${st[1]}`}>{st[0]}</i></span>
            </div>
          );
        })}
      </section>

      <section className="pg-card">
        <h2><Icon name="docFill" />Interventions payées</h2>
        {!data ? <Loading rows={2} height={70} /> : data.commissions.length === 0 ? <Empty icon="card" title="Aucun paiement encore">Les montants apparaissent ici dès que le client a payé une facture confirmée.</Empty> : data.commissions.map((c: any) => (
          <Link key={c._id} href={c.invoiceId?.interventionId ? `/intervention?id=${c.invoiceId.interventionId}` : '/gains'} className="pg-row">
            <span className="ic"><Icon name="docFill" /></span>
            <span className="grow"><b>{c.invoiceId?.number ?? 'Facture'}</b><small>{c.invoiceId?.problem ?? ''} · {date(c.createdAt)}</small></span>
            <span className="end"><b>{fcfa(c.professionalNet)}</b><small>sur {fcfa(c.paymentAmount)}</small><i className={`pill ${c.collection === 'cash' ? 'off' : c.payoutId ? 'ok' : 'wait'}`}>{c.collection === 'cash' ? 'Espèces' : c.payoutId ? 'Reversé' : 'À reverser'}</i></span>
          </Link>
        ))}
      </section>
    </div>
  );
}
