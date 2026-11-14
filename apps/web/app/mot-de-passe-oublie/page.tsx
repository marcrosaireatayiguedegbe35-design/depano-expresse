'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/components/session';
import { CodeInput, ErrorBox, PasswordInput } from '@/components/ui';

/** « Réinitialiser le mot de passe » puis « Code de vérification » (maquette). */
export default function ForgotPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (step === 'email') {
    return (
      <form className="auth" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/auth/forgot', { method: 'POST', body: { email } }); setStep('reset'); }); }}>
        <h1>Mot de passe oublié</h1>
        <p className="sub">Saisissez votre adresse e-mail : nous vous enverrons un code à 6 chiffres pour réinitialiser votre mot de passe.</p>
        <div className="field"><label htmlFor="e">E-mail</label><input id="e" type="email" autoComplete="email" required placeholder="Votre e-mail" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir le code'}</button>
        <p className="auth-alt"><Link href="/connexion">Retour à la connexion</Link></p>
      </form>
    );
  }

  return (
    <form className="auth" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/auth/reset', { method: 'POST', body: { email, code, password } }); await refresh(); router.replace('/compte'); }); }}>
      <h1>Code de vérification</h1>
      <p className="sub">Si un compte existe pour <strong>{email}</strong>, un code vient de lui être envoyé.</p>
      <CodeInput value={code} onChange={setCode} />
      <div className="field"><label htmlFor="np">Nouveau mot de passe</label><PasswordInput id="np" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} placeholder="Nouveau mot de passe" /></div>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>{busy ? 'Validation…' : 'Changer mon mot de passe'}</button>
      <p className="auth-alt">Pas reçu de code ? <button type="button" className="link" onClick={() => setStep('email')}>Renvoyer</button></p>
    </form>
  );
}
