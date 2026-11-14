'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from './icons';

/**
 * Partage la position GPS du professionnel pendant le trajet (envoi au plus toutes les 10 s).
 * Fonctionne tant que la page reste ouverte sur le téléphone (limite des sites web).
 */
export function LiveLocationSharer({ interventionId, active }: { interventionId: string; active: boolean }) {
  const [state, setState] = useState<'off' | 'asking' | 'on' | 'denied' | 'unsupported'>('off');
  const [last, setLast] = useState<{ at: Date; accuracy?: number } | null>(null);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!active || !enabled) return;
    if (!('geolocation' in navigator)) { setState('unsupported'); return; }
    setState('asking');
    watch.current = navigator.geolocation.watchPosition(
      async (p) => {
        setState('on');
        const now = Date.now();
        if (now - lastSent.current < 10_000) return;
        lastSent.current = now;
        try {
          const r = await api(`/interventions/${interventionId}/location`, {
            method: 'POST',
            body: {
              lat: p.coords.latitude, lng: p.coords.longitude,
              ...(p.coords.accuracy != null ? { accuracy: Math.round(p.coords.accuracy) } : {}),
              ...(p.coords.heading != null && !Number.isNaN(p.coords.heading) ? { heading: Math.round(p.coords.heading) } : {}),
              ...(p.coords.speed != null && !Number.isNaN(p.coords.speed) ? { speed: Math.round(p.coords.speed) } : {}),
            },
          });
          if (r.sharing) setLast({ at: new Date(), accuracy: p.coords.accuracy });
        } catch {}
      },
      (e) => setState(e.code === e.PERMISSION_DENIED ? 'denied' : 'asking'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; };
  }, [active, enabled, interventionId]);

  if (!active) return null;
  return (
    <div className={`live-share ${state}`}>
      <span className="pulse" aria-hidden />
      <div className="grow">
        <b>{!enabled ? 'Partage de position en pause' : state === 'on' ? 'Position partagée avec le client' : state === 'denied' ? 'Localisation refusée' : state === 'unsupported' ? 'Localisation indisponible' : 'Activation de la localisation…'}</b>
        <small>
          {!enabled ? 'Le client ne voit plus votre avancée.'
            : state === 'denied' ? 'Autorisez la localisation pour ce site dans les réglages du navigateur, puis rechargez.'
            : state === 'on' && last ? `Dernier envoi ${last.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}${last.accuracy ? ` · précision ${Math.round(last.accuracy)} m` : ''}. Gardez cette page ouverte.`
            : 'Gardez cette page ouverte pendant le trajet.'}
        </small>
      </div>
      <button type="button" className="see-all pill" onClick={() => setEnabled(!enabled)}><Icon name={enabled ? 'close' : 'gps'} />{enabled ? 'Pause' : 'Reprendre'}</button>
    </div>
  );
}

const STEP_DEF: [string, string, string][] = [
  ['accepted', 'Intervention acceptée', 'Le client vous a choisi'],
  ['en_route', 'En route', 'Position partagée pendant le trajet'],
  ['on_site', 'Arrivé chez le client', 'Confirmation du client requise'],
  ['in_progress', 'Travaux commencés', 'Confirmation du client requise'],
  ['completed', 'Travaux terminés', 'Confirmation du client requise'],
];

/** Étapes de l'intervention avec l'état de confirmation par le client. */
export function StepTracker({ i, who = 'pro' }: { i: any; who?: 'pro' | 'client' }) {
  const order = STEP_DEF.map((s) => s[0]);
  const cur = Math.max(0, order.indexOf(i.status));
  const at = (k: string) => [...(i.timeline ?? [])].reverse().find((t: any) => t.status === k && t.by !== 'client' && t.by !== 'admin')?.at;
  const conf = (k: string) => [...(i.confirmations ?? [])].reverse().find((c: any) => c.status === k);
  const fmt = (d?: string) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
  return (
    <ul className="step-list">
      {STEP_DEF.map(([k, label, hint], n) => {
        const waiting = i.awaitingConfirmation === k;
        const c = conf(k);
        const state = n < cur || (n === cur && !waiting) ? 'done' : waiting ? 'wait' : '';
        const sub = waiting
          ? (who === 'pro' ? 'En attente de la confirmation du client' : 'À confirmer par vous')
          : c && c.decision === 'confirmed' && n <= cur ? `${c.by === 'admin' ? 'Validé par l’administration' : 'Confirmé par le client'} · ${fmt(c.at)}`
          : n <= cur && at(k) ? fmt(at(k)) : hint;
        return (
          <li key={k} className={state}>
            <span className="dot">{state === 'done' ? <Icon name="check" /> : state === 'wait' ? <Icon name="clock" /> : n + 1}</span>
            <span><b>{label}</b><small>{sub}</small></span>
          </li>
        );
      })}
    </ul>
  );
}
