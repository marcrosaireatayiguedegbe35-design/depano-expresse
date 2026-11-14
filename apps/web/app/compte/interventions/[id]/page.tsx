'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { api, idempotencyKey } from '@/lib/api';
import { dateTime, fcfa, LINE_TYPES, proName, STATUS, TRADES } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { Badge, ErrorBox, Loading, Modal, useFetch, useToast } from '@/components/ui';
import { Icon } from '@/components/icons';

const Map = dynamic(() => import('@/components/map'), { ssr: false, loading: () => <div className="skeleton" style={{ height: 300 }} /> });

const STEPS = [
  ['accepted', 'Professionnel confirmé'],
  ['en_route', 'En route vers vous'],
  ['on_site', 'Arrivé sur place'],
  ['in_progress', 'Travaux en cours'],
  ['completed', 'Travaux terminés'],
] as const;

/** Compte à rebours circulaire (maquette « Delivery map »). */
function Timer({ value, label, progress }: { value: string; label: string; progress: number }) {
  const r = 70, C = 2 * Math.PI * r;
  return (
    <div className="timer">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--peach)" strokeWidth="9" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--orange)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${C * progress} ${C}`} />
      </svg>
      <div className="timer-txt"><b>{value}</b><span>{label}</span></div>
    </div>
  );
}

function Invoice({ inv, onChange, paymentAvailable }: { inv: any; onChange: () => void; paymentAvailable: boolean }) {
  const toast = useToast();
  const [contesting, setContesting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payKey] = useState(idempotencyKey);
  const act = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true);
    setError(null);
    try { await fn(); toast(msg); onChange(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="card" style={inv.status === 'superseded' ? { opacity: .6 } : undefined}>
      <div className="hstack between">
        <h3>Facture {inv.number}{inv.version > 1 && <span className="muted small"> · v{inv.version}</span>}</h3>
        <Badge status={inv.status} />
      </div>
      {inv.changeReason && <div className="alert alert-info small">Nouvelle version : {inv.changeReason}</div>}
      <dl className="kv" style={{ margin: '12px 0' }}>
        <div><dt>Problème constaté</dt><dd>{inv.problem}</dd></div>
        <div><dt>Diagnostic</dt><dd>{inv.diagnosis}</dd></div>
        <div><dt>Travaux effectués</dt><dd>{inv.workDone}</dd></div>
      </dl>
      {inv.lines.map((l: any, i: number) => (
        <div key={i} className="order-item" style={{ padding: '8px 0' }}>
          <div className="grow"><b style={{ fontWeight: 500 }}>{l.label}</b><p className="xs muted">{LINE_TYPES[l.type]} · {l.quantity} × {fcfa(l.unitPrice)}</p></div>
          <span className="price">{fcfa(l.total ?? l.quantity * l.unitPrice)}</span>
        </div>
      ))}
      <div className="total-line"><span>Total à payer</span><span className="price-lg">{fcfa(inv.total)}</span></div>
      {inv.observations && <p className="small muted">Observations : {inv.observations}</p>}
      {(inv.photos?.before?.length || inv.photos?.after?.length || inv.photos?.replacedParts?.length) ? (
        <div className="hscroll" style={{ marginTop: 6 }}>
          {[...(inv.photos.before ?? []), ...(inv.photos.after ?? []), ...(inv.photos.replacedParts ?? [])].map((u: string) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="list-thumb"><img src={u} alt="Justificatif" /></a>
          ))}
        </div>
      ) : null}
      <ErrorBox error={error} />

      {inv.status === 'submitted' && (
        <>
          <div className="alert alert-warning small">Vérifiez la facture : aucun paiement n’est possible avant votre confirmation. Le professionnel ne peut pas confirmer à votre place.</div>
          <div className="hstack">
            <button className="btn btn-outline grow" disabled={busy} onClick={() => setContesting(true)}>Contester</button>
            <button className="btn btn-primary grow" disabled={busy} onClick={() => {
              if (confirm(`Confirmez-vous les travaux décrits et le montant de ${fcfa(inv.total)} ?`)) act(() => api(`/invoices/${inv._id}/confirm`, { method: 'POST' }), 'Montant confirmé');
            }}>Confirmer</button>
          </div>
        </>
      )}
      {inv.status === 'contested' && <div className="alert alert-danger small">Facture contestée : paiement suspendu. Notre équipe examine le dossier.</div>}
      {inv.status === 'approved' && <button className="btn btn-primary btn-block" onClick={() => setPaying(true)}>Payer {fcfa(inv.total)}</button>}
      {inv.status === 'paid' && <div className="alert alert-success small">Facture payée. Merci !</div>}

      {contesting && (
        <Modal title="Contester la facture" onClose={() => setContesting(false)}>
          <p className="small muted">Expliquez ce qui ne correspond pas à l’intervention ou au prix convenu. Le paiement sera suspendu et notre équipe traitera le litige.</p>
          <div className="field mt"><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif" minLength={10} placeholder="Motif de la contestation" /></div>
          <ErrorBox error={error} />
          <button className="btn btn-primary btn-block" disabled={busy || reason.trim().length < 10} onClick={() => act(async () => { await api(`/invoices/${inv._id}/contest`, { method: 'POST', body: { reason } }); setContesting(false); }, 'Facture contestée')}>Envoyer la contestation</button>
        </Modal>
      )}
      {paying && (
        <Modal title={`Payer ${fcfa(inv.total)}`} onClose={() => setPaying(false)}>
          {!paymentAvailable ? (
            <div className="alert alert-info">Le paiement Mobile Money en ligne arrive très bientôt. Vous pouvez régler directement le professionnel en attendant.</div>
          ) : (
            <>
              <div className="alert alert-warning small">Environnement de test : paiement simulé, aucun débit réel.</div>
              <label className="radio-row"><input type="radio" defaultChecked /><span className="grow">📱 Mobile Money</span></label>
              <ErrorBox error={error} />
              <button className="btn btn-primary btn-block mt" disabled={busy} onClick={() => act(async () => {
                await api(`/invoices/${inv._id}/pay`, { method: 'POST', body: { method: 'mobile_money' }, headers: { 'Idempotency-Key': payKey } });
                setPaying(false);
              }, 'Paiement confirmé')}>Payer {fcfa(inv.total)}</button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function ReviewForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card mt center">
      <h3>Comment s’est passée l’intervention ?</h3>
      <div className="hstack" style={{ justifyContent: 'center', margin: '10px 0' }} role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} étoile${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}
            style={{ border: 0, background: 'none', fontSize: 34, cursor: 'pointer', color: n <= rating ? 'var(--star)' : '#e3e3e8', padding: 0 }}>★</button>
        ))}
      </div>
      <div className="field"><textarea rows={3} placeholder="Votre commentaire (facultatif)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Commentaire" /></div>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" onClick={async () => {
        try { await api(`/interventions/${id}/review`, { method: 'POST', body: { rating, ...(comment ? { comment } : {}) } }); onDone(); } catch (e: any) { setError(e.message); }
      }}>Publier mon avis</button>
    </div>
  );
}

/** Suivi d'intervention (maquette « Delivery map » : carte, minuteur, statut) + devis et factures. */
export default function InterventionDetail({ params }: { params: { id: string } }) {
  const toast = useToast();
  const { data, error, reload } = useFetch<any>(`/interventions/${params.id}`);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const { intervention: i, request, response, quotations, invoices, payments, review, paymentAvailable } = data;
  const p = i.professionalId;
  const paid = payments.some((x: any) => ['succeeded', 'partially_refunded'].includes(x.status));
  const stepIndex = STEPS.findIndex(([k]) => k === i.status);
  const reqPos = request?.location?.coordinates;
  const proPos = p?.location?.coordinates;
  const eta = response?.etaMinutes;
  const cancelled = ['cancelled', 'contested', 'expired'].includes(i.status);
  const timerValue = i.status === 'completed' ? '✓' : eta && stepIndex <= 1 ? String(eta) : `${Math.max(1, stepIndex + 1)}/${STEPS.length}`;
  const timerLabel = i.status === 'completed' ? 'terminé' : eta && stepIndex <= 1 ? 'min d’arrivée' : 'étape';

  return (
    <>
      <PageTitle title="Suivi de l’intervention" back="/compte/interventions" />
      {reqPos && (
        <div className="track-map">
          <Map center={{ lat: reqPos[1], lng: reqPos[0] }} pros={proPos ? [p] : []} height={300} />
        </div>
      )}
      {!cancelled && <Timer value={timerValue} label={timerLabel} progress={i.status === 'completed' ? 1 : (stepIndex + 1) / STEPS.length} />}

      <div className="center" style={{ marginBottom: 18 }}>
        <p className="small muted">{proName(p)} · {TRADES[i.trade]?.label}</p>
        <h2>{cancelled ? STATUS[i.status]?.[0] : i.status === 'completed' ? 'Travaux terminés' : STEPS[Math.max(0, stepIndex)]?.[1]}</h2>
        <p className="xs muted">{i.reference} · {i.problem}</p>
      </div>

      <div className="card">
        <div className="hstack">
          <span className="list-thumb" style={{ width: 52, height: 52, background: "var(--peach)" }}>{TRADES[i.trade]?.icon}</span>
          <div className="grow"><Link href={`/professionnels/${p?._id}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>{proName(p)}</Link><p className="small muted">{p?.commune}</p></div>
          {p?.phone && <a className="icon-btn" href={`tel:${p.phone}`} aria-label="Appeler" style={{ background: 'var(--orange)', color: '#fff' }}><Icon name="phone" /></a>}
        </div>
        <ul className="steps-v" style={{ marginTop: 14 }}>
          {STEPS.map(([k, label], idx) => {
            const at = i.timeline?.find((t: any) => t.status === k)?.at;
            const state = cancelled ? '' : idx < stepIndex || i.status === 'completed' ? 'done' : idx === stepIndex ? 'now' : '';
            return <li key={k} className={state}><i>{state === 'done' ? '✓' : ''}</i><span className="grow">{label}{at && <span className="xs muted"> · {dateTime(at)}</span>}</span></li>;
          })}
        </ul>
      </div>

      {quotations.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Devis</h2></div>
          {quotations.map((q: any) => (
            <div key={q._id} className="card">
              <div className="hstack between"><b style={{ fontWeight: 600 }}>{q.kind === 'supplement' ? 'Devis complémentaire' : 'Devis'}</b><span className="price-lg" style={{ fontSize: 17 }}>{fcfa(q.total)}</span></div>
              <p className="small muted" style={{ margin: '4px 0 10px' }}>{q.diagnosis} — {q.plannedWork}</p>
              {q.status === 'pending' ? (
                <div className="hstack">
                  <button className="btn btn-outline btn-sm grow" onClick={async () => { await api(`/quotations/${q._id}/reject`, { method: 'POST' }); toast('Devis refusé'); reload(); }}>Refuser</button>
                  <button className="btn btn-primary btn-sm grow" onClick={async () => { await api(`/quotations/${q._id}/accept`, { method: 'POST' }); toast('Devis accepté'); reload(); }}>Accepter</button>
                </div>
              ) : <Badge status={q.status === 'accepted' ? 'completed' : 'rejected'}>{q.status === 'accepted' ? 'Accepté' : 'Refusé'}</Badge>}
            </div>
          ))}
          <p className="xs muted" style={{ marginTop: 8 }}>Les travaux ne commencent qu’après votre accord ; tout supplément nécessite un nouveau devis.</p>
        </section>
      )}

      <section className="section">
        <div className="section-head"><h2>Factures</h2></div>
        {invoices.length === 0 ? <p className="small muted">La facture détaillée vous sera envoyée à la fin des travaux.</p>
          : [...invoices].reverse().map((inv: any) => <Invoice key={inv._id} inv={inv} onChange={reload} paymentAvailable={paymentAvailable} />)}
      </section>

      {paid && !review && <ReviewForm id={i._id} onDone={() => { toast('Merci pour votre avis !'); reload(); }} />}
      {review && <div className="alert alert-success">Votre avis : <span className="star">{'★'.repeat(review.rating)}</span> {review.comment}</div>}
    </>
  );
}
