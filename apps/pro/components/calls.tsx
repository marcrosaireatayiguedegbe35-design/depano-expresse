'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { Icon } from './icons';

type Phase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';
interface CallState { phase: Phase; id?: string; peer?: string; error?: string; startedAt?: number; muted?: boolean }
interface CallCtx { state: CallState; call: (interventionId: string, peerName: string) => Promise<void> }

const Ctx = createContext<CallCtx>({ state: { phase: 'idle' }, call: async () => {} });
export const useCall = () => useContext(Ctx);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bip de sonnerie généré par le navigateur (aucun fichier audio). */
function useRingtone() {
  const ctx = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => { if (timer.current) clearInterval(timer.current); timer.current = null; }, []);
  const start = useCallback((outgoing: boolean) => {
    stop();
    try {
      ctx.current = ctx.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = () => {
        const a = ctx.current!; const o = a.createOscillator(); const g = a.createGain();
        o.frequency.value = outgoing ? 425 : 880; g.gain.value = 0.08; o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + (outgoing ? 1 : 0.35));
      };
      beep(); timer.current = setInterval(beep, outgoing ? 4000 : 1200);
    } catch {}
    if (!outgoing) try { navigator.vibrate?.([400, 200, 400]); } catch {}
  }, [stop]);
  return { start, stop };
}

/**
 * Appels audio dans le site (WebRTC) : sonnerie des appels entrants, décrocher / refuser, écran d'appel.
 * La voix passe directement entre les deux appareils ; l'API ne sert qu'à mettre les deux navigateurs en relation.
 */
export function CallProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [state, setState] = useState<CallState>({ phase: 'idle' });
  const [incoming, setIncoming] = useState<{ id: string; offer: string; from: string; ref?: string } | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const live = useRef<string | null>(null);
  const ring = useRingtone();

  const cleanup = useCallback((phase: Phase = 'ended', error?: string) => {
    ring.stop();
    live.current = null;
    pc.current?.getSenders().forEach((s) => s.track?.stop());
    local.current?.getTracks().forEach((t) => t.stop());
    pc.current?.close(); pc.current = null; local.current = null;
    setState((s) => ({ ...s, phase, error }));
    if (phase === 'ended') setTimeout(() => setState({ phase: 'idle' }), 1800);
  }, [ring]);

  /** Prépare la connexion : micro, serveurs STUN/TURN, envoi des candidats réseau, son distant. */
  const setup = useCallback(async (callId: string) => {
    const { iceServers } = await api('/calls/ice');
    const conn = new RTCPeerConnection({ iceServers });
    pc.current = conn;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    local.current = stream;
    stream.getTracks().forEach((t) => conn.addTrack(t, stream));
    conn.ontrack = (e) => { if (audio.current) { audio.current.srcObject = e.streams[0]; audio.current.play().catch(() => {}); } };
    const pending: string[] = [];
    let flushing = false;
    const flush = async () => {
      if (flushing || !pending.length) return;
      flushing = true;
      const batch = pending.splice(0, pending.length);
      try { await api(`/calls/${callId}/candidates`, { method: 'POST', body: { candidates: batch } }); } catch {}
      flushing = false;
      if (pending.length) flush();
    };
    conn.onicecandidate = (e) => { if (e.candidate) { pending.push(JSON.stringify(e.candidate.toJSON())); setTimeout(flush, 150); } };
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') { ring.stop(); setState((s) => ({ ...s, phase: 'active', startedAt: s.startedAt ?? Date.now() })); }
      if (['failed', 'closed'].includes(conn.connectionState) && live.current === callId) {
        api(`/calls/${callId}/end`, { method: 'POST', body: { reason: 'hangup' } }).catch(() => {});
        cleanup('ended', conn.connectionState === 'failed' ? 'Connexion impossible (réseau). Essayez l’appel téléphonique.' : undefined);
      }
    };
    return conn;
  }, [cleanup, ring]);

  /** Boucle de suivi : réponse de l'appelé, candidats réseau distants, fin d'appel. */
  const watch = useCallback(async (callId: string, isCaller: boolean) => {
    let since = 0; let answered = !isCaller;
    while (live.current === callId) {
      try {
        const s = await api(`/calls/${callId}?since=${since}`);
        if (['ended', 'missed', 'declined'].includes(s.status)) {
          cleanup('ended', s.status === 'declined' ? 'Appel refusé' : s.status === 'missed' ? (isCaller ? 'Pas de réponse' : undefined) : undefined);
          return;
        }
        if (isCaller && !answered && s.answer && pc.current) {
          answered = true; ring.stop(); setState((st) => ({ ...st, phase: 'connecting' }));
          await pc.current.setRemoteDescription(JSON.parse(s.answer));
        }
        if (s.candidates?.length && pc.current?.remoteDescription) {
          for (const c of s.candidates) { try { await pc.current.addIceCandidate(JSON.parse(c)); } catch {} }
          since = s.total;
        }
      } catch {}
      await sleep(state.phase === 'active' ? 2500 : 1000);
    }
  }, [cleanup, ring, state.phase]);

  const call = useCallback(async (interventionId: string, peerName: string) => {
    if (live.current) return;
    setState({ phase: 'calling', peer: peerName });
    try {
      const tmpId = `pending-${Date.now()}`; live.current = tmpId;
      // L'identifiant d'appel n'existe qu'après l'envoi de l'offre : on prépare la connexion avec un envoi différé des candidats.
      const { iceServers } = await api('/calls/ice');
      const conn = new RTCPeerConnection({ iceServers }); pc.current = conn;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      local.current = stream; stream.getTracks().forEach((t) => conn.addTrack(t, stream));
      conn.ontrack = (e) => { if (audio.current) { audio.current.srcObject = e.streams[0]; audio.current.play().catch(() => {}); } };
      const early: string[] = []; let callId = '';
      conn.onicecandidate = (e) => {
        if (!e.candidate) return;
        const c = JSON.stringify(e.candidate.toJSON());
        if (callId) api(`/calls/${callId}/candidates`, { method: 'POST', body: { candidates: [c] } }).catch(() => {}); else early.push(c);
      };
      conn.onconnectionstatechange = () => {
        if (conn.connectionState === 'connected') { ring.stop(); setState((s) => ({ ...s, phase: 'active', startedAt: s.startedAt ?? Date.now() })); }
        if (['failed', 'closed'].includes(conn.connectionState) && live.current === callId) {
          api(`/calls/${callId}/end`, { method: 'POST', body: { reason: 'hangup' } }).catch(() => {});
          cleanup('ended', conn.connectionState === 'failed' ? 'Connexion impossible (réseau). Essayez l’appel téléphonique.' : undefined);
        }
      };
      const offer = await conn.createOffer(); await conn.setLocalDescription(offer);
      const r = await api(interventionId.startsWith('/') ? interventionId : `/interventions/${interventionId}/call`, { method: 'POST', body: { offer: JSON.stringify(conn.localDescription) } });
      callId = r.id; live.current = callId;
      if (early.length) api(`/calls/${callId}/candidates`, { method: 'POST', body: { candidates: early.splice(0) } }).catch(() => {});
      setState({ phase: 'calling', id: callId, peer: peerName });
      ring.start(true);
      watch(callId, true);
    } catch (e: any) {
      cleanup('ended', e?.name === 'NotAllowedError' ? 'Autorisez le micro pour appeler.' : e.message || 'Appel impossible');
    }
  }, [cleanup, ring, watch]);

  const accept = async () => {
    if (!incoming) return;
    const inc = incoming; setIncoming(null); ring.stop();
    live.current = inc.id;
    setState({ phase: 'connecting', id: inc.id, peer: inc.from });
    try {
      const conn = await setup(inc.id);
      await conn.setRemoteDescription(JSON.parse(inc.offer));
      const ans = await conn.createAnswer(); await conn.setLocalDescription(ans);
      await api(`/calls/${inc.id}/answer`, { method: 'POST', body: { answer: JSON.stringify(conn.localDescription) } });
      watch(inc.id, false);
    } catch (e: any) {
      api(`/calls/${inc.id}/end`, { method: 'POST', body: { reason: 'hangup' } }).catch(() => {});
      cleanup('ended', e?.name === 'NotAllowedError' ? 'Autorisez le micro pour répondre.' : e.message || 'Appel impossible');
    }
  };
  const decline = async () => {
    if (!incoming) return;
    const id = incoming.id; setIncoming(null); ring.stop();
    api(`/calls/${id}/end`, { method: 'POST', body: { reason: 'decline' } }).catch(() => {});
  };
  const hangup = () => {
    const id = state.id;
    if (id) api(`/calls/${id}/end`, { method: 'POST', body: { reason: 'hangup' } }).catch(() => {});
    cleanup('ended');
  };
  const toggleMute = () => {
    const t = local.current?.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled; setState((s) => ({ ...s, muted: !t.enabled }));
  };

  // Détection des appels entrants (toutes les 3 s, onglet visible, hors appel).
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden || live.current) return;
      try {
        const r = await api('/calls/incoming');
        if (r && !live.current) { setIncoming((cur) => (cur?.id === r.id ? cur : { id: r.id, offer: r.offer, from: r.from, ref: r.intervention?.reference })); }
        else if (!r) setIncoming(null);
      } catch {}
    };
    tick(); const t = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [enabled]);
  useEffect(() => { if (incoming) ring.start(false); else if (state.phase !== 'calling') ring.stop(); }, [incoming]); // eslint-disable-line react-hooks/exhaustive-deps

  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (state.phase !== 'active') return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [state.phase]);
  const secs = state.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0;
  const dur = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const overlay = (incoming || state.phase !== 'idle') && typeof document !== 'undefined' ? createPortal(
    <div className="call-screen" role="dialog" aria-label="Appel">
      <div className="call-avatar"><Icon name="userFill" /></div>
      <h2>{incoming ? incoming.from : state.peer}</h2>
      <p>{incoming ? `Appel entrant${incoming.ref ? ` · ${incoming.ref}` : ''}` : state.phase === 'calling' ? 'Appel en cours…' : state.phase === 'connecting' ? 'Connexion…' : state.phase === 'active' ? dur : state.error || 'Appel terminé'}</p>
      {incoming ? (
        <div className="call-actions">
          <button className="call-btn end" onClick={decline} aria-label="Refuser"><Icon name="phoneFill" /></button>
          <button className="call-btn ok" onClick={accept} aria-label="Décrocher"><Icon name="phoneFill" /></button>
        </div>
      ) : state.phase !== 'ended' ? (
        <div className="call-actions">
          <button className={`call-btn mute${state.muted ? ' on' : ''}`} onClick={toggleMute} aria-label={state.muted ? 'Réactiver le micro' : 'Couper le micro'}><Icon name={state.muted ? 'close' : 'bolt'} /><small>{state.muted ? 'Micro coupé' : 'Micro'}</small></button>
          <button className="call-btn end" onClick={hangup} aria-label="Raccrocher"><Icon name="phoneFill" /></button>
        </div>
      ) : null}
      <audio ref={audio} autoPlay playsInline />
    </div>, document.body) : <audio ref={audio} autoPlay playsInline style={{ display: 'none' }} />;

  return <Ctx.Provider value={{ state, call }}>{children}{overlay}</Ctx.Provider>;
}

/** Deux façons d'appeler (intervention ou conversation acceptée) : dans l'application (gratuit, sans forfait téléphonique) ou par le téléphone. */
export function CallButtons({ interventionId, conversationId, peerName, phone }: { interventionId?: string; conversationId?: string; peerName: string; phone?: string }) {
  const { call, state } = useCall();
  const target = conversationId ? `/conversations/${conversationId}/call` : interventionId!;
  return (
    <div className="call-choice">
      <button type="button" className="btn btn-primary" disabled={state.phase !== 'idle'} onClick={() => call(target, peerName)}><Icon name="phoneFill" />Appeler dans l’app</button>
      {phone && <a className="btn btn-outline" href={`tel:${phone}`}><Icon name="phone" />Par téléphone</a>}
    </div>
  );
}
