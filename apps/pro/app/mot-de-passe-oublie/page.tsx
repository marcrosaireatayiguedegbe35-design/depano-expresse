'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/components/session';
import { Icon } from '@/components/icons';
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
      <form className="au" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/auth/forgot', { method: 'POST', body: { email } }); setStep('reset'); }); }}>
        <div className="au-top"><button type="button" className="au-back" aria-label="Retour" onClick={() => router.push('/connexion')}><Icon name="back" /></button><h1>Mot de passe oublié</h1><span /></div>
        <h2 className="au-code-title">Réinitialisez<br />votre mot de passe</h2>
        <p className="au-note" style={{ marginBottom: 18 }}>Saisissez votre adresse e-mail : nous vous enverrons un code à 6 chiffres.</p>
        <div className="au-field"><label htmlFor="e">E-mail</label><input id="e" type="email" autoComplete="email" required placeholder="exemple@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <ErrorBox error={error} />
        <button className="au-btn" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir le code'}</button>
        <p className="au-alt"><Link href="/connexion">Retour à la connexion</Link></p>
      </form>
    );
  }

  return (
    <form className="au" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/auth/reset', { method: 'POST', body: { email, code, password } }); await refresh(); router.replace('/'); }); }}>
      <div className="au-top"><button type="button" className="au-back" aria-label="Retour" onClick={() => setStep('email')}><Icon name="back" /></button><h1>Vérification</h1><span /></div>
      <h2 className="au-code-title">Saisissez votre<br />code de vérification</h2>
      <CodeInput value={code} onChange={setCode} />
      <p className="au-note" style={{ marginBottom: 18 }}>Si un compte existe pour <b>{email}</b>, un code vient de lui être envoyé.</p>
      <div className="au-field"><label htmlFor="np">Nouveau mot de passe</label><PasswordInput id="np" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} placeholder="Nouveau mot de passe" /></div>
      <ErrorBox error={error} />
      <button className="au-btn" disabled={busy || code.length !== 6}>{busy ? 'Validation…' : 'Changer mon mot de passe'}</button>
      <button type="button" className="au-resend" onClick={() => setStep('email')}>Je n’ai pas reçu le code ? Renvoyer</button>
    </form>
  );
}
