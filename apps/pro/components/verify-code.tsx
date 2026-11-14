'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { CodeInput, ErrorBox, useCountdown } from './ui';

/** Écran « Code de vérification » (maquette) – code à 6 chiffres reçu par e-mail. */
export function VerifyCode({ email, onVerified, initialCooldown = 60, title = 'Code de vérification' }: {
  email: string; onVerified: () => void; initialCooldown?: number; title?: string;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown(initialCooldown);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/verify', { method: 'POST', body: { email, code } });
      onVerified();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const r = await api('/auth/resend', { method: 'POST', body: { email } });
      setInfo('Un nouveau code vient de vous être envoyé.');
      setLeft(r.resendInSeconds ?? 60);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form className="auth" onSubmit={submit}>
      <h1>{title}</h1>
      <p className="sub">Saisissez le code de vérification envoyé à <strong>{email}</strong>. Il est valable 10 minutes.</p>
      <CodeInput value={code} onChange={setCode} />
      {info && <div className="alert alert-success">{info}</div>}
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>{busy ? 'Vérification…' : 'Valider'}</button>
      <p className="auth-alt">
        Pas reçu de code ?{' '}
        {left > 0 ? <span className="muted">Renvoyer dans {left} s</span> : <button type="button" className="link" onClick={resend}>Renvoyer</button>}
      </p>
      <p className="auth-alt small muted">Pensez à vérifier vos courriers indésirables.</p>
    </form>
  );
}
