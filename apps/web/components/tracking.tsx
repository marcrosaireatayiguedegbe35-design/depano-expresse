'use client';

import { Icon } from './icons';

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
