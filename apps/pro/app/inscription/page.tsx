'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, Skyline, Swoosh } from '@/components/ds';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput } from '@/components/ui';
import { VerifyCode } from '@/components/verify-code';

/** Inscription d'un professionnel (même mise en page que l'inscription client), compte validé ensuite par l'équipe. */
export default function Register() {
  const router = useRouter();
  const { refresh } = useSession();
  const [cats, setCats] = useState<any[]>([]);
  const [f, setF] = useState({ firstName: '', lastName: '', businessName: '', email: '', phone: '', trade: '', commune: 'Cotonou', quartier: '', password: '' });
  const [pos, setPos] = useState<{ lat: number; lng: number; gps: boolean } | null>(null);
  const [accept, setAccept] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const pwOk = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password);
  useEffect(() => { api<any[]>('/service-categories').then((c) => { setCats(c); setF((s) => ({ ...s, trade: s.trade || c[0]?.trade || '' })); }).catch(() => {}); }, []);

  if (verifyEmail) return <VerifyCode email={verifyEmail} onVerified={async () => { await refresh(); router.replace('/profil/documents'); }} />;

  const gps = () => {
    if (!navigator.geolocation) return setGpsMsg('La géolocalisation n’est pas disponible sur cet appareil.');
    setGpsMsg('Autorisez la localisation dans la fenêtre de votre navigateur…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, gps: true }); setGpsMsg('Position de votre atelier enregistrée.'); },
      () => setGpsMsg('Position refusée : la position de votre commune sera utilisée.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <form className="screen" onSubmit={async (e) => {
      e.preventDefault();
      if (!pwOk) return setError('Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.');
      const c = COMMUNES.find((x) => x.name === f.commune) ?? COMMUNES[0];
      setBusy(true);
      setError(null);
      try {
        const r = await api('/auth/register', {
          method: 'POST',
          body: {
            firstName: f.firstName.trim(), lastName: f.lastName.trim(), businessName: f.businessName.trim() || undefined, email: f.email,
            phone: `+229${f.phone.replace(/\D/g, '')}`, trade: f.trade, commune: f.commune, quartier: f.quartier || undefined,
            lat: pos?.lat ?? c.lat, lng: pos?.lng ?? c.lng, password: f.password,
          },
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
          <h1 className="title-xl">Inscription pro</h1>
          <p className="sub">Rejoignez le réseau des professionnels vérifiés.</p>
          <Swoosh />
        </div>
        <div className="art auth-art" aria-hidden><Icon name="briefcase" /></div>
      </header>

      <div className="fcard indent">
        <div className="fcard-head"><Icon name="userFill" /><label htmlFor="fn">Prénom et nom</label></div>
        <div className="frow"><input id="fn" required minLength={2} autoComplete="given-name" placeholder="Prénom" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} />
          <input required minLength={2} aria-label="Nom" autoComplete="family-name" placeholder="Nom" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="buildingFill" /><label htmlFor="bn">Nom de l’atelier (facultatif)</label></div>
        <div className="finput blue"><input id="bn" placeholder="Ex. : Garage du Centre" value={f.businessName} onChange={(e) => set('businessName', e.target.value)} /></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="wrench" /><label htmlFor="tr">Métier</label></div>
        <div className="finput"><select id="tr" required value={f.trade} onChange={(e) => set('trade', e.target.value)}>{cats.map((c) => <option key={c.trade} value={c.trade}>{c.name}</option>)}</select></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="mail" /><label htmlFor="em">E-mail</label></div>
        <div className="finput blue"><input id="em" type="email" required autoComplete="email" placeholder="Votre e-mail" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="phoneFill" /><label htmlFor="ph">Téléphone</label></div>
        <div className="frow">
          <select className="cc" aria-label="Indicatif" defaultValue="+229"><option value="+229">+229</option></select>
          <input id="ph" type="tel" inputMode="numeric" required pattern="[0-9 ]{8,14}" placeholder="01 XX XX XX XX" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="pinFill" /><label htmlFor="co">Commune et quartier</label></div>
        <div className="frow">
          <select id="co" value={f.commune} onChange={(e) => set('commune', e.target.value)}>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select>
          <input aria-label="Quartier" placeholder="Quartier" value={f.quartier} onChange={(e) => set('quartier', e.target.value)} />
        </div>
        <button type="button" className="btn btn-light btn-sm" style={{ marginTop: 10, marginLeft: 34 }} onClick={gps}><Icon name="gps" />{pos?.gps ? 'Position GPS enregistrée' : 'Utiliser ma position GPS'}</button>
        {gpsMsg && <p className="hint">{gpsMsg}</p>}
      </div>
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="lock" /><label htmlFor="pw">Mot de passe</label></div>
        <PasswordInput id="pw" value={f.password} onChange={(v) => set('password', v)} autoComplete="new-password" minLength={8} placeholder="Créez un mot de passe" blue />
        <p className={`hint${f.password ? (pwOk ? ' ok' : ' bad') : ''}`}><Icon name={pwOk ? 'checkCircle' : 'info'} />8 caractères minimum, dont une lettre et un chiffre.</p>
      </div>
      <label className="checkline">
        <input type="checkbox" required checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span className="box"><Icon name="check" /></span>
        <span>J’accepte la vérification de mon identité et de mes documents, et la commission de la plateforme sur les prestations (hors pièces détachées).</span>
      </label>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy || !accept}><Icon name="userPlusFill" />{busy ? 'Création…' : 'Créer mon compte pro'}</button>
      <p className="center" style={{ marginTop: 20, color: 'var(--navy)' }}>Déjà inscrit ? <Link className="link" href="/connexion">Se connecter</Link></p>
      <Skyline />
    </form>
  );
}
