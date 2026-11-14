'use client';

import Link from 'next/link';
import { Badge, Card, ErrorBox, KV, PageHeader, Table, useFetch } from '@/components/ui';
import { dateTime, DISPUTE_DECISIONS, fcfa, LINE_TYPES, personName, statusLabel, TRADES } from '@/lib/format';

function Lines({ lines }: { lines: any[] }) {
  return (
    <Table rows={lines} columns={[
      { key: 'type', label: 'Type', render: (l: any) => LINE_TYPES[l.type] },
      { key: 'label', label: 'Désignation' },
      { key: 'quantity', label: 'Qté', align: 'right' },
      { key: 'unitPrice', label: 'P.U.', align: 'right', render: (l: any) => fcfa(l.unitPrice) },
      { key: 'total', label: 'Total', align: 'right', render: (l: any) => fcfa(l.total ?? l.quantity * l.unitPrice) },
    ]} />
  );
}

export default function InterventionDetail({ params }: { params: { id: string } }) {
  const { data, error } = useFetch<any>(`/interventions/${params.id}`);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="muted">Chargement…</p>;
  const { intervention: i, request, quotations, invoices, approvals, disputes, payments, commissions, refunds } = data;

  return (
    <>
      <PageHeader title={`Intervention ${i.reference}`} subtitle={`${TRADES[i.trade]} · ${i.problem}`} actions={<Badge status={i.status} />} />
      <div className="grid grid-3">
        <Card title="Client">
          <KV items={[['Nom', personName(i.clientId)], ['Téléphone', i.clientId?.phone], ['Adresse', i.address]]} />
        </Card>
        <Card title="Professionnel">
          <KV items={[['Nom', i.professionalId ? <Link key="p" href={`/professionnels/${i.professionalId._id}`}>{personName(i.professionalId)}</Link> : '—'], ['Téléphone', i.professionalId?.phone], ['Vérification', <Badge key="v" status={i.professionalId?.verificationStatus} />]]} />
        </Card>
        <Card title="Demande">
          <KV items={[
            ['Type', request?.mode === 'grouped' ? `Groupée (${request.recipients?.length} pros)` : 'Individuelle'],
            ['Véhicule', request?.vehicle ? `${request.vehicle.brand} ${request.vehicle.model} ${request.vehicle.year ?? ''}` : '—'],
            ['Urgence', request?.urgency], ['Description', request?.description],
          ]} />
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Suivi">
          <ul className="timeline">
            {i.timeline?.map((t: any, k: number) => <li key={k}><strong>{statusLabel(t.status)}</strong> <span className="muted small">· {dateTime(t.at)}</span>{t.note && <div className="small">{t.note}</div>}</li>)}
          </ul>
        </Card>
        <Card title="Devis">
          {quotations.length === 0 && <p className="muted">Aucun devis.</p>}
          {quotations.map((q: any) => (
            <div key={q._id} className="invoice-version">
              <div className="hstack between"><strong>{q.kind === 'supplement' ? 'Devis complémentaire' : 'Devis initial'} · {fcfa(q.total)}</strong>
                <Badge status={q.status === 'accepted' ? 'validated' : q.status === 'rejected' ? 'rejected' : 'pending'}>{{ accepted: 'Accepté par le client', rejected: 'Refusé', pending: 'En attente du client' }[q.status as string]}</Badge></div>
              <p className="small">{q.diagnosis} — {q.plannedWork}</p>
              {q.emergencyAuthorized && <div className="alert alert-warning small">Urgence autorisée expressément</div>}
            </div>
          ))}
        </Card>
      </div>

      <Card title="Factures (toutes versions conservées)">
        {invoices.length === 0 && <p className="muted">Aucune facture soumise.</p>}
        {[...invoices].reverse().map((inv: any) => (
          <div key={inv._id} className={`invoice-version ${inv.status === 'superseded' ? 'superseded' : ''}`}>
            <div className="hstack between" style={{ marginBottom: 8 }}>
              <strong>{inv.number} · version {inv.version}</strong>
              <Badge status={inv.status} />
            </div>
            {inv.changeReason && <div className="alert alert-info small">Motif de la nouvelle version : {inv.changeReason}</div>}
            <KV items={[['Problème constaté', inv.problem], ['Diagnostic', inv.diagnosis], ['Travaux effectués', inv.workDone], ['Soumise le', dateTime(inv.submittedAt)]]} />
            <div style={{ marginTop: 10 }}><Lines lines={inv.lines} /></div>
            <table style={{ marginTop: 8 }}>
              <tbody>
                <tr className="totals"><td>Total payé par le client</td><td className="right">{fcfa(inv.total)}</td></tr>
                <tr><td>Base de commission (prestations)</td><td className="right">{fcfa(inv.commissionBase)}</td></tr>
                <tr><td>Exclu de la base (pièces, dépenses externes)</td><td className="right">{fcfa(inv.excludedFromBase)}</td></tr>
                {inv.commissionAmount !== undefined && (
                  <>
                    <tr><td>Commission plateforme ({(inv.commissionRateBps ?? 0) / 100} %, figée à la validation)</td><td className="right">{fcfa(inv.commissionAmount)}</td></tr>
                    <tr className="totals"><td>Net professionnel</td><td className="right">{fcfa(inv.professionalNet)}</td></tr>
                  </>
                )}
              </tbody>
            </table>
            {approvals.filter((a: any) => a.invoiceId === inv._id).map((a: any) => (
              <div key={a._id} className={`alert ${a.decision === 'confirmed' ? 'alert-success' : 'alert-danger'} small`}>
                Client : {a.decision === 'confirmed' ? 'montant confirmé' : 'montant contesté'} le {dateTime(a.createdAt)}{a.reason && ` — « ${a.reason} »`}
              </div>
            ))}
            {inv.status === 'submitted' && <div className="alert alert-warning small">Paiement bloqué : en attente de la confirmation du client.</div>}
            {inv.status === 'contested' && <div className="alert alert-danger small">Paiement suspendu : facture contestée.</div>}
          </div>
        ))}
      </Card>

      <div className="grid grid-2">
        <Card title="Paiements, commission et remboursements">
          <Table rows={payments} empty="Aucun paiement" columns={[
            { key: 'paidAt', label: 'Date', render: (p: any) => dateTime(p.paidAt ?? p.createdAt) },
            { key: 'amount', label: 'Montant', align: 'right', render: (p: any) => fcfa(p.amount) },
            { key: 'provider', label: 'Moyen', render: (p: any) => <>{p.provider}<div className="mono">{p.providerRef}</div></> },
            { key: 'status', label: 'Statut', render: (p: any) => <Badge status={p.status} /> },
          ]} />
          {commissions.map((c: any) => (
            <KV key={c._id} items={[['Commission', fcfa(c.amount)], ['Net professionnel', fcfa(c.professionalNet)], ['Reversement', c.payoutId ? 'Inclus dans un reversement' : 'Non reversé']]} />
          ))}
          {refunds.map((r: any) => (
            <div key={r._id} className="alert alert-warning small">Remboursement {fcfa(r.amount)} le {dateTime(r.createdAt)} par {r.byEmail} — {r.reason} (commission {fcfa(r.commissionDelta)})</div>
          ))}
        </Card>
        <Card title="Litiges">
          {disputes.length === 0 && <p className="muted">Aucun litige.</p>}
          {disputes.map((d: any) => (
            <div key={d._id} className="invoice-version">
              <div className="hstack between"><strong>{d.reason}</strong><Badge status={d.status} /></div>
              {d.resolution?.decision && <p className="small">Décision : {DISPUTE_DECISIONS[d.resolution.decision]} — {d.resolution.note}</p>}
              <Link href="/litiges">Ouvrir les litiges →</Link>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
