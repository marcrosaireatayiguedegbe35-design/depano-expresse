'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, safeNext } from '@/lib/api';
import { IMAGES } from '@/lib/images';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput } from '@/components/ui';
import { VerifyCode } from '@/components/verify-code';

/** Connexion client (modèle épuré : illustration, titre centré, champs gris clair, bouton orange). */
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

  if (verifyEmail) return <VerifyCode email={verifyEmail} onVerified={done} onBack={() => setVerifyEmail(null)} />;

  return (
    <form className="au" onSubmit={async (e) => {
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
      <img className="au-illus" src={IMAGES.brand.full} alt="Depanno Expresse" />
      <h1 className="au-title" style={{ marginTop: 0 }}>Connexion</h1>
      <p className="au-lead">Bon retour !</p>
      <p>Connectez-vous à votre compte</p>
      <div className="au-field"><label htmlFor="e">E-mail</label><input id="e" type="email" autoComplete="email" required placeholder="exemple@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="au-field"><label htmlFor="p">Mot de passe</label><PasswordInput id="p" value={password} onChange={setPassword} placeholder="Votre mot de passe" /></div>
      <Link href="/mot-de-passe-oublie" className="au-forgot">Mot de passe oublié ?</Link>
      <ErrorBox error={error} />
      <button className="au-btn" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      <p className="au-alt">Pas encore de compte ? <Link href={`/inscription${next !== '/compte' ? `?next=${encodeURIComponent(next)}` : ''}`}>S’inscrire</Link></p>
    </form>
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
