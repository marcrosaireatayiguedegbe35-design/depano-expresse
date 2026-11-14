'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, safeNext } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, Skyline, Swoosh } from '@/components/ds';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput } from '@/components/ui';
import { VerifyCode } from '@/components/verify-code';

/** Inscription (maquette 16). */
function Register() {
  const sp = useSearchParams();
  const router = useRouter();
  const { refresh } = useSession();
  const [f, setF] = useState({ name: '', email: '', phone: '', commune: 'Cotonou', password: '' });
  const [accept, setAccept] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const pwOk = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password);

  if (verifyEmail) {
    return <VerifyCode email={verifyEmail} onVerified={async () => { await refresh(); router.replace(safeNext(sp.get('next'))); }} />;
  }

  return (
    <form className="screen" onSubmit={async (e) => {
      e.preventDefault();
      const parts = f.name.trim().split(/\s+/);
      if (parts.length < 2) return setError('Indiquez votre prénom et votre nom.');
      if (!pwOk) return setError('Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.');
      setBusy(true);
      setError(null);
      try {
        const r = await api('/auth/register', {
          method: 'POST',
          body: { firstName: parts[0], lastName: parts.slice(1).join(' '), email: f.email, phone: `+229${f.phone.replace(/\D/g, '')}`, commune: f.commune, password: f.password },
        });
        setVerifyEmail(r.email);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }}>
      <Blob />
      <header className="hero-head" style={{ minHeight: 120 }}>
        <div className="txt">
          <h1 className="title-xl">Inscription</h1>
          <p className="sub">Créez votre compte en quelques secondes.</p>
          <Swoosh />
        </div>
        <div className="art auth-art" aria-hidden><Icon name="userPlusFill" /></div>
      </header>

      <div className="fcard indent">
        <div className="fcard-head"><Icon name="userFill" /><label htmlFor="n">Nom complet</label></div>
        <div className="finput blue"><input id="n" autoComplete="name" required placeholder="Prénom et nom" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="mail" /><label htmlFor="e">E-mail</label></div>
        <div className="finput blue"><input id="e" type="email" autoComplete="email" required placeholder="Votre e-mail" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="phoneFill" /><label htmlFor="t">Téléphone</label></div>
        <div className="frow">
          <select className="cc" aria-label="Indicatif" defaultValue="+229"><option value="+229">+229</option></select>
          <input id="t" type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="[0-9 ]{8,14}" placeholder="01 XX XX XX XX" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="pinFill" /><label htmlFor="c">Commune</label></div>
        <div className="finput"><select id="c" value={f.commune} onChange={(e) => set('commune', e.target.value)}>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="lock" /><label htmlFor="p">Mot de passe</label></div>
        <PasswordInput id="p" value={f.password} onChange={(v) => set('password', v)} autoComplete="new-password" minLength={8} placeholder="Créez un mot de passe" blue />
        <p className={`hint${f.password ? (pwOk ? ' ok' : ' bad') : ''}`} style={{ marginLeft: 0 }}><Icon name={pwOk ? 'checkCircle' : 'info'} />8 caractères minimum, dont une lettre et un chiffre.</p>
      </div>
      <label className="checkline">
        <input type="checkbox" required checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span className="box"><Icon name="check" /></span>
        <span>J’accepte que mes données servent à traiter mes demandes. Ma position n’est partagée qu’avec les professionnels que je sollicite. <Link href="/confidentialite"><b>Politique de confidentialité</b></Link></span>
      </label>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy || !accept}><Icon name="userPlusFill" />{busy ? 'Création…' : 'S’inscrire'}</button>
      <p className="center" style={{ marginTop: 20, color: 'var(--navy)' }}>Déjà un compte ? <Link className="link" href="/connexion">Se connecter</Link></p>
      <Skyline />
    </form>
  );
}

export default function Page() {
  return <Suspense><Register /></Suspense>;
}
