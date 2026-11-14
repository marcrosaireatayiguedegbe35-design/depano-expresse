'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, idempotencyKey } from '@/lib/api';
import { dateTime, fcfa, LINE_TYPES, proName, STATUS, TRADES } from '@/lib/format';
import { PageHead } from '@/components/ds';
import { StepTracker } from '@/components/tracking';
import { CallButtons } from '@/components/calls';
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

const toRad = (d: number) => (d * Math.PI) / 180;
const km = (a: [number, number], b: [number, number]) => {
  const h = Math.sin(toRad(b[1] - a[1]) / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(toRad(b[0] - a[0]) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const ago = (d: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  return s < 60 ? `il y a ${s} s` : s < 3600 ? `il y a ${Math.round(s / 60)} min` : `le ${dateTime(d)}`;
};
const ASK: Record<string, [string, string]> = {
  on_site: ['Le professionnel est-il arrivé ?', 'Il indique être arrivé chez vous. Confirmez quand vous le voyez sur place.'],
  in_progress: ['Les travaux ont-ils commencé ?', 'Il indique avoir commencé l’intervention sur votre véhicule.'],
  completed: ['Les travaux sont-ils terminés ?', 'Il indique avoir terminé. Vérifiez le véhicule avant de confirmer.'],
};

/** Suivi en direct : position du professionnel pendant le trajet, étapes à confirmer, devis et factures. */
export default function InterventionDetail({ params }: { params: { id: string } }) {
  const toast = useToast();
  const { data, error, reload } = useFetch<any>(`/interventions/${params.id}`);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, tick] = useState(0);
  const live = !!data && (['accepted', 'en_route'].includes(data.intervention.status) || !!data.intervention.awaitingConfirmation);
  // Actualisation automatique (position et étapes) tant que l'intervention est en cours.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { reload(); tick((x) => x + 1); }, 10_000);
    return () => clearInterval(t);
  }, [live, reload]);
  if (error) return <div className="screen"><PageHead title="Suivi" back="/compte/interventions" /><ErrorBox error={error} /></div>;
  if (!data) return <div className="screen"><Loading rows={3} height={160} /></div>;
  const { intervention: i, request, response, quotations, invoices, payments, review, paymentAvailable } = data;
  const p = i.professionalId;
  const paid = payments.some((x: any) => ['succeeded', 'partially_refunded'].includes(x.status));
  const reqPos: [number, number] | undefined = request?.location?.coordinates;
  const sharing = ['accepted', 'en_route'].includes(i.status) || (i.status === 'on_site' && i.awaitingConfirmation === 'on_site');
  const t = i.tracking?.lat != null && sharing ? i.tracking : null;
  const dist = t && reqPos ? km(reqPos, [t.lng, t.lat]) : null;
  const etaMin = dist != null ? Math.max(1, Math.round((dist / 25) * 60)) : response?.etaMinutes;
  const ask = i.awaitingConfirmation ? ASK[i.awaitingConfirmation] : null;

  const decide = async (decision: 'confirm' | 'reject') => {
    setBusy(true); setErr(null);
    try {
      await api(`/interventions/${i._id}/step`, { method: 'POST', body: { status: i.awaitingConfirmation, decision, ...(decision === 'reject' ? { note } : {}) } });
      toast(decision === 'confirm' ? 'Étape confirmée' : 'Le professionnel a été prévenu');
      setRejecting(false); setNote('');
      reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <PageHead title="Suivi de l’intervention" back="/compte/interventions" />

      {ask && (
        <section className="confirm-card">
          <span className="ic"><Icon name="info" /></span>
          <h2>{ask[0]}</h2>
          <p>{ask[1]}</p>
          <div className="hstack" style={{ gap: 10, marginTop: 12 }}>
            <button className="btn btn-outline grow" disabled={busy} onClick={() => setRejecting(true)}>Non, pas encore</button>
            <button className="btn btn-primary grow" disabled={busy} onClick={() => decide('confirm')}><Icon name="checkCircle" />Je confirme</button>
          </div>
          <ErrorBox error={err} />
        </section>
      )}

      {sharing && reqPos && (
        <section className="section card live-card">
          <div className="hstack between" style={{ marginBottom: 10 }}>
            <b className="live-title"><span className="live-dot" />{t ? 'Position du professionnel en direct' : 'En attente de la position du professionnel'}</b>
            {t && <span className="xs text-2">{ago(t.at)}</span>}
          </div>
          <Map center={{ lat: reqPos[1], lng: reqPos[0] }} follow={t ? { lat: t.lat, lng: t.lng, label: proName(p) } : null} height={280} />
          <div className="live-stats">
            <span><b>{dist != null ? `${dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1).replace('.', ',') + ' km'}` : '—'}</b>distance</span>
            <span><b>{etaMin ? `~${etaMin} min` : '—'}</b>arrivée estimée</span>
            <span><b>{STATUS[i.status]?.[0] ?? i.status}</b>statut</span>
          </div>
          {!t && <p className="xs text-2" style={{ marginTop: 8 }}>La position apparaît dès que le professionnel partage sa localisation depuis son téléphone.</p>}
        </section>
      )}

      <section className="section card">
        <div className="hstack" style={{ gap: 12 }}>
          <span className="list-thumb">{p?.photoUrl ? <img src={p.photoUrl} alt="" /> : <Icon name="wrench" />}</span>
          <div className="grow">
            <Link href={`/professionnels/${p?._id}`} style={{ color: 'var(--navy)', fontWeight: 700 }}>{proName(p)}</Link>
            <p className="small text-2">{TRADES[i.trade]?.label} · {i.reference}</p>
          </div>
        </div>
        {!['cancelled', 'expired'].includes(i.status) && <div style={{ marginTop: 12 }}><CallButtons interventionId={i._id} peerName={proName(p)} phone={p?.phone} /></div>}
        <p className="small" style={{ marginTop: 10, color: 'var(--navy)' }}>{i.problem}</p>
      </section>

      <section className="section card">
        <div className="sec-head ico"><h2><Icon name="clock" />Étapes</h2></div>
        {['cancelled', 'expired'].includes(i.status) ? <p className="small text-2">{STATUS[i.status]?.[0]}</p> : <StepTracker i={i} who="client" />}
      </section>

      {rejecting && (
        <Modal title="Que se passe-t-il ?" onClose={() => setRejecting(false)}>
          <div className="field"><label htmlFor="nt">Expliquez au professionnel</label>
            <textarea id="nt" required minLength={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : il n’est pas encore arrivé, je ne le vois pas." /></div>
          <p className="xs text-2">L’étape revient en arrière et le professionnel est prévenu. Notre équipe voit aussi votre réponse.</p>
          <ErrorBox error={err} />
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || note.trim().length < 3} onClick={() => decide('reject')}>Envoyer</button>
        </Modal>
      )}

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
    </div>
  );
}
