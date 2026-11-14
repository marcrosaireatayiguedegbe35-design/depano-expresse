'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { date, dateTime, fcfa, LINE_TYPES, STATUS } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { BackButton, Blob, SecHead } from '@/components/ds';
import { Line, LinesEditor, PhotoPicker, tradeLabel } from '@/components/pro';
import { LiveLocationSharer, StepTracker } from '@/components/tracking';
import { ErrorBox, Loading, Modal, StarRow, useFetch, useToast } from '@/components/ui';

const Map = dynamic(() => import('@/components/map'), { ssr: false, loading: () => <div className="skeleton" style={{ height: 180 }} /> });
const NEXT_LABEL: Record<string, [string, string]> = {
  en_route: ['Je suis en route', 'truckFast'], on_site: ['Je suis arrivé', 'pinFill'], in_progress: ['Commencer l’intervention', 'wrench'], completed: ['Terminer l’intervention', 'checkCircle'],
};
const emptyLine = (): Line => ({ type: 'labor', label: '', quantity: 1, unitPrice: 0 });

function InvoiceView({ inv }: { inv: any }) {
  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="hstack between"><b>{inv.number} · v{inv.version}</b><span className={`badge-s ${STATUS[inv.status]?.[1] ?? 'neutral'}`}>{STATUS[inv.status]?.[0]}</span></div>
      {inv.changeReason && <p className="xs text-2" style={{ marginTop: 4 }}>Motif de la version : {inv.changeReason}</p>}
      <div style={{ marginTop: 8 }}>{inv.lines.map((l: any, k: number) => <div key={k} className="inv-line"><span>{l.label}<small>{LINE_TYPES[l.type]} · {l.quantity} × {fcfa(l.unitPrice)}</small></span><b>{fcfa(l.total)}</b></div>)}</div>
      <div className="total-line" style={{ marginTop: 8 }}><span>Total client</span><span className="price">{fcfa(inv.total)}</span></div>
      {inv.commissionAmount !== undefined && inv.commissionAmount !== null && (
        <div className="kv-list" style={{ marginTop: 8 }}>
          <div><span>Commission plateforme</span><b>− {fcfa(inv.commissionAmount)}</b></div>
          <div><span>Votre net</span><b style={{ color: 'var(--green)' }}>{fcfa(inv.professionalNet)}</b></div>
        </div>
      )}
    </div>
  );
}

/** Suivi d'une intervention : étapes, contact client, devis, facture, paiement et avis. */
export default function InterventionDetail({ params }: { params: { id: string } }) {
  const { data, error, reload } = useFetch<any>(`/interventions/${params.id}`);
  const toast = useToast();
  const [form, setForm] = useState<'quote' | 'invoice' | null>(null);
  const [q, setQ] = useState({ kind: 'initial', diagnosis: '', plannedWork: '', lines: [emptyLine()] });
  const [inv, setInv] = useState({ diagnosis: '', workDone: '', observations: '', changeReason: '', lines: [emptyLine()], before: [] as string[], after: [] as string[], replacedParts: [] as string[] });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = data && (['accepted', 'en_route'].includes(data.intervention.status) || data.intervention.awaitingConfirmation);
  // Actualisation automatique pendant le trajet et tant qu'une confirmation du client est attendue.
  useEffect(() => { if (!live) return; const t = setInterval(reload, 12_000); return () => clearInterval(t); }, [live, reload]);
  if (error) return <div className="screen"><div className="page-head"><BackButton href="/interventions" /></div><ErrorBox error={error} /></div>;
  if (!data) return <div className="screen"><Loading rows={4} /></div>;
  const { intervention: i, request, quotations, invoices, dispute, review, payment } = data;
  const next: string[] = i.awaitingConfirmation ? [] : data.next;
  const sharing = ['accepted', 'en_route'].includes(i.status) || (i.status === 'on_site' && i.awaitingConfirmation === 'on_site');
  const lastConf = (i.confirmations ?? [])[(i.confirmations ?? []).length - 1];
  const lastReject = lastConf?.decision === 'rejected' ? lastConf : null;
  const current = invoices.find((x: any) => String(x._id) === String(i.currentInvoiceId)) ?? invoices[0];
  const newVersionAllowed = current?.status === 'contested' && dispute?.status === 'resolved' && dispute.resolution?.decision === 'request_new_version';
  const canInvoice = ['on_site', 'in_progress', 'completed', 'contested'].includes(i.status) && (!current || newVersionAllowed);
  const pendingQuote = quotations.some((x: any) => x.status === 'pending');
  const c = request?.location?.coordinates;

  const advance = async (status: string) => {
    try { await api(`/interventions/${i._id}/status`, { method: 'POST', body: { status } }); toast(STATUS[status]?.[0] ?? 'Étape enregistrée'); reload(); }
    catch (e: any) { toast(e.message, 'danger'); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (form === 'quote') {
        await api(`/interventions/${i._id}/quotations`, { method: 'POST', body: { kind: quotations.length ? 'supplement' : q.kind, diagnosis: q.diagnosis, plannedWork: q.plannedWork, lines: q.lines } });
        toast('Devis envoyé au client');
      } else {
        await api(`/interventions/${i._id}/invoices`, {
          method: 'POST',
          body: {
            diagnosis: inv.diagnosis, workDone: inv.workDone, observations: inv.observations || undefined, lines: inv.lines,
            photos: { before: inv.before, after: inv.after, replacedParts: inv.replacedParts }, ...(newVersionAllowed ? { changeReason: inv.changeReason } : {}),
          },
        });
        toast('Facture envoyée au client pour confirmation');
      }
      setForm(null);
      reload();
    } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <Blob soft />
      <div className="page-head"><BackButton href="/interventions" /><h1 className="grow">{i.reference}</h1><span className={`badge-s ${STATUS[i.status]?.[1] ?? 'neutral'}`}>{STATUS[i.status]?.[0]}</span></div>

      <section className="card">
        <div className="hstack" style={{ gap: 12 }}>
          <span className="list-thumb"><Icon name={iconFor(i.problem ?? '')} /></span>
          <div className="grow"><h2 style={{ fontSize: 18 }}>{i.problem}</h2><p className="small text-2">{tradeLabel(i.trade)} · {date(i.createdAt)}</p></div>
        </div>
        {request?.description && <p className="about expanded" style={{ marginTop: 10 }}>{request.description}</p>}
        <div className="kv-list" style={{ marginTop: 10 }}>
          <div><span>Véhicule</span><b>{[request?.vehicle?.brand, request?.vehicle?.model, request?.vehicle?.year].filter(Boolean).join(' ') || '—'}</b></div>
          <div><span>Client</span><b>{[i.clientId?.firstName, i.clientId?.lastName].filter(Boolean).join(' ') || '—'}</b></div>
        </div>
      </section>

      {i.status !== 'cancelled' && (
        <section className="section card">
          <div className="sec-head ico"><h2><Icon name="clock" />Suivi des étapes</h2></div>
          <StepTracker i={i} />
        </section>
      )}

      <section className="section stack" style={{ gap: 10 }}>
        <LiveLocationSharer interventionId={i._id} active={sharing} />
        {i.awaitingConfirmation && (
          <div className="await-box"><Icon name="clock" /><span><b>En attente de la confirmation du client</b><small>Le client doit confirmer « {STATUS[i.awaitingConfirmation]?.[0]} » avant que vous puissiez passer à l’étape suivante. Cette page se met à jour automatiquement.</small></span></div>
        )}
        {lastReject && !i.awaitingConfirmation && (
          <div className="alert alert-info small">Le client a contesté l’étape « {STATUS[lastReject.status]?.[0]} » : {lastReject.note}</div>
        )}
        {(request?.phone || i.clientId?.phone) && <a className="btn btn-outline btn-block" href={`tel:${request?.phone || i.clientId?.phone}`}><Icon name="phoneFill" />Appeler le client</a>}
        {next.map((s: string) => (
          <button key={s} className="btn btn-primary btn-block" onClick={() => advance(s)}><Icon name={NEXT_LABEL[s]?.[1] ?? 'check'} />{NEXT_LABEL[s]?.[0] ?? s}</button>
        ))}
      </section>

      <section className="section">
        <div className="sec-head ico"><h2><Icon name="pinFill" />Lieu d’intervention</h2></div>
        <p className="small" style={{ color: 'var(--navy)', marginBottom: 10 }}>{i.address}</p>
        {c && <Map center={{ lat: c[1], lng: c[0] }} height={180} />}
        {c && <a className="btn btn-light btn-sm btn-block" style={{ marginTop: 10 }} href={`https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`} target="_blank" rel="noopener noreferrer"><Icon name="gps" />Itinéraire</a>}
      </section>

      <section className="section">
        <SecHead title="Devis" icon="clipboard" right={!['completed', 'cancelled'].includes(i.status) && !pendingQuote ? <button className="see-all pill" onClick={() => setForm('quote')}><Icon name="plus" />{quotations.length ? 'Devis complémentaire' : 'Créer un devis'}</button> : undefined} />
        {quotations.length === 0 ? <p className="small text-2">Aucun devis. Facultatif : utile avant des travaux importants.</p> : quotations.map((x: any) => (
          <div key={x._id} className="card" style={{ marginBottom: 10 }}>
            <div className="hstack between"><b>{x.kind === 'supplement' ? 'Devis complémentaire' : 'Devis'} · {fcfa(x.total)}</b><span className={`badge-s ${x.status === 'accepted' ? 'success' : x.status === 'rejected' ? 'neutral' : 'warning'}`}>{x.status === 'accepted' ? 'Accepté' : x.status === 'rejected' ? 'Refusé' : 'En attente du client'}</span></div>
            <p className="small text-2" style={{ marginTop: 4 }}>{x.plannedWork}</p>
          </div>
        ))}
      </section>

      <section className="section">
        <SecHead title="Facture" icon="docFill" right={canInvoice ? <button className="see-all pill" onClick={() => setForm('invoice')}><Icon name="plus" />{newVersionAllowed ? 'Nouvelle version' : 'Créer la facture'}</button> : undefined} />
        {!current ? <p className="small text-2">{canInvoice ? 'Rédigez la facture détaillée : le client la confirme avant de payer.' : 'La facture se crée une fois arrivé sur place.'}</p> : <InvoiceView inv={current} />}
        {dispute && (
          <div className="alert alert-info small" style={{ marginTop: 10 }}>
            <b>Contestation du client :</b> {dispute.reason}
            {dispute.status === 'resolved' && <><br /><b>Décision de l’équipe :</b> {dispute.resolution?.decision === 'request_new_version' ? 'nouvelle version de facture demandée' : dispute.resolution?.decision === 'dismiss' ? 'contestation rejetée' : 'intervention annulée'}{dispute.resolution?.note ? ` – ${dispute.resolution.note}` : ''}</>}
          </div>
        )}
        {payment && <div className="card peach hstack" style={{ marginTop: 10, gap: 10 }}><span className="list-thumb" style={{ width: 40, height: 40, color: 'var(--green)' }}><Icon name="checkCircle" /></span><span className="grow small" style={{ color: 'var(--navy)' }}>Paiement reçu le {date(payment.paidAt)} · {fcfa(payment.amount)}</span></div>}
      </section>

      {review && (
        <section className="section">
          <SecHead title="Avis du client" icon="star" />
          <div className="review"><span className="who"><Icon name="userFill" /></span><div className="grow"><StarRow value={review.rating} />{review.comment && <p className="small" style={{ marginTop: 4 }}>{review.comment}</p>}<span className="xs text-2">{date(review.createdAt)}</span></div></div>
        </section>
      )}

      <section className="section">
        <SecHead title="Historique" icon="clock" />
        <ul className="timeline-v">{[...i.timeline].reverse().map((t: any, n: number) => <li key={n}>{STATUS[t.status]?.[0] ?? t.status}{t.note ? ` – ${t.note}` : ''}<small>{dateTime(t.at)}</small></li>)}</ul>
      </section>

      {form && (
        <Modal title={form === 'quote' ? 'Nouveau devis' : newVersionAllowed ? 'Nouvelle version de facture' : 'Facture détaillée'} onClose={() => setForm(null)}>
          <form onSubmit={submit}>
            {form === 'quote' ? (
              <>
                <div className="field"><label htmlFor="dg">Diagnostic</label><textarea id="dg" required minLength={3} value={q.diagnosis} onChange={(e) => setQ({ ...q, diagnosis: e.target.value })} /></div>
                <div className="field"><label htmlFor="pw">Travaux prévus</label><textarea id="pw" required minLength={3} value={q.plannedWork} onChange={(e) => setQ({ ...q, plannedWork: e.target.value })} /></div>
                <LinesEditor lines={q.lines} onChange={(lines) => setQ({ ...q, lines })} />
              </>
            ) : (
              <>
                {newVersionAllowed && <div className="field"><label htmlFor="cr">Motif de la nouvelle version</label><input id="cr" required minLength={5} value={inv.changeReason} onChange={(e) => setInv({ ...inv, changeReason: e.target.value })} /></div>}
                <div className="field"><label htmlFor="d2">Diagnostic</label><textarea id="d2" required minLength={3} value={inv.diagnosis} onChange={(e) => setInv({ ...inv, diagnosis: e.target.value })} /></div>
                <div className="field"><label htmlFor="wd">Travaux réalisés</label><textarea id="wd" required minLength={3} value={inv.workDone} onChange={(e) => setInv({ ...inv, workDone: e.target.value })} /></div>
                <div className="field"><label htmlFor="ob">Observations (facultatif)</label><input id="ob" value={inv.observations} onChange={(e) => setInv({ ...inv, observations: e.target.value })} /></div>
                <LinesEditor lines={inv.lines} onChange={(lines) => setInv({ ...inv, lines })} />
                <div className="stack" style={{ marginTop: 14 }}>
                  <PhotoPicker label="Photos avant" folder="invoices" value={inv.before} onChange={(v) => setInv({ ...inv, before: v })} />
                  <PhotoPicker label="Photos après" folder="invoices" value={inv.after} onChange={(v) => setInv({ ...inv, after: v })} />
                  <PhotoPicker label="Pièces remplacées" folder="invoices" value={inv.replacedParts} onChange={(v) => setInv({ ...inv, replacedParts: v })} />
                </div>
              </>
            )}
            <ErrorBox error={err} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Envoi…' : form === 'quote' ? 'Envoyer le devis' : 'Envoyer la facture au client'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
