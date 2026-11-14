'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, safeNext } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput } from '@/components/ui';
import { VerifyCode } from '@/components/verify-code';

/** Inscription client (modèle épuré). */
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
    return <VerifyCode email={verifyEmail} onBack={() => setVerifyEmail(null)} onVerified={async () => { await refresh(); router.replace(safeNext(sp.get('next'))); }} />;
  }

  return (
    <form className="au" onSubmit={async (e) => {
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
      <h1 className="au-title">Inscription</h1>
      <p className="au-lead">C’est parti !</p>
      <p>Créez votre compte</p>
      <div className="au-field"><label htmlFor="n">Nom complet</label><input id="n" autoComplete="name" required placeholder="Ex. : Koffi Agbo" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
      <div className="au-field"><label htmlFor="e">E-mail</label><input id="e" type="email" autoComplete="email" required placeholder="exemple@gmail.com" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div className="au-field"><label htmlFor="t">Numéro de téléphone</label>
        <div className="au-row">
          <select className="cc" aria-label="Indicatif" defaultValue="+229"><option value="+229">+229</option></select>
          <input id="t" type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="[0-9 ]{8,14}" placeholder="01 XX XX XX XX" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </div>
      <div className="au-field"><label htmlFor="c">Commune</label><select id="c" value={f.commune} onChange={(e) => set('commune', e.target.value)}>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
      <div className="au-field"><label htmlFor="p">Mot de passe</label>
        <PasswordInput id="p" value={f.password} onChange={(v) => set('password', v)} autoComplete="new-password" minLength={8} placeholder="Créez un mot de passe" />
        <p className={`au-hint${f.password ? (pwOk ? ' ok' : ' bad') : ''}`}>8 caractères minimum, dont une lettre et un chiffre.</p>
      </div>
      <label className="au-check">
        <input type="checkbox" required checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>J’accepte que mes données servent à traiter mes demandes. Ma position n’est partagée qu’avec les professionnels que je sollicite. <Link href="/confidentialite" className="au-link">Confidentialité</Link></span>
      </label>
      <ErrorBox error={error} />
      <button className="au-btn" disabled={busy || !accept}>{busy ? 'Création…' : 'S’inscrire'}</button>
      <p className="au-alt">Déjà un compte ? <Link href="/connexion">Se connecter</Link></p>
    </form>
  );
}

export default function Page() {
  return <Suspense><Register /></Suspense>;
}
