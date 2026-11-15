'use client';

import { useSearchParams } from 'next/navigation';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { api, idempotencyKey } from '@/lib/api';
import { dateTime, fcfa, LINE_TYPES, proName, STATUS, TRADES } from '@/lib/format';
import { Icon } from '@/components/icons';
import { BackButton, PageHead } from '@/components/ds';
import { StepTracker } from '@/components/tracking';
import { CallButtons } from '@/components/calls';
import { ErrorBox, Loading, Modal, useFetch, useToast } from '@/components/ui';
import { LogoLoading } from '@/components/brand-loader';
import { OPERATORS, OperatorLogo } from '@/components/operators';

const Map = dynamic(() => import('@/components/map'), { ssr: false, loading: () => <LogoLoading logo="/images/brand/embleme-depanno.png" label="Chargement de la carte" minHeight={260} /> });
const STEPS = ['Arrivée', 'Sur place', 'Travaux', 'Facture', 'Paiement'];
const toRad = (d: number) => (d * Math.PI) / 180;
const km = (a: [number, number], b: [number, number]) => {
  const h = Math.sin(toRad(b[1] - a[1]) / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(toRad(b[0] - a[0]) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const ago = (d: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  return s < 60 ? `il y a ${s} s` : s < 3600 ? `il y a ${Math.round(s / 60)} min` : `le ${dateTime(d)}`;
};

/** Écran courant du client, calculé à partir de l'état de l'intervention. */
function screenOf(i: any, inv: any, payment: any, paid: boolean) {
  if (['cancelled', 'expired'].includes(i.status)) return { key: 'cancelled', step: 0 };
  if (i.awaitingConfirmation) return { key: `confirm_${i.awaitingConfirmation}`, step: { on_site: 0, in_progress: 1, completed: 2 }[i.awaitingConfirmation as string] ?? 0 };
  if (['accepted', 'en_route'].includes(i.status)) return { key: 'coming', step: 0 };
  if (i.status === 'on_site') return { key: 'onsite', step: 1 };
  if (i.status === 'in_progress' && !inv) return { key: 'working', step: 2 };
  if (inv?.status === 'contested' || i.status === 'contested') return { key: 'contested', step: 3 };
  if (i.status === 'in_progress') return { key: 'working', step: 2 };
  if (inv?.status === 'submitted') return { key: 'invoice', step: 3 };
  if (inv?.status === 'approved') return { key: payment?.method === 'cash' && payment.status === 'pending' ? 'cash' : 'pay', step: 4 };
  if (paid) return { key: 'done', step: 4 };
  return { key: 'working', step: 2 };
}

/** Intervention côté client, une étape par écran : arrivée du pro, confirmations, facture, paiement, avis. */
function InterventionFlow({ params }: { params: { id: string } }) {
  const toast = useToast();
  const { data, error, reload } = useFetch<any>(`/interventions/${params.id}`);
  const [modal, setModal] = useState<'reject' | 'contest' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [payKey] = useState(idempotencyKey);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [, tick] = useState(0);
  const active = !!data && !['cancelled', 'expired'].includes(data.intervention.status) && !data.payments.some((x: any) => x.status === 'succeeded');
  // Actualisation : toutes les 4 s quand on attend le professionnel (trajet, confirmation), 8 s sinon,
  // et immédiatement quand le client revient sur l'application.
  const waiting = !!data && (['accepted', 'en_route'].includes(data.intervention.status) || !!data.intervention.awaitingConfirmation);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { reload(); tick((x) => x + 1); }, waiting ? 4000 : 8000);
    const back = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', back);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', back); };
  }, [active, waiting, reload]);
  if (error && !data) return <div className="screen"><PageHead title="Suivi" back="/compte/interventions" /><ErrorBox error={error} /></div>;
  if (!data) return <div className="screen"><Loading rows={3} height={160} /></div>;
  const { intervention: i, request, response, invoices, payments, review, paymentAvailable } = data;
  const p = i.professionalId;
  const inv = [...invoices].reverse().find((x: any) => x.status !== 'superseded');
  const payment = [...payments].reverse()[0];
  const paid = payments.some((x: any) => ['succeeded', 'partially_refunded'].includes(x.status));
  const sc = screenOf(i, inv, payment, paid);
  const reqPos: [number, number] | undefined = request?.location?.coordinates;
  const t = i.tracking?.lat != null && ['accepted', 'en_route'].includes(i.status) ? i.tracking : null;
  const dist = t && reqPos ? km(reqPos, [t.lng, t.lat]) : null;
  const eta = dist != null ? Math.max(1, Math.round((dist / 25) * 60)) : response?.etaMinutes;
  const name = proName(p);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true); setErr(null);
    try { await fn(); toast(msg); setModal(null); setNote(''); await reload(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const step = (decision: 'confirm' | 'reject') => run(() => api(`/interventions/${i._id}/step`, { method: 'POST', body: { status: i.awaitingConfirmation, decision, ...(decision === 'reject' ? { note } : {}) } }), decision === 'confirm' ? 'Merci, étape confirmée' : 'Le professionnel a été prévenu');

  const liveMap = reqPos && (
    <div className="card live-card" style={{ padding: 8 }}>
      <Map center={{ lat: reqPos[1], lng: reqPos[0] }} follow={t ? { lat: t.lat, lng: t.lng, label: name } : null} height={300} zoom={15} centerLabel="Chez vous" />
      <div className="live-stats">
        <span><b>{dist != null ? (dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1).replace('.', ',')} km`) : '—'}</b>distance</span>
        <span><b>{eta ? `~${eta} min` : '—'}</b>arrivée</span>
        <span><b>{t ? ago(t.at) : '—'}</b>position</span>
      </div>
    </div>
  );
  const invoiceView = inv && (
    <div className="card">
      <div className="hstack between"><b>Facture {inv.number}{inv.version > 1 ? ` · v${inv.version}` : ''}</b><span className={`badge-s ${STATUS[inv.status]?.[1] ?? 'neutral'}`}>{STATUS[inv.status]?.[0]}</span></div>
      {inv.changeReason && <p className="xs text-2" style={{ marginTop: 4 }}>Correction : {inv.changeReason}</p>}
      <p className="small" style={{ marginTop: 8 }}><b>Diagnostic :</b> {inv.diagnosis}</p>
      <p className="small"><b>Travaux :</b> {inv.workDone}</p>
      <div style={{ marginTop: 8 }}>{inv.lines.map((l: any, k: number) => <div key={k} className="inv-line"><span>{l.label}<small>{LINE_TYPES[l.type]} · {l.quantity} × {fcfa(l.unitPrice)}</small></span><b>{fcfa(l.total ?? l.quantity * l.unitPrice)}</b></div>)}</div>
      <div className="total-line" style={{ marginTop: 8 }}><span>Total à payer</span><span className="price">{fcfa(inv.total)}</span></div>
      {[...(inv.photos?.before ?? []), ...(inv.photos?.after ?? [])].length > 0 && (
        <div className="photo-row" style={{ marginTop: 10 }}>{[...(inv.photos.before ?? []), ...(inv.photos.after ?? [])].map((u: string) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="photo-th"><img src={u} alt="" /></a>)}</div>
      )}
    </div>
  );
  const confirmPair = (yes: string) => (
    <div className="flow-pair">
      <button className="btn btn-outline" disabled={busy} onClick={() => setModal('reject')}>Non, pas encore</button>
      <button className="btn btn-primary" disabled={busy} onClick={() => step('confirm')}><Icon name="checkCircle" />{yes}</button>
    </div>
  );

  const screens: Record<string, { icon: string; title: string; text: string; body?: React.ReactNode; action?: React.ReactNode }> = {
    coming: { icon: 'truckFast', title: i.status === 'accepted' ? `${name} se prépare` : `${name} arrive`, text: i.status === 'accepted' ? 'Il a accepté votre demande et va partir. Vous verrez sa position dès qu’il sera en route.' : 'Suivez son arrivée en direct sur la carte.', body: liveMap },
    confirm_on_site: { icon: 'pinFill', title: 'Le professionnel est-il arrivé ?', text: 'Il indique être arrivé chez vous. Confirmez quand vous le voyez.', action: confirmPair('Oui, il est là') },
    onsite: { icon: 'wrench', title: 'Il examine votre véhicule', text: 'Il va bientôt commencer les travaux.' },
    confirm_in_progress: { icon: 'wrench', title: 'Les travaux ont-ils commencé ?', text: 'Il indique avoir commencé l’intervention sur votre véhicule.', action: confirmPair('Oui, c’est commencé') },
    working: { icon: 'wrench', title: 'Travaux en cours', text: 'Le professionnel travaille sur votre véhicule. Il vous enverra ensuite la facture détaillée.' },
    confirm_completed: { icon: 'checkCircle', title: 'Les travaux sont-ils terminés ?', text: 'Vérifiez votre véhicule avant de confirmer.', action: confirmPair('Oui, c’est terminé') },
    invoice: {
      icon: 'docFill', title: 'Vérifiez la facture', text: 'Acceptez-la pour passer au paiement, ou contestez-la si elle ne correspond pas au travail réalisé.', body: invoiceView,
      action: <div className="flow-pair"><button className="btn btn-outline" disabled={busy} onClick={() => setModal('contest')}>Contester</button><button className="btn btn-primary" disabled={busy} onClick={() => run(() => api(`/invoices/${inv._id}/confirm`, { method: 'POST' }), 'Facture acceptée')}><Icon name="checkCircle" />Accepter</button></div>,
    },
    contested: { icon: 'info', title: 'Facture contestée', text: 'Le professionnel peut corriger sa facture ; sinon notre équipe tranchera le litige. Vous serez prévenu.', body: invoiceView },
    pay: {
      icon: 'cardFill', title: `Payer ${fcfa(inv?.total)}`, text: 'Choisissez votre mode de paiement.', body: invoiceView,
      action: (
        <div className="pay-choice">
          <button className="pay-opt" disabled={busy} onClick={() => run(() => api(`/invoices/${inv._id}/pay`, { method: 'POST', body: { method: 'cash' }, headers: { 'Idempotency-Key': `${payKey}-cash` } }), 'Remettez l’argent au professionnel')}>
            <span className="ic"><Icon name="cardFill" /></span><span className="grow"><b>En espèces</b><small>Je paie le professionnel en main propre</small></span><Icon name="chevR" />
          </button>
          <button className="pay-opt" disabled={busy || !paymentAvailable} onClick={() => run(() => api(`/invoices/${inv._id}/pay`, { method: 'POST', body: { method: 'mobile_money' }, headers: { 'Idempotency-Key': payKey } }), 'Paiement confirmé')}>
            <span className="ic"><Icon name="phoneFill" /></span><span className="grow"><b>Mobile Money</b><small className="pay-ops"><span className="op-logos">{OPERATORS.map((o) => <OperatorLogo key={o.id} id={o.id} size={20} />)}</span>{paymentAvailable ? 'MTN, Moov, Celtiis' : 'Bientôt disponible'}</small></span><Icon name="chevR" />
          </button>
        </div>
      ),
    },
    cash: { icon: 'cardFill', title: `Remettez ${fcfa(inv?.total)} au professionnel`, text: 'Payez-le en espèces. Il confirmera la réception, et l’intervention sera clôturée.', body: invoiceView },
    done: {
      icon: 'checkCircle', title: 'Merci, c’est terminé !', text: `Intervention payée${payment?.method === 'cash' ? ' en espèces' : ''}. Votre avis aide les autres clients.`,
      body: review
        ? <div className="card center"><b>Votre avis</b><p style={{ color: 'var(--star)', fontSize: 22 }}>{'★'.repeat(review.rating)}</p>{review.comment && <p className="small">{review.comment}</p>}</div>
        : (
          <div className="card center">
            <b>Notez {name}</b>
            <div className="hstack" style={{ justifyContent: 'center', margin: '8px 0' }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} étoiles`} onClick={() => setRating(n)} style={{ border: 0, background: 'none', fontSize: 34, color: n <= rating ? 'var(--star)' : '#e3e3e8', padding: 0 }}>★</button>)}</div>
            <textarea className="svc-desc" style={{ minHeight: 70 }} placeholder="Votre commentaire (facultatif)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={() => run(() => api(`/interventions/${i._id}/review`, { method: 'POST', body: { rating, ...(comment ? { comment } : {}) } }), 'Merci pour votre avis !')}>Publier mon avis</button>
          </div>
        ),
    },
    cancelled: { icon: 'close', title: 'Intervention annulée', text: 'Cette intervention a été annulée.' },
  };
  const s = screens[sc.key] ?? screens.working;

  return (
    <div className="screen tk">
      <section className="tk-hero">
        <div className="tk-top"><BackButton href="/compte/interventions" /><span>{TRADES[i.trade]?.label ?? 'Intervention'} · {i.reference}</span></div>
        <Link href={`/professionnel?id=${p?._id}`} className="tk-who">
          <span className="tk-av">{p?.photoUrl ? <img src={p.photoUrl} alt="" /> : (name[0] ?? '?')}</span>
          <span className="grow"><b>{name}</b><small>{i.problem}</small></span>
          <Icon name="chevR" />
        </Link>
        {sc.key !== 'cancelled' && <ol className="tk-steps">{STEPS.map((l, n) => <li key={l} className={n < sc.step ? 'done' : n === sc.step ? 'now' : ''}><span>{n < sc.step ? <Icon name="check" /> : n + 1}</span>{l}</li>)}</ol>}
      </section>

      <section className="tk-card" key={sc.key}>
        <span className="tk-ic"><Icon name={s.icon} /></span>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        {s.body && <div className="tk-body">{s.body}</div>}
        {err && <ErrorBox error={err} />}
        {s.action && <div className="tk-action">{s.action}</div>}
      </section>

      {!['done', 'cancelled'].includes(sc.key) && (
        <section className="tk-contact"><p>Contacter {name}</p><CallButtons interventionId={i._id} peerName={name} phone={p?.phone} /></section>
      )}

      <section className="tk-more">
        <button onClick={() => setDetails(!details)}><Icon name="clipboard" /><span className="grow">Détails de l’intervention</span><Icon name={details ? 'chevD' : 'chevR'} /></button>
        {details && <div className="tk-more-body"><StepTracker i={i} who="client" /></div>}
      </section>

      {modal && (
        <Modal title={modal === 'reject' ? 'Que se passe-t-il ?' : 'Contester la facture'} onClose={() => setModal(null)}>
          <div className="field"><label htmlFor="nt">{modal === 'reject' ? 'Expliquez au professionnel' : 'Ce qui ne va pas'}</label>
            <textarea id="nt" minLength={modal === 'contest' ? 10 : 3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={modal === 'reject' ? 'Ex. : il n’est pas encore là.' : 'Ex. : le déplacement n’était pas prévu.'} /></div>
          {modal === 'contest' && <p className="xs text-2">Le paiement est suspendu. Le professionnel peut corriger sa facture ; sinon notre équipe tranche.</p>}
          <ErrorBox error={err} />
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy || note.trim().length < (modal === 'contest' ? 10 : 3)}
            onClick={() => (modal === 'reject' ? step('reject') : run(() => api(`/invoices/${inv._id}/contest`, { method: 'POST', body: { reason: note } }), 'Contestation envoyée'))}>Envoyer</button>
        </Modal>
      )}
    </div>
  );
}

/** Adresse statique (hébergement Cloudflare Pages) : l'identifiant arrive dans l'adresse sous la forme ?id=… */
function FromQuery() {
  const id = useSearchParams().get('id') ?? '';
  return <InterventionFlow key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense><FromQuery /></Suspense>;
}
