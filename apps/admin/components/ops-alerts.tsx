'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface OpsEvent { type: string; title: string; body?: string; count?: number; at: string }

const PREF_KEY = 'pa-admin-sound';
const readPref = () => { try { return localStorage.getItem(PREF_KEY) !== '0'; } catch { return true; } };

let ctx: AudioContext | null = null;
const audio = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
};

/**
 * Alarme forte et reconnaissable : trois salves de deux tons (onde carrée + harmonique),
 * passées dans un compresseur pour un volume maximal sans saturation.
 */
export function playAlarm(loud = true) {
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 4; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.15;
  const master = ac.createGain();
  master.gain.value = loud ? 1 : 0.5;
  comp.connect(master).connect(ac.destination);
  const t0 = ac.currentTime + 0.02;
  const tone = (freq: number, start: number, dur: number) => {
    for (const [type, mult, vol] of [['square', 1, 0.55], ['sawtooth', 2, 0.25]] as const) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq * mult, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.01);
      g.gain.setValueAtTime(vol, start + dur - 0.03);
      g.gain.linearRampToValueAtTime(0, start + dur);
      o.connect(g).connect(comp);
      o.start(start);
      o.stop(start + dur + 0.02);
    }
  };
  for (let burst = 0; burst < 3; burst++) {
    const b = t0 + burst * 0.62;
    tone(988, b, 0.16);       // si
    tone(1319, b + 0.18, 0.16); // mi aigu
    tone(1760, b + 0.36, 0.2);  // la aigu
  }
  try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([200, 100, 200, 100, 300]); } catch {}
}

/** Écoute les opérations en temps réel (SSE) avec secours par interrogation périodique. */
export function useOpsAlerts(enabled: boolean, onEvent: (e: OpsEvent) => void) {
  const [soundOn, setSoundOnState] = useState(true);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const last = useRef(new Date().toISOString());
  const cb = useRef(onEvent);
  cb.current = onEvent;
  const soundRef = useRef(true);

  useEffect(() => { const v = readPref(); setSoundOnState(v); soundRef.current = v; }, []);

  const setSoundOn = useCallback((v: boolean) => {
    setSoundOnState(v);
    soundRef.current = v;
    try { localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch {}
    if (v) audio()?.resume().catch(() => {});
  }, []);

  // Les navigateurs exigent un premier geste de l'utilisateur avant d'autoriser le son.
  useEffect(() => {
    const unlock = () => { audio()?.resume().catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handle = (e: OpsEvent) => {
      last.current = e.at > last.current ? e.at : last.current;
      setEvents((list) => [e, ...list].slice(0, 15));
      cb.current(e);
      // Les pages affichées se rechargent d'elles-mêmes (listes, chiffres, tableaux de bord).
      window.dispatchEvent(new CustomEvent('pa:ops', { detail: e }));
      if (document.hidden) document.title = `🔔 ${e.title} – Back-office`;
      if (soundRef.current) { try { playAlarm(); } catch { /* son bloqué par le navigateur */ } }
    };

    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      es = new EventSource('/api/events/stream');
      es.addEventListener('open', () => setConnected(true));
      es.addEventListener('op', (m) => { try { handle(JSON.parse((m as MessageEvent).data)); } catch {} });
      es.addEventListener('error', () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(open, 5000);
      });
    };
    open();

    // Filet de sécurité : rattrape les opérations manquées pendant une coupure.
    const poll = setInterval(async () => {
      if (es && es.readyState === EventSource.OPEN) return;
      try {
        const rows: OpsEvent[] = await api(`/events/recent?since=${encodeURIComponent(last.current)}`);
        rows.forEach((r) => handle({ ...r, title: r.title ?? 'Nouvelle opération' }));
      } catch {}
    }, 20_000);

    const onVisible = () => { if (!document.hidden) document.title = 'Back-office – Plateforme Auto'; };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      es?.close();
      clearTimeout(retry);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return { soundOn, setSoundOn, connected, events, test: () => playAlarm() };
}
