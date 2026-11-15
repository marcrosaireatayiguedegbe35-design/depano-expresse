'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, idempotencyKey, qs } from '@/lib/api';
import { date, dateTime, fcfa, personName, STATUS, TRADES } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, Filters, Modal, PageHeader, Pager, Stat, Table, Tabs, useFetch, useList, useToast } from '@/components/ui';

type Tab = 'summary' | 'invoices' | 'payments' | 'commissions' | 'payouts' | 'refunds';

function Summary() {
  const [range, setRange] = useState({ from: '', to: '', groupBy: 'day' });
  const { data, error } = useFetch<any>(`/finance/summary${qs(range)}`);
  const can = useCan();
  return (
    <>
      <div className="filters">
        <label className="hstack gap small">Du <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label className="hstack gap small">au <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        <select value={range.groupBy} onChange={(e) => setRange({ ...range, groupBy: e.target.value })} aria-label="Regroupement">
          <option value="day">Par jour</option><option value="month">Par mois</option>
        </select>
        {can('finance.export') && (['payments', 'commissions', 'payouts', 'refunds'] as const).map((t) => (
          <a key={t} className="btn btn-sm" href={`/api/finance/export${qs({ type: t, from: range.from, to: range.to })}`}>
            Export {{ payments: 'paiements', commissions: 'commissions', payouts: 'reversements', refunds: 'remboursements' }[t]} (CSV)
          </a>
        ))}
      </div>
      <ErrorBox error={error} />
      {data && (
        <>
          <div className="alert alert-info small">
            Commission en vigueur : <strong>{data.settings.rateBps / 100} %</strong> — base :{' '}
            {data.settings.baseMode === 'services_only' ? 'prestations uniquement (pièces et dépenses externes exclues)' : 'totalité de la facture'}.{' '}
            <Link href="/parametres">Paramètres</Link>
          </div>
          <div className="stats">
            <Stat label="Commissions générées (factures validées)" value={fcfa(data.commissionsGenerated.amount)} hint={`${data.commissionsGenerated.count} factures`} />
            <Stat label="Commissions encaissées" value={fcfa(data.commissionsCollected.amount)} tone="success" hint={`${data.commissionsCollected.count} paiements`} />
            <Stat label="Paiements d’interventions" value={fcfa(data.interventionPayments.amount)} />
            <Stat label="Validées, en attente de paiement" value={fcfa(data.awaitingPayment.amount)} hint={`${data.awaitingPayment.count} factures`} />
            <Stat label="Reversements effectués" value={fcfa(data.payoutsPaid.amount)} hint={`${data.payoutsPaid.count} virements`} />
            <Stat label="Reversements en attente" value={fcfa(data.payoutsPending.amount)} tone={data.payoutsPending.count ? 'warning' : undefined} />
            <Stat label="Reversements échoués" value={fcfa(data.payoutsFailed.amount)} tone={data.payoutsFailed.count ? 'danger' : undefined} />
            <Stat label="Remboursements" value={fcfa(data.refunds.amount)} hint={`${data.refunds.count} opérations`} />
            <Stat label="Litiges financiers ouverts" value={data.openDisputes} tone={data.openDisputes ? 'danger' : undefined} />
          </div>
          <div className="grid grid-2">
            <Card title="Revenus par période">
              <Table rows={[...data.byPeriod].reverse()} empty="Aucune donnée" columns={[
                { key: '_id', label: 'Période' },
                { key: 'revenue', label: 'Payé clients', align: 'right', render: (r: any) => fcfa(r.revenue) },
                { key: 'commission', label: 'Commission', align: 'right', render: (r: any) => fcfa(r.commission) },
                { key: 'net', label: 'Net pros', align: 'right', render: (r: any) => fcfa(r.net) },
              ]} />
            </Card>
            <div>
              <Card title="Revenus par catégorie">
                <Table rows={data.byTrade} columns={[
                  { key: '_id', label: 'Métier', render: (r: any) => TRADES[r._id] ?? r._id },
                  { key: 'count', label: 'Nb', align: 'right' },
                  { key: 'revenue', label: 'Payé', align: 'right', render: (r: any) => fcfa(r.revenue) },
                  { key: 'commission', label: 'Commission', align: 'right', render: (r: any) => fcfa(r.commission) },
                ]} />
              </Card>
              <Card title="Top professionnels">
                <Table rows={data.byProfessional} columns={[
                  { key: 'pro', label: 'Professionnel', render: (r: any) => <Link href={`/professionnel?id=${r._id}`}>{personName(r.pro)}</Link> },
                  { key: 'count', label: 'Nb', align: 'right' },
                  { key: 'revenue', label: 'Payé', align: 'right', render: (r: any) => fcfa(r.revenue) },
                  { key: 'commission', label: 'Commission', align: 'right', render: (r: any) => fcfa(r.commission) },
                ]} />
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Invoices() {
  const { data, error, params, set, setPage } = useList('/finance/invoices');
  return (
    <>
      <Filters params={params} set={set} selects={[{ key: 'status', label: 'Statut', options: ['submitted', 'approved', 'contested', 'paid', 'partially_refunded', 'refunded', 'superseded', 'cancelled'].map((s) => [s, STATUS[s][0]]) }]} />
      <ErrorBox error={error} />
      <Table rows={data?.items} columns={[
        { key: 'number', label: 'Facture', render: (i: any) => <Link href={`/intervention?id=${i.interventionId}`}>{i.number} v{i.version}</Link> },
        { key: 'pro', label: 'Professionnel', render: (i: any) => personName(i.professionalId) },
        { key: 'client', label: 'Client', render: (i: any) => personName(i.clientId) },
        { key: 'total', label: 'Total', align: 'right', render: (i: any) => fcfa(i.total) },
        { key: 'base', label: 'Base comm.', align: 'right', render: (i: any) => fcfa(i.commissionBase) },
        { key: 'commission', label: 'Commission', align: 'right', render: (i: any) => fcfa(i.commissionAmount) },
        { key: 'net', label: 'Net pro', align: 'right', render: (i: any) => fcfa(i.professionalNet) },
        { key: 'status', label: 'Statut', render: (i: any) => <Badge status={i.status} /> },
      ]} />
      <Pager data={data} onPage={setPage} />
    </>
  );
}

function RefundModal({ payment, onClose, onDone }: { payment: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const max = payment.amount - payment.refundedAmount;
  const [amount, setAmount] = useState(max);
  const [reason, setReason] = useState('');
  const [key] = useState(idempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Rembourser un paiement" onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api('/finance/refunds', { method: 'POST', body: { paymentId: payment._id, amount, reason }, headers: { 'Idempotency-Key': key } });
          toast('Remboursement enregistré, commission recalculée');
          onDone();
          onClose();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}>
        <p className="small">Paiement de {fcfa(payment.amount)} — déjà remboursé {fcfa(payment.refundedAmount)}. La commission et le net du professionnel seront recalculés au prorata, et l’opération tracée.</p>
        <div className="field">
          <label htmlFor="amount">Montant (FCFA, max {fcfa(max)})</label>
          <input id="amount" type="number" min={1} max={max} step={1} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="reason">Motif</label>
          <textarea id="reason" rows={3} required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <ErrorBox error={error} />
        <div className="hstack gap end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-danger" disabled={busy}>Confirmer le remboursement</button>
        </div>
      </form>
    </Modal>
  );
}

function Payments() {
  const can = useCan();
  const { data, error, params, set, setPage, reload } = useList('/finance/payments');
  const [refund, setRefund] = useState<any>(null);
  return (
    <>
      <Filters params={params} set={set} selects={[
        { key: 'kind', label: 'Type', options: [['intervention', 'Intervention'], ['order', 'Marketplace']] },
        { key: 'status', label: 'Statut', options: ['pending', 'succeeded', 'failed', 'partially_refunded', 'refunded'].map((s) => [s, STATUS[s][0]]) },
      ]} />
      <ErrorBox error={error} />
      <Table rows={data?.items} columns={[
        { key: 'paidAt', label: 'Date', render: (p: any) => dateTime(p.paidAt ?? p.createdAt) },
        { key: 'kind', label: 'Type', render: (p: any) => (p.kind === 'order' ? 'Marketplace' : 'Intervention') },
        { key: 'client', label: 'Client', render: (p: any) => personName(p.clientId) },
        { key: 'pro', label: 'Professionnel', render: (p: any) => personName(p.professionalId) },
        { key: 'amount', label: 'Montant', align: 'right', render: (p: any) => fcfa(p.amount) },
        { key: 'refundedAmount', label: 'Remboursé', align: 'right', render: (p: any) => (p.refundedAmount ? fcfa(p.refundedAmount) : '—') },
        { key: 'provider', label: 'Prestataire', render: (p: any) => <>{p.provider}<div className="mono">{p.providerRef}</div></> },
        { key: 'status', label: 'Statut', render: (p: any) => <Badge status={p.status} /> },
        {
          key: 'a', label: '', render: (p: any) => can('finance.refund') && p.kind === 'intervention' && ['succeeded', 'partially_refunded'].includes(p.status) &&
            <button className="btn btn-sm" onClick={() => setRefund(p)}>Rembourser</button>,
        },
      ]} />
      <Pager data={data} onPage={setPage} />
      {refund && <RefundModal payment={refund} onClose={() => setRefund(null)} onDone={reload} />}
    </>
  );
}

function Commissions() {
  const { data, error, setPage } = useList('/finance/commissions');
  return (
    <>
      <ErrorBox error={error} />
      <Table rows={data?.items} columns={[
        { key: 'collectedAt', label: 'Encaissée le', render: (c: any) => dateTime(c.collectedAt) },
        { key: 'pro', label: 'Professionnel', render: (c: any) => personName(c.professionalId) },
        { key: 'trade', label: 'Métier', render: (c: any) => TRADES[c.trade] },
        { key: 'paymentAmount', label: 'Payé client', align: 'right', render: (c: any) => fcfa(c.paymentAmount) },
        { key: 'base', label: 'Base', align: 'right', render: (c: any) => fcfa(c.base) },
        { key: 'rate', label: 'Taux', align: 'right', render: (c: any) => `${c.rateBps / 100} %` },
        { key: 'amount', label: 'Commission', align: 'right', render: (c: any) => <>{fcfa(c.amount)}{c.adjustments?.length > 0 && <div className="small muted">ajustée</div>}</> },
        { key: 'professionalNet', label: 'Net pro', align: 'right', render: (c: any) => fcfa(c.professionalNet) },
        { key: 'payout', label: 'Reversé', render: (c: any) => (c.payoutId ? <Badge status="paid">Oui</Badge> : <Badge status="pending">Non</Badge>) },
      ]} />
      <Pager data={data} onPage={setPage} />
    </>
  );
}

function NewPayout({ onClose, onDone, initialPro }: { onClose: () => void; onDone: () => void; initialPro?: string }) {
  const toast = useToast();
  const pros = useFetch<any>('/professionals?status=validated&limit=100');
  const [pro, setPro] = useState(initialPro ?? '');
  const balance = useFetch<any>(pro ? `/finance/balances/${pro}` : null);
  const [key] = useState(idempotencyKey);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title="Préparer un reversement" onClose={onClose}>
      <div className="field">
        <label htmlFor="pro">Professionnel</label>
        <select id="pro" value={pro} onChange={(e) => setPro(e.target.value)}>
          <option value="">Choisir…</option>
          {pros.data?.items.map((p: any) => <option key={p._id} value={p._id}>{personName(p)} – {TRADES[p.trade]}</option>)}
        </select>
      </div>
      {balance.data && (
        <div className="alert alert-info small">
          Nets non reversés : {fcfa(balance.data.fromCommissions)} ({balance.data.commissionsCount} interventions)<br />
          Régularisations (remboursements après reversement) : {fcfa(balance.data.adjustments)}<br />
          <strong>Solde disponible : {fcfa(balance.data.available)}</strong>
        </div>
      )}
      <ErrorBox error={error} />
      <div className="hstack gap end">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!pro || !balance.data || balance.data.available <= 0}
          onClick={async () => {
            try {
              await api('/finance/payouts', { method: 'POST', body: { professionalId: pro }, headers: { 'Idempotency-Key': key } });
              toast('Reversement créé (en attente d’exécution)');
              onDone();
              onClose();
            } catch (e: any) { setError(e.message); }
          }}>Créer le reversement</button>
      </div>
    </Modal>
  );
}

function PayoutAction({ payout, onClose, onDone }: { payout: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [action, setAction] = useState(payout.status === 'failed' ? 'retry' : 'paid');
  const [providerRef, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const options: Record<string, [string, string][]> = {
    pending: [['processing', 'Marquer en cours'], ['paid', 'Confirmer le paiement'], ['failed', 'Signaler un échec'], ['cancel', 'Annuler']],
    processing: [['paid', 'Confirmer le paiement'], ['failed', 'Signaler un échec']],
    failed: [['retry', 'Relancer'], ['cancel', 'Annuler']],
  };
  return (
    <Modal title={`Reversement ${payout.reference}`} onClose={onClose}>
      <p className="small">{personName(payout.professionalId)} · {fcfa(payout.amount)} · {payout.beneficiary?.operator} {payout.beneficiary?.msisdn}</p>
      <ul className="timeline small">{payout.history?.map((h: any, i: number) => <li key={i}>{STATUS[h.status]?.[0] ?? h.status} · {dateTime(h.at)} · {h.by} {h.note && `— ${h.note}`}</li>)}</ul>
      {options[payout.status] && (
        <>
          <div className="field">
            <label htmlFor="action">Action</label>
            <select id="action" value={action} onChange={(e) => setAction(e.target.value)}>
              {options[payout.status].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          {action === 'paid' && <div className="field"><label htmlFor="ref">Référence de transaction Mobile Money</label><input id="ref" value={providerRef} onChange={(e) => setRef(e.target.value)} /></div>}
          {(action === 'failed' || action === 'cancel') && <div className="field"><label htmlFor="r">Motif</label><input id="r" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}
          <ErrorBox error={error} />
          <div className="hstack gap end">
            <button className="btn btn-primary" onClick={async () => {
              try {
                await api(`/finance/payouts/${payout._id}/action`, { method: 'POST', body: { action, providerRef: providerRef || undefined, reason: reason || undefined } });
                toast('Reversement mis à jour');
                onDone();
                onClose();
              } catch (e: any) { setError(e.message); }
            }}>Valider</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Payouts({ initialPro }: { initialPro?: string }) {
  const can = useCan();
  const { data, error, params, set, setPage, reload } = useList('/finance/payouts');
  const [creating, setCreating] = useState(!!initialPro);
  const [selected, setSelected] = useState<any>(null);
  return (
    <>
      <div className="hstack between">
        <Filters params={params} set={set} selects={[{ key: 'status', label: 'Statut', options: ['pending', 'processing', 'paid', 'failed', 'cancelled'].map((s) => [s, STATUS[s][0]]) }]} />
        {can('finance.payout') && <button className="btn btn-primary" onClick={() => setCreating(true)}>Préparer un reversement</button>}
      </div>
      <ErrorBox error={error} />
      <Table rows={data?.items} onRowClick={can('finance.payout') ? setSelected : undefined} columns={[
        { key: 'reference', label: 'Référence', render: (p: any) => <span className="mono">{p.reference}</span> },
        { key: 'createdAt', label: 'Créé le', render: (p: any) => date(p.createdAt) },
        { key: 'pro', label: 'Bénéficiaire', render: (p: any) => <>{personName(p.professionalId)}<div className="muted small">{p.beneficiary?.operator} {p.beneficiary?.msisdn}</div></> },
        { key: 'amount', label: 'Montant', align: 'right', render: (p: any) => fcfa(p.amount) },
        { key: 'attempts', label: 'Relances', align: 'right' },
        { key: 'providerRef', label: 'Réf. prestataire', render: (p: any) => <span className="mono">{p.providerRef ?? '—'}</span> },
        { key: 'status', label: 'Statut', render: (p: any) => <>{<Badge status={p.status} />}{p.failureReason && <div className="small error">{p.failureReason}</div>}</> },
      ]} />
      <Pager data={data} onPage={setPage} />
      {creating && <NewPayout initialPro={initialPro} onClose={() => setCreating(false)} onDone={reload} />}
      {selected && <PayoutAction payout={selected} onClose={() => setSelected(null)} onDone={reload} />}
    </>
  );
}

function Refunds() {
  const { data, error, setPage } = useList('/finance/refunds');
  return (
    <>
      <ErrorBox error={error} />
      <Table rows={data?.items} empty="Aucun remboursement" columns={[
        { key: 'createdAt', label: 'Date', render: (r: any) => dateTime(r.createdAt) },
        { key: 'pro', label: 'Professionnel', render: (r: any) => personName(r.professionalId) },
        { key: 'amount', label: 'Montant', align: 'right', render: (r: any) => fcfa(r.amount) },
        { key: 'commissionDelta', label: 'Ajust. commission', align: 'right', render: (r: any) => fcfa(r.commissionDelta) },
        { key: 'professionalNetDelta', label: 'Ajust. net pro', align: 'right', render: (r: any) => fcfa(r.professionalNetDelta) },
        { key: 'reason', label: 'Motif' },
        { key: 'byEmail', label: 'Par' },
        { key: 'settle', label: 'Régularisation', render: (r: any) => (r.needsSettlement ? (r.settledInPayoutId ? 'Imputée' : 'À imputer') : '—') },
      ]} />
      <Pager data={data} onPage={setPage} />
    </>
  );
}

function FinanceInner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) ?? 'summary');
  return (
    <>
      <PageHeader title="Finance & commissions" subtitle="Commission standard de 20 % calculée automatiquement par le backend — chaque opération est tracée." />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        ['summary', 'Synthèse'], ['invoices', 'Factures'], ['payments', 'Paiements'], ['commissions', 'Commissions'], ['payouts', 'Reversements'], ['refunds', 'Remboursements'],
      ]} />
      <Card>
        {tab === 'summary' && <Summary />}
        {tab === 'invoices' && <Invoices />}
        {tab === 'payments' && <Payments />}
        {tab === 'commissions' && <Commissions />}
        {tab === 'payouts' && <Payouts initialPro={sp.get('pro') ?? undefined} />}
        {tab === 'refunds' && <Refunds />}
      </Card>
    </>
  );
}

export default function FinancePage() {
  return <Suspense><FinanceInner /></Suspense>;
}
