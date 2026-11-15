'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { date, dateTime, fcfa, LINE_TYPES, STATUS } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { BackButton } from '@/components/ds';
import { Line, LinesEditor, PhotoPicker, tradeLabel } from '@/components/pro';
import { LiveLocationSharer, StepTracker } from '@/components/tracking';
import { CallButtons } from '@/components/calls';
import { ErrorBox, Loading, StarRow, useFetch, useToast } from '@/components/ui';
import { LogoLoading } from '@/components/brand-loader';

const Map = dynamic(() => import('@/components/map'), { ssr: false, loading: () => <LogoLoading logo="/images/brand/embleme-depanno.png" label="Chargement de la carte" minHeight={240} /> });
const STEPS = ['Départ', 'Trajet', 'Sur place', 'Travaux', 'Facture', 'Paiement'];
const emptyLine = (): Line => ({ type: 'labor', label: '', quantity: 1, unitPrice: 0 });

/** Écran courant de l'intervention, calculé à partir de son état. */
function screenOf(i: any, inv: any, payment: any) {
  if (i.status === 'cancelled') return { key: 'cancelled', step: 0 };
  if (i.awaitingConfirmation) return { key: 'wait', step: { on_site: 2, in_progress: 3, completed: 3 }[i.awaitingConfirmation as string] ?? 2 };
  if (i.status === 'accepted') return { key: 'go', step: 0 };
  if (i.status === 'en_route') return { key: 'route', step: 1 };
  if (i.status === 'on_site') return { key: 'onsite', step: 2 };
  if (i.status === 'in_progress' && !inv) return { key: 'work', step: 3 };
  if (inv?.status === 'contested' || i.status === 'contested') return { key: 'contested', step: 4 };
  if (i.status === 'in_progress') return { key: 'finish', step: 3 };
  if (inv?.status === 'submitted') return { key: 'billing', step: 4 };
  if (inv?.status === 'approved') return { key: payment?.method === 'cash' && payment.status === 'pending' ? 'cash' : 'topay', step: 5 };
  if (inv?.status === 'paid') return { key: 'done', step: 5 };
  return { key: 'billing', step: 4 };
}

/** Intervention côté professionnel, une étape par écran : départ, trajet, sur place, travaux, facture, paiement. */
export default function InterventionFlow({ params }: { params: { id: string } }) {
  const { data, error, reload } = useFetch<any>(`/interventions/${params.id}`);
  const toast = useToast();
  const [inv, setInv] = useState({ diagnosis: '', workDone: '', observations: '', changeReason: '', lines: [emptyLine()], before: [] as string[], after: [] as string[], replacedParts: [] as string[] });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  // Actualisation automatique tant que l'intervention n'est pas payée (confirmations et paiement du client).
  const active = !!data && data.intervention.status !== 'cancelled' && !data.invoices.some((x: any) => x.status === 'paid');
  useEffect(() => { if (!active) return; const t = setInterval(reload, 8000); return () => clearInterval(t); }, [active, reload]);
  if (error) return <div className="screen"><div className="page-head"><BackButton href="/interventions" /></div><ErrorBox error={error} /></div>;
  if (!data) return <div className="screen"><Loading rows={4} /></div>;
  const { intervention: i, request, invoices, dispute, review, payment } = data;
  const current = invoices.find((x: any) => String(x._id) === String(i.currentInvoiceId)) ?? invoices[0];
  const sc = screenOf(i, current, payment);
  const c = request?.location?.coordinates;
  const clientName = [i.clientId?.firstName, i.clientId?.lastName].filter(Boolean).join(' ') || 'Client';
  const phone = request?.phone || i.clientId?.phone;
  const route = c ? `https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}&travelmode=driving` : null;

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true); setErr(null);
    try { await fn(); toast(msg); reload(); window.scrollTo({ top: 0 }); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const advance = (status: string, msg: string) => run(() => api(`/interventions/${i._id}/status`, { method: 'POST', body: { status } }), msg);
  const sendInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => api(`/interventions/${i._id}/invoices`, {
      method: 'POST',
      body: { diagnosis: inv.diagnosis, workDone: inv.workDone, observations: inv.observations || undefined, lines: inv.lines, photos: { before: inv.before, after: inv.after, replacedParts: inv.replacedParts }, ...(sc.key === 'contested' ? { changeReason: inv.changeReason } : {}) },
    }), sc.key === 'contested' ? 'Facture corrigée envoyée au client' : 'Facture enregistrée');
  };

  const invoiceForm = (
    <form onSubmit={sendInvoice} className="flow-form">
      {sc.key === 'contested' && <div className="field"><label htmlFor="cr">Ce que vous corrigez</label><input id="cr" required minLength={5} value={inv.changeReason} onChange={(e) => setInv({ ...inv, changeReason: e.target.value })} placeholder="Ex. : retrait du déplacement" /></div>}
      <div className="field"><label htmlFor="d2">Diagnostic</label><textarea id="d2" required minLength={3} value={inv.diagnosis} onChange={(e) => setInv({ ...inv, diagnosis: e.target.value })} /></div>
      <div className="field"><label htmlFor="wd">Travaux réalisés</label><textarea id="wd" required minLength={3} value={inv.workDone} onChange={(e) => setInv({ ...inv, workDone: e.target.value })} /></div>
      <LinesEditor lines={inv.lines} onChange={(lines) => setInv({ ...inv, lines })} />
      <div className="stack" style={{ marginTop: 14 }}>
        <PhotoPicker label="Photos avant" folder="invoices" value={inv.before} onChange={(v) => setInv({ ...inv, before: v })} />
        <PhotoPicker label="Photos après" folder="invoices" value={inv.after} onChange={(v) => setInv({ ...inv, after: v })} />
      </div>
      <ErrorBox error={err} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Envoi…' : sc.key === 'contested' ? 'Envoyer la facture corrigée' : 'Enregistrer la facture'}</button>
    </form>
  );

  const invoiceView = current && (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="hstack between"><b>{current.number} · v{current.version}</b><span className={`badge-s ${STATUS[current.status]?.[1] ?? 'neutral'}`}>{STATUS[current.status]?.[0]}</span></div>
      <div style={{ marginTop: 8 }}>{current.lines.map((l: any, k: number) => <div key={k} className="inv-line"><span>{l.label}<small>{LINE_TYPES[l.type]} · {l.quantity} × {fcfa(l.unitPrice)}</small></span><b>{fcfa(l.total)}</b></div>)}</div>
      <div className="total-line" style={{ marginTop: 8 }}><span>Total client</span><span className="price">{fcfa(current.total)}</span></div>
      {current.professionalNet != null && <div className="kv-list" style={{ marginTop: 8 }}><div><span>Commission plateforme</span><b>− {fcfa(current.commissionAmount)}</b></div><div><span>Votre net</span><b style={{ color: 'var(--green)' }}>{fcfa(current.professionalNet)}</b></div></div>}
    </div>
  );

  const screens: Record<string, { icon: string; title: string; text: string; body?: React.ReactNode; action?: React.ReactNode }> = {
    go: {
      icon: 'truckFast', title: 'Préparez votre départ', text: `${clientName} vous attend : ${i.problem}.`,
      body: <>{c && <Map center={{ lat: c[1], lng: c[0] }} height={220} />}<p className="flow-addr"><Icon name="pinFill" />{i.address}</p></>,
      action: <button className="btn btn-primary btn-block" disabled={busy} onClick={() => advance('en_route', 'Bonne route ! Votre position est partagée.')}><Icon name="truckFast" />Je pars maintenant</button>,
    },
    route: {
      icon: 'gps', title: 'En route vers le client', text: 'Suivez l’itinéraire. Votre position est partagée en direct avec le client.',
      body: <>{c && <Map center={{ lat: c[1], lng: c[0] }} height={240} />}<p className="flow-addr"><Icon name="pinFill" />{i.address}</p>{route && <a className="btn btn-light btn-block" href={route} target="_blank" rel="noopener noreferrer"><Icon name="gps" />Ouvrir l’itinéraire (GPS)</a>}</>,
      action: <button className="btn btn-primary btn-block" disabled={busy} onClick={() => advance('on_site', 'Arrivée signalée au client')}><Icon name="pinFill" />Je suis arrivé</button>,
    },
    wait: {
      icon: 'clock', title: 'En attente du client', text: `Le client doit confirmer « ${STATUS[i.awaitingConfirmation]?.[0] ?? ''} ». L’écran avance tout seul dès sa réponse.`,
    },
    onsite: {
      icon: 'checkCircle', title: 'Arrivée confirmée', text: 'Le client a confirmé votre arrivée. Examinez le véhicule puis commencez.',
      action: <button className="btn btn-primary btn-block" disabled={busy} onClick={() => advance('in_progress', 'Début des travaux signalé')}><Icon name="wrench" />Commencer les travaux</button>,
    },
    work: { icon: 'wrench', title: 'Travaux en cours', text: 'Une fois le travail fait, rédigez la facture détaillée : le client la vérifiera avant de payer.', body: invoiceForm },
    finish: {
      icon: 'docFill', title: 'Facture prête', text: 'Déclarez la fin des travaux : le client confirmera puis validera la facture.', body: invoiceView,
      action: <button className="btn btn-primary btn-block" disabled={busy} onClick={() => advance('completed', 'Fin des travaux signalée au client')}><Icon name="checkCircle" />J’ai terminé</button>,
    },
    billing: { icon: 'docFill', title: 'Le client vérifie la facture', text: 'Il peut l’accepter ou la contester. Vous serez prévenu.', body: invoiceView },
    contested: {
      icon: 'info', title: 'Facture contestée', text: `Motif du client : « ${dispute?.reason ?? '—'} ». Corrigez la facture, ou laissez l’administration trancher le litige.`,
      body: <>{invoiceView}<h3 className="flow-sub">Corriger la facture</h3>{invoiceForm}</>,
    },
    topay: { icon: 'cardFill', title: 'Facture acceptée', text: 'Le client choisit son mode de paiement (espèces ou Mobile Money).', body: invoiceView },
    cash: {
      icon: 'cardFill', title: `Encaissez ${fcfa(current?.total)} en espèces`, text: 'Le client a choisi de vous payer en espèces. Confirmez seulement après avoir reçu l’argent.', body: invoiceView,
      action: <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run(() => api(`/invoices/${current._id}/cash-received`, { method: 'POST' }), 'Paiement en espèces confirmé')}><Icon name="checkCircle" />J’ai reçu {fcfa(current?.total)}</button>,
    },
    done: {
      icon: 'checkCircle', title: 'Intervention terminée et payée', text: payment?.method === 'cash' ? 'Payée en espèces : la commission de la plateforme vous sera demandée.' : 'Votre part nette vous sera reversée sur votre compte Mobile Money.',
      body: <>{invoiceView}{review && <div className="review" style={{ marginTop: 12 }}><span className="who"><Icon name="userFill" /></span><div className="grow"><StarRow value={review.rating} />{review.comment && <p className="small" style={{ marginTop: 4 }}>{review.comment}</p>}<span className="xs text-2">{date(review.createdAt)}</span></div></div>}</>,
    },
    cancelled: { icon: 'close', title: 'Intervention annulée', text: 'Cette intervention a été annulée.' },
  };
  const s = screens[sc.key];

  return (
    <div className="screen tk">
      <section className="tk-hero">
        <div className="tk-top"><BackButton href="/interventions" /><span>{tradeLabel(i.trade)} · {i.reference}</span></div>
        <div className="tk-who">
          <span className="tk-av">{(clientName[0] ?? '?').toUpperCase()}</span>
          <span className="grow"><b>{clientName}</b><small>{i.problem}{i.address ? ` · ${i.address}` : ''}</small></span>
        </div>
        {sc.key !== 'cancelled' && <ol className="tk-steps">{STEPS.map((l, n) => <li key={l} className={n < sc.step ? 'done' : n === sc.step ? 'now' : ''}><span>{n < sc.step ? <Icon name="check" /> : n + 1}</span>{l}</li>)}</ol>}
      </section>

      <section className="tk-card">
        <span className="tk-ic"><Icon name={s.icon} /></span>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        {s.body && <div className="tk-body">{s.body}</div>}
        {(sc.key === 'route' || sc.key === 'go' || (sc.key === 'wait' && i.awaitingConfirmation === 'on_site')) && <div className="tk-body"><LiveLocationSharer interventionId={i._id} active={sc.key !== 'go'} /></div>}
        {err && sc.key !== 'work' && sc.key !== 'contested' && <ErrorBox error={err} />}
        {s.action && <div className="tk-action">{s.action}</div>}
      </section>

      {!['done', 'cancelled'].includes(sc.key) && (
        <section className="tk-contact"><p>Contacter {clientName}</p><CallButtons interventionId={i._id} peerName={clientName} phone={phone} /></section>
      )}

      <section className="tk-more">
        <button onClick={() => setDetails(!details)}><Icon name="clipboard" /><span className="grow">Détails de l’intervention</span><Icon name={details ? 'chevD' : 'chevR'} /></button>
        {details && (
          <div className="tk-more-body">
            {request?.description && <p className="small text-2">{request.description}</p>}
            <div className="kv-list" style={{ marginTop: 10 }}>
              <div><span>Véhicule</span><b>{[request?.vehicle?.brand, request?.vehicle?.model, request?.vehicle?.year].filter(Boolean).join(' ') || '—'}</b></div>
              <div><span>Client</span><b>{clientName}</b></div>
              <div><span>Adresse</span><b>{i.address}</b></div>
            </div>
            <div style={{ marginTop: 14 }}><StepTracker i={i} /></div>
            <ul className="timeline-v" style={{ marginTop: 10 }}>{[...i.timeline].reverse().map((t: any, n: number) => <li key={n}>{STATUS[t.status]?.[0] ?? t.status}{t.note ? ` – ${t.note}` : ''}<small>{dateTime(t.at)}</small></li>)}</ul>
          </div>
        )}
      </section>
      <span hidden>{iconFor('')}</span>
    </div>
  );
}
