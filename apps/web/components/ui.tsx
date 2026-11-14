'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { STATUS } from '@/lib/format';
import { Icon } from './icons';

/* ---------- Données ---------- */

export function useFetch<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  // Rechargement automatique à l'arrivée d'une notification (réponse d'un pro, facture…).
  useEffect(() => {
    const on = () => { reload(); };
    window.addEventListener('pa:live', on);
    return () => window.removeEventListener('pa:live', on);
  }, [reload]);
  return { data, error, loading, reload };
}

/* ---------- Notifications éphémères ---------- */

type Toast = { id: number; text: string; tone: 'success' | 'danger' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.title) push(`🔔 ${d.title}`); };
    window.addEventListener('pa:live', on);
    return () => window.removeEventListener('pa:live', on);
  }, [push]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Éléments de base ---------- */

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const [label, tone] = (status && STATUS[status]) || [status ?? '—', 'neutral'];
  return <span className={`badge badge-${tone}`}>{children ?? label}</span>;
}

export function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="alert alert-danger" role="alert">{error}</div>;
}

export function Loading({ rows = 3, height = 110 }: { rows?: number; height?: number; text?: string }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height }} />)}
    </div>
  );
}

export function Empty({ icon = 'search', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-art" style={{ width: 170, height: 150, margin: '16px auto 6px' }}><Icon name={icon} /></div>
      <h2>{title}</h2>
      {children && <div className="text-2" style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

/** Étoiles de notation (pleines, demi et vides), d'après une note réelle. */
export function StarRow({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`Note ${value.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} style={{ position: 'relative', display: 'inline-block', width: 18, height: 18 }}>
            <Icon name="star" className="" />
            <span style={{ position: 'absolute', inset: 0, color: '#e3e6ec', clipPath: `inset(0 0 0 ${fill * 100}%)` }}><Icon name="star" /></span>
          </span>
        );
      })}
    </span>
  );
}

export function Stars({ value, count }: { value?: number; count?: number }) {
  if (!count) return <span className="small muted">Nouveau</span>;
  return <span className="hstack" style={{ gap: 4 }}><Icon name="star" className="star" /><b style={{ color: 'var(--navy)' }}>{value?.toFixed(1)}</b><span className="muted">({count} avis)</span></span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="back-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Champ mot de passe avec bouton « œil ». */
export function PasswordInput({ id, value, onChange, placeholder = 'Mot de passe', autoComplete = 'current-password', minLength, blue }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; minLength?: number; blue?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`finput pw${blue ? ' blue' : ''}`}>
      <input id={id} type={show ? 'text' : 'password'} required minLength={minLength} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={show}>
        <Icon name={show ? 'eye' : 'eyeOff'} />
      </button>
    </div>
  );
}

/** Code de vérification à 6 chiffres (cases séparées, collage accepté). */
export function CodeInput({ value, onChange, autoFocus = true }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const setAt = (i: number, d: string) => { const arr = [...digits]; arr[i] = d; onChange(arr.join('').slice(0, 6)); };
  return (
    <div className="otp" role="group" aria-label="Code à 6 chiffres">
      {digits.map((d, i) => (
        <input
          key={i} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6}
          aria-label={`Chiffre ${i + 1}`} autoFocus={autoFocus && i === 0} value={d}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) { onChange(v.slice(0, 6)); refs.current[Math.min(v.length, 5)]?.focus(); return; }
            setAt(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) { setAt(i - 1, ''); refs.current[i - 1]?.focus(); } }}
        />
      ))}
    </div>
  );
}

export function useCountdown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft] as const;
}
