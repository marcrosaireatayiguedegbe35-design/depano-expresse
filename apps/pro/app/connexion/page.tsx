'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, safeNext } from '@/lib/api';
import { Icon } from '@/components/icons';
import { Blob, Skyline, Swoosh } from '@/components/ds';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput } from '@/components/ui';
import { VerifyCode } from '@/components/verify-code';

/** Connexion (maquette 15). */
function Login() {
  const sp = useSearchParams();
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(sp.get('next'));
  const done = async () => { await refresh(); router.replace(next); };

  if (verifyEmail) return <VerifyCode email={verifyEmail} onVerified={done} />;

  return (
    <form className="screen" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const r = await api('/auth/login', { method: 'POST', body: { email, password } });
        if (r.step === 'verify') setVerifyEmail(r.email);
        else await done();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }}>
      <Blob />
      <header className="hero-head">
        <div className="txt">
          <h1 className="title-xl">Connexion</h1>
          <p className="lead">Bon retour !</p>
          <p className="sub">Accédez à votre espace professionnel.</p>
          <Swoosh />
        </div>
        <div className="art auth-art" aria-hidden><Icon name="lockFill" /></div>
      </header>

      <div className="fcard indent">
        <div className="fcard-head"><Icon name="mail" /><label htmlFor="e">E-mail</label></div>
        <div className="finput blue"><input id="e" type="email" autoComplete="email" required placeholder="Votre e-mail" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="lock" /><label htmlFor="p">Mot de passe</label></div>
        <PasswordInput id="p" value={password} onChange={setPassword} placeholder="Votre mot de passe" blue />
      </div>
      <Link href="/mot-de-passe-oublie" className="forgot">Mot de passe oublié ?</Link>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy}><Icon name="login" />{busy ? 'Connexion…' : 'Se connecter'}</button>
      <p className="center" style={{ marginTop: 20, color: 'var(--navy)' }}>Pas encore de compte ? <Link className="link" href="/inscription">Créer un compte</Link></p>
      <Skyline />
    </form>
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
