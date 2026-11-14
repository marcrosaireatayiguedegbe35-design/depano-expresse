'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from './icons';
import { CodeInput, ErrorBox, useCountdown } from './ui';

const mask = (email: string) => {
  const [u, d] = email.split('@');
  return `${u.slice(0, Math.min(4, Math.max(1, u.length - 1)))}*****@${d ?? ''}`;
};

/** Écran « Vérification » : code à 6 chiffres reçu par e-mail, valable 10 minutes. */
export function VerifyCode({ email, onVerified, onBack, initialCooldown = 60 }: {
  email: string; onVerified: () => void; onBack?: () => void; initialCooldown?: number; title?: string;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown(initialCooldown);
  const [validity, setValidity] = useState(600);
  useEffect(() => { const t = setInterval(() => setValidity((v) => Math.max(0, v - 1)), 1000); return () => clearInterval(t); }, []);
  const mmss = `${String(Math.floor(validity / 60)).padStart(2, '0')}:${String(validity % 60).padStart(2, '0')}`;

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
      setValidity(600);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form className="au" onSubmit={submit}>
      <div className="au-top">
        <button type="button" className="au-back" aria-label="Retour" onClick={() => (onBack ? onBack() : history.back())}><Icon name="back" /></button>
        <h1>Vérification</h1>
        <span />
      </div>
      <h2 className="au-code-title">Saisissez votre<br />code de vérification</h2>
      <CodeInput value={code} onChange={setCode} />
      <p className="au-timer">{validity > 0 ? mmss : 'Code expiré : demandez-en un nouveau'}</p>
      <p className="au-note">Nous avons envoyé un code de vérification à votre adresse <b>{mask(email)}</b>. Consultez votre boîte de réception (et les courriers indésirables).</p>
      <button type="button" className="au-resend" disabled={left > 0} onClick={resend}>
        {left > 0 ? `Je n’ai pas reçu le code ? Renvoyer dans ${left} s` : 'Je n’ai pas reçu le code ? Renvoyer'}
      </button>
      {info && <div className="alert alert-success small">{info}</div>}
      <ErrorBox error={error} />
      <button className="au-btn" disabled={busy || code.length !== 6}>{busy ? 'Vérification…' : 'Vérifier'}</button>
    </form>
  );
}
