'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput } from '@/components/ui';
import { VerifyCode } from '@/components/verify-code';

/** Inscription professionnel (même modèle épuré que l'espace client) ; compte validé ensuite par l'équipe. */
export default function Register() {
  const router = useRouter();
  const { refresh } = useSession();
  const [cats, setCats] = useState<any[]>([]);
  const [f, setF] = useState({ firstName: '', lastName: '', businessName: '', email: '', phone: '', trade: '', commune: 'Cotonou', quartier: '', password: '' });
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const pwOk = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password);
  useEffect(() => { api<any[]>('/service-categories').then((c) => { setCats(c); setF((s) => ({ ...s, trade: s.trade || c[0]?.trade || '' })); }).catch(() => {}); }, []);

  if (verifyEmail) return <VerifyCode email={verifyEmail} onBack={() => setVerifyEmail(null)} onVerified={async () => { await refresh(); router.replace('/profil/documents'); }} />;

  const gps = () => {
    if (!navigator.geolocation) return setGpsMsg('Localisation indisponible sur cet appareil : la position de votre commune sera utilisée.');
    setGpsMsg('Autorisez la localisation dans la fenêtre du navigateur…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsMsg('Position de votre atelier enregistrée.'); },
      () => setGpsMsg('Position refusée : la position de votre commune sera utilisée.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <form className="au" onSubmit={async (e) => {
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
      <h1 className="au-title">Inscription pro</h1>
      <p className="au-lead">Devenez partenaire</p>
      <p>Recevez des demandes de clients près de chez vous</p>
      <div className="au-field"><label htmlFor="fn">Prénom et nom</label>
        <div className="au-row"><input id="fn" required minLength={2} autoComplete="given-name" placeholder="Prénom" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} />
          <input required minLength={2} aria-label="Nom" autoComplete="family-name" placeholder="Nom" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
      </div>
      <div className="au-field"><label htmlFor="bn">Nom de l’atelier (facultatif)</label><input id="bn" placeholder="Ex. : Garage du Centre" value={f.businessName} onChange={(e) => set('businessName', e.target.value)} /></div>
      <div className="au-field"><label htmlFor="tr">Métier</label><select id="tr" required value={f.trade} onChange={(e) => set('trade', e.target.value)}>{cats.map((c) => <option key={c.trade} value={c.trade}>{c.name}</option>)}</select></div>
      <div className="au-field"><label htmlFor="em">E-mail</label><input id="em" type="email" required autoComplete="email" placeholder="exemple@gmail.com" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div className="au-field"><label htmlFor="ph">Numéro de téléphone</label>
        <div className="au-row"><select className="cc" aria-label="Indicatif" defaultValue="+229"><option value="+229">+229</option></select>
          <input id="ph" type="tel" inputMode="numeric" required pattern="[0-9 ]{8,14}" placeholder="01 XX XX XX XX" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      <div className="au-field"><label htmlFor="co">Commune et quartier</label>
        <div className="au-row"><select id="co" value={f.commune} onChange={(e) => set('commune', e.target.value)}>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select>
          <input aria-label="Quartier" placeholder="Quartier" value={f.quartier} onChange={(e) => set('quartier', e.target.value)} /></div>
        <button type="button" className="au-resend" style={{ margin: '10px 0 0', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={gps}><Icon name="gps" />{pos ? 'Position GPS enregistrée' : 'Utiliser la position GPS de mon atelier'}</button>
        {gpsMsg && <p className="au-hint">{gpsMsg}</p>}
      </div>
      <div className="au-field"><label htmlFor="pw">Mot de passe</label>
        <PasswordInput id="pw" value={f.password} onChange={(v) => set('password', v)} autoComplete="new-password" minLength={8} placeholder="Créez un mot de passe" />
        <p className={`au-hint${f.password ? (pwOk ? ' ok' : ' bad') : ''}`}>8 caractères minimum, dont une lettre et un chiffre.</p>
      </div>
      <label className="au-check">
        <input type="checkbox" required checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span>J’accepte la vérification de mon identité et de mes documents, et la commission de la plateforme sur les prestations (hors pièces détachées).</span>
      </label>
      <ErrorBox error={error} />
      <button className="au-btn" disabled={busy || !accept}>{busy ? 'Création…' : 'Créer mon compte pro'}</button>
      <p className="au-alt">Déjà partenaire ? <Link href="/connexion">Se connecter</Link></p>
    </form>
  );
}
