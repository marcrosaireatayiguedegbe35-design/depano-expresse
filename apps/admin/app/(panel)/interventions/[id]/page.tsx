'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, KV, PageHeader, ReasonModal, Table, useFetch, Loading } from '@/components/ui';
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

const STEP_LABELS: Record<string, string> = { on_site: 'Arrivée chez le client', in_progress: 'Début des travaux', completed: 'Fin des travaux' };
const ago = (d: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  return s < 60 ? `il y a ${s} s` : s < 3600 ? `il y a ${Math.round(s / 60)} min` : dateTime(d);
};

/** Carte OpenStreetMap : position en direct du professionnel (ou adresse du client). */
function LiveMap({ lat, lng }: { lat: number; lng: number }) {
  const d = 0.012;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return <iframe title="Position en direct" src={src} style={{ width: '100%', height: 260, border: 0, borderRadius: 12 }} loading="lazy" />;
}

export default function InterventionDetail({ params }: { params: { id: string } }) {
  const { data, error, reload } = useFetch<any>(`/interventions/${params.id}`);
  const can = useCan();
  const [forcing, setForcing] = useState(false);
  const live = !!data && (['accepted', 'en_route'].includes(data.intervention.status) || !!data.intervention.awaitingConfirmation);
  useEffect(() => { if (!live) return; const t = setInterval(reload, 10_000); return () => clearInterval(t); }, [live, reload]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading minHeight={320} />;
  const { intervention: i, request, quotations, invoices, approvals, disputes, payments, commissions, refunds } = data;
  const t = i.tracking?.lat != null ? i.tracking : null;
  const reqPos = request?.location?.coordinates;

  return (
    <>
      {forcing && (
        <ReasonModal title={`Valider « ${STEP_LABELS[i.awaitingConfirmation]} »`} label="Motif (ex. : client joint par téléphone, confirme l’arrivée)" confirm="Valider l’étape"
          onClose={() => setForcing(false)}
          onConfirm={async (note) => { await api(`/interventions/${i._id}/step`, { method: 'POST', body: { status: i.awaitingConfirmation, note } }); reload(); }} />
      )}
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
        <Card title="Suivi en direct">
          {i.awaitingConfirmation && (
            <div className="alert alert-warning">
              <strong>{STEP_LABELS[i.awaitingConfirmation]}</strong> déclarée par le professionnel, en attente de la confirmation du client.
              {can('disputes.resolve') && <div style={{ marginTop: 8 }}><button className="btn btn-sm" onClick={() => setForcing(true)}>Valider à la place du client</button></div>}
            </div>
          )}
          {t ? (
            <>
              <LiveMap lat={t.lat} lng={t.lng} />
              <p className="small muted" style={{ marginTop: 6 }}>Dernière position du professionnel : {ago(t.at)}{t.accuracy ? ` · précision ${t.accuracy} m` : ''}{t.speed ? ` · ${Math.round(t.speed * 3.6)} km/h` : ''} · {i.trail?.length ?? 0} points enregistrés
                {' · '}<a href={`https://www.google.com/maps/dir/?api=1&origin=${t.lat},${t.lng}${reqPos ? `&destination=${reqPos[1]},${reqPos[0]}` : ''}`} target="_blank" rel="noopener noreferrer">Ouvrir le trajet</a></p>
            </>
          ) : reqPos ? (
            <><LiveMap lat={reqPos[1]} lng={reqPos[0]} /><p className="small muted" style={{ marginTop: 6 }}>Adresse du client. Aucune position du professionnel reçue {['accepted', 'en_route'].includes(i.status) ? 'pour le moment' : '(partage réservé au trajet)'}.</p></>
          ) : <p className="muted">Pas de localisation.</p>}
          {i.confirmations?.length > 0 && (
            <ul className="timeline" style={{ marginTop: 10 }}>
              {i.confirmations.map((c: any, k: number) => (
                <li key={k}><strong>{STEP_LABELS[c.status] ?? c.status}</strong> · {c.decision === 'confirmed' ? (c.by === 'admin' ? `validée par ${c.adminEmail}` : 'confirmée par le client') : 'contestée par le client'} <span className="muted small">· {dateTime(c.at)}</span>{c.note && <div className="small">{c.note}</div>}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Historique">
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
