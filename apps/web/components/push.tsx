'use client';

/* Notifications sur le téléphone (Web Push) : le site demande l'autorisation, puis les notifications
   apparaissent dans la liste du téléphone même quand le site est fermé. Même fichier dans le site pro. */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from './icons';

const DISMISS_KEY = 'pa_push_later';
const LATER_MS = 5 * 86_400_000;

type State = 'unsupported' | 'ios-install' | 'default' | 'granted' | 'denied';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function pushState(): State {
  if (typeof window === 'undefined') return 'unsupported';
  if (!supported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  return Notification.permission as State;
}

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
};

/** Abonne ce navigateur et l'associe au compte connecté. */
async function subscribeDevice() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await api('/push/key');
  if (!publicKey) throw new Error('Notifications indisponibles pour le moment');
  const key = keyBytes(publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = sub.toJSON();
  await api('/push/subscribe', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
}

/** Demande l'autorisation (à appeler depuis un toucher de l'utilisateur). */
export async function enablePush(): Promise<State> {
  const p = await Notification.requestPermission();
  if (p === 'granted') await subscribeDevice();
  return p as State;
}

/** À la déconnexion : ce téléphone ne reçoit plus les notifications de ce compte. */
export async function forgetPushDevice() {
  try {
    if (!supported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
  } catch {}
}

/** Garde l'abonnement à jour quand l'autorisation est déjà donnée (connexion sur un nouvel appareil, autre compte…). */
export function usePushSync(ownerId: string | null) {
  useEffect(() => {
    if (!ownerId || pushState() !== 'granted') return;
    subscribeDevice().catch(() => {});
  }, [ownerId]);
}

/** Carte « Recevoir les notifications sur ce téléphone », affichée une fois connecté. */
export function PushPrompt({ ownerId }: { ownerId: string | null }) {
  const [state, setState] = useState<State>('unsupported');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  usePushSync(ownerId);

  useEffect(() => {
    if (!ownerId) { setShow(false); return; }
    const s = pushState();
    setState(s);
    if (s !== 'default' && s !== 'ios-install') return;
    let later = 0;
    try { later = Number(localStorage.getItem(DISMISS_KEY) ?? 0); } catch {}
    if (Date.now() - later < LATER_MS) return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, [ownerId]);

  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} };
  const enable = async () => {
    setBusy(true);
    try { const s = await enablePush(); setState(s); if (s !== 'default') setShow(false); }
    catch { setShow(false); }
    finally { setBusy(false); }
  };

  return (
    <div className="push-ask" role="dialog" aria-label="Notifications sur ce téléphone">
      <span className="ic"><Icon name="bell" /></span>
      <span className="grow">
        <b>Recevoir les notifications sur ce téléphone</b>
        {state === 'ios-install'
          ? <small>Sur iPhone : touchez <em>Partager</em> puis <em>Sur l’écran d’accueil</em>, ouvrez l’app depuis l’icône et activez les notifications.</small>
          : <small>Soyez prévenu tout de suite, même quand le site est fermé.</small>}
        <span className="row">
          {state !== 'ios-install' && <button type="button" className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>{busy ? 'Activation…' : 'Activer'}</button>}
          <button type="button" className="btn btn-outline btn-sm" onClick={close}>{state === 'ios-install' ? 'Compris' : 'Plus tard'}</button>
        </span>
      </span>
      <button type="button" className="x" onClick={close} aria-label="Fermer"><Icon name="close" /></button>
    </div>
  );
}

/** Ligne de réglage sur la page Notifications : état et bouton pour activer sur ce téléphone. */
export function PushSetting() {
  const [state, setState] = useState<State>('unsupported');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setState(pushState()); }, []);
  const enable = async () => {
    setBusy(true);
    try { setState(await enablePush()); } catch { /* état inchangé */ } finally { setBusy(false); }
  };
  const text: Record<State, string> = {
    granted: 'Activées : vous êtes prévenu même quand le site est fermé.',
    default: 'Soyez prévenu tout de suite, même quand le site est fermé.',
    denied: 'Bloquées dans le navigateur : autorisez-les dans les réglages du site (icône du cadenas), puis rechargez la page.',
    'ios-install': 'Sur iPhone : touchez Partager puis « Sur l’écran d’accueil », ouvrez l’app depuis l’icône et activez-les ici.',
    unsupported: 'Ce navigateur ne permet pas les notifications sur le téléphone.',
  };
  return (
    <div className={`push-set${state === 'granted' ? ' on' : ''}`}>
      <span className="ic"><Icon name="bell" /></span>
      <span className="grow"><b>Notifications sur ce téléphone</b><small>{text[state]}</small></span>
      {state === 'default' && <button type="button" className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>{busy ? '…' : 'Activer'}</button>}
      {state === 'granted' && <span className="pill-on"><Icon name="checkCircle" />Actif</span>}
    </div>
  );
}
