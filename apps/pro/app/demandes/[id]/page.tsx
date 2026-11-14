'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, fcfa, STATUS } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { BackButton, Blob } from '@/components/ds';
import { tradeLabel } from '@/components/pro';
import { ErrorBox, Loading, Modal, useFetch, useToast } from '@/components/ui';

const Map = dynamic(() => import('@/components/map'), { ssr: false, loading: () => <div className="skeleton" style={{ height: 200 }} /> });
const URG: Record<string, string> = { high: 'Urgent – client bloqué', normal: 'Normale', low: 'Pas pressé' };

/** Détail d'une demande reçue et réponse du professionnel. */
export default function RequestDetail({ params }: { params: { id: string } }) {
  const { data, error, reload } = useFetch<any>(`/requests/${params.id}`);
  const toast = useToast();
  const [mode, setMode] = useState<'propose' | 'decline' | 'info' | null>(null);
  const [f, setF] = useState({ etaMinutes: '30', estimatedPrice: '', message: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <div className="screen"><div className="page-head"><BackButton href="/demandes" /></div><ErrorBox error={error} /></div>;
  if (!data) return <div className="screen"><Loading rows={3} /></div>;
  const { request: q, response: r, intervention, competingProposals } = data;
  const closed = ['cancelled', 'expired'].includes(q.status) || (q.selectedProfessionalId && r.status !== 'selected');
  const canAnswer = !closed && ['pending', 'info_requested'].includes(r.status);
  const c = q.location?.coordinates;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api(`/requests/${q._id}/respond`, {
        method: 'POST',
        body: { action: mode, message: f.message || undefined, ...(mode === 'propose' ? { etaMinutes: Number(f.etaMinutes), ...(f.estimatedPrice ? { estimatedPrice: Number(f.estimatedPrice) } : {}) } : {}) },
      });
      toast(mode === 'propose' ? 'Proposition envoyée au client' : mode === 'decline' ? 'Demande déclinée' : 'Question envoyée au client');
      setMode(null);
      reload();
    } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <Blob soft />
      <div className="page-head"><BackButton href="/demandes" /><h1 className="grow">Demande</h1><span className={`badge-s ${STATUS[r.status]?.[1] ?? 'neutral'}`}>{r.status === 'pending' ? 'Nouvelle' : STATUS[r.status]?.[0]}</span></div>

      <section className="card">
        <div className="hstack" style={{ gap: 12 }}>
          <span className="list-thumb"><Icon name={iconFor(q.problem)} /></span>
          <div className="grow"><h2 style={{ fontSize: 18 }}>{q.problem}</h2><p className="small text-2">{tradeLabel(q.trade)} · {q.mode === 'grouped' ? 'Demande groupée' : 'Demande directe'}</p></div>
        </div>
        {q.description && <p className="about expanded" style={{ marginTop: 12 }}>{q.description}</p>}
        <div className="kv-list" style={{ marginTop: 12 }}>
          <div><span>Client</span><b>{q.clientId?.firstName ?? 'Client'}</b></div>
          <div><span>Véhicule</span><b>{[q.vehicle?.brand, q.vehicle?.model, q.vehicle?.year].filter(Boolean).join(' ') || '—'}</b></div>
          <div><span>Urgence</span><b style={{ color: q.urgency === 'high' ? '#d02a2a' : undefined }}>{URG[q.urgency] ?? q.urgency}</b></div>
          {q.preferredDate && <div><span>Date souhaitée</span><b>{dateTime(q.preferredDate)}</b></div>}
          <div><span>Reçue le</span><b>{dateTime(q.createdAt)}</b></div>
          {q.mode === 'grouped' && <div><span>Propositions déjà faites</span><b>{competingProposals}</b></div>}
        </div>
      </section>

      <section className="section">
        <div className="sec-head ico"><h2><Icon name="pinFill" />Lieu</h2></div>
        <p className="small" style={{ color: 'var(--navy)', marginBottom: 10 }}>{q.address}</p>
        {c && <Map center={{ lat: c[1], lng: c[0] }} height={200} />}
        {c && <a className="btn btn-light btn-sm btn-block" style={{ marginTop: 10 }} href={`https://www.google.com/maps/dir/?api=1&destination=${c[1]},${c[0]}`} target="_blank" rel="noopener noreferrer"><Icon name="gps" />Itinéraire</a>}
      </section>

      {q.photos?.length > 0 && (
        <section className="section"><div className="sec-head"><h2>Photos du client</h2></div><div className="photo-row">{q.photos.map((u: string) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="photo-th"><img src={u} alt="" /></a>)}</div></section>
      )}

      {r.status !== 'pending' && (
        <section className="section card peach">
          <h3 style={{ fontSize: 15 }}>Votre réponse</h3>
          <p className="small" style={{ marginTop: 6 }}>{STATUS[r.status]?.[0]}{r.etaMinutes ? ` · arrivée en ${r.etaMinutes} min` : ''}{r.estimatedPrice ? ` · ~${fcfa(r.estimatedPrice)}` : ''}</p>
          {r.message && <p className="small text-2" style={{ marginTop: 4 }}>« {r.message} »</p>}
        </section>
      )}

      {intervention && <Link href={`/interventions/${intervention._id}`} className="btn btn-primary btn-block section"><Icon name="wrench" />Le client vous a choisi : ouvrir l’intervention</Link>}
      {closed && !intervention && <div className="alert alert-info small section">Cette demande est close.</div>}

      {canAnswer && (
        <div className="sticky-actions">
          <button className="btn btn-outline" onClick={() => setMode('decline')}>Décliner</button>
          <button className="btn btn-primary" onClick={() => setMode('propose')}><Icon name="checkCircle" />Proposer</button>
        </div>
      )}
      {canAnswer && <button className="link center" style={{ display: 'block', margin: '10px auto 0' }} onClick={() => setMode('info')}>Demander des précisions au client</button>}

      {mode && (
        <Modal title={mode === 'propose' ? 'Votre proposition' : mode === 'decline' ? 'Décliner la demande' : 'Question au client'} onClose={() => setMode(null)}>
          <form onSubmit={send}>
            {mode === 'propose' && (
              <div className="form-grid">
                <div className="field"><label htmlFor="eta">Arrivée estimée (min)</label><input id="eta" type="number" min={5} max={2880} required value={f.etaMinutes} onChange={(e) => setF({ ...f, etaMinutes: e.target.value })} /></div>
                <div className="field"><label htmlFor="pr">Prix estimé (FCFA)</label><input id="pr" type="number" min={0} placeholder="Facultatif" value={f.estimatedPrice} onChange={(e) => setF({ ...f, estimatedPrice: e.target.value })} /></div>
              </div>
            )}
            <div className="field"><label htmlFor="msg">{mode === 'info' ? 'Votre question' : 'Message au client'}{mode !== 'info' && ' (facultatif)'}</label>
              <textarea id="msg" required={mode === 'info'} minLength={mode === 'info' ? 5 : 0} maxLength={1000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })}
                placeholder={mode === 'propose' ? 'Ex. : je peux venir avec une batterie neuve.' : mode === 'info' ? 'Ex. : le véhicule démarre-t-il en le poussant ?' : 'Ex. : indisponible aujourd’hui.'} />
            </div>
            {mode === 'propose' && <p className="xs text-2">Le prix estimé est indicatif : le montant final figurera sur la facture détaillée, validée par le client avant paiement.</p>}
            <ErrorBox error={err} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
