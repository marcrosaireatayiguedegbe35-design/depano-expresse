'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { uploadImage } from '@/components/pro';
import { useSession } from '@/components/session';
import { ErrorBox, useToast } from '@/components/ui';

/** Fiche publique du professionnel telle que les clients la voient. */
export default function ProInfos() {
  const { pro, setPro } = useSession();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    firstName: pro?.firstName ?? '', lastName: pro?.lastName ?? '', businessName: pro?.businessName ?? '', phone: (pro?.phone ?? '').replace(/^\+229/, ''),
    photoUrl: pro?.photoUrl ?? '', commune: pro?.commune ?? 'Cotonou', quartier: pro?.quartier ?? '', address: pro?.address ?? '', description: pro?.description ?? '',
    services: (pro?.services ?? []).join(', '), hours: pro?.hours ?? '', indicativeRates: pro?.indicativeRates ?? '', zoneRadiusKm: String(pro?.zoneRadiusKm ?? ''),
  }));
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  if (!pro) return null;
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const field = (k: keyof typeof f, label: string, icon: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="fcard indent"><div className="fcard-head"><Icon name={icon} /><label htmlFor={k}>{label}</label></div>
      <div className="finput blue"><input id={k} value={f[k]} onChange={(e) => set(k, e.target.value)} {...props} /></div></div>
  );

  return (
    <form className="screen" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      try {
        const body: Record<string, unknown> = {
          firstName: f.firstName, lastName: f.lastName, businessName: f.businessName, phone: `+229${f.phone.replace(/\D/g, '')}`, photoUrl: f.photoUrl,
          commune: f.commune, quartier: f.quartier, address: f.address, description: f.description, hours: f.hours, indicativeRates: f.indicativeRates,
          services: f.services.split(',').map((s) => s.trim()).filter(Boolean), ...(f.zoneRadiusKm ? { zoneRadiusKm: Number(f.zoneRadiusKm) } : {}),
          ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
        };
        const r = await api('/auth/me', { method: 'PATCH', body });
        setPro({ ...pro, ...r });
        toast('Profil enregistré');
      } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
    }}>
      <Blob soft />
      <PageHead title="Mon profil pro" back="/profil" />
      <div className="fcard" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="avatar-lg" style={f.photoUrl ? { backgroundImage: `url(${f.photoUrl})`, backgroundSize: 'cover' } : undefined}>{f.photoUrl ? '' : `${f.firstName[0] ?? ''}${f.lastName[0] ?? ''}`}</span>
        <div className="grow">
          <b style={{ color: 'var(--navy)' }}>Photo de profil</b>
          <p className="xs text-2">Visible des clients sur votre fiche.</p>
          <label className="btn btn-light btn-sm" style={{ marginTop: 8 }}>{up ? 'Envoi…' : f.photoUrl ? 'Changer' : 'Ajouter une photo'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const file = e.target.files?.[0]; e.target.value = '';
              if (!file) return;
              setUp(true);
              try { set('photoUrl', await uploadImage(file, 'photos')); } catch (e2: any) { toast(e2.message, 'danger'); } finally { setUp(false); }
            }} /></label>
        </div>
      </div>
      <div className="fcard indent"><div className="fcard-head"><Icon name="userFill" /><label htmlFor="fn">Prénom et nom</label></div>
        <div className="frow"><input id="fn" required minLength={2} value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /><input aria-label="Nom" required minLength={2} value={f.lastName} onChange={(e) => set('lastName', e.target.value)} /></div></div>
      {field('businessName', 'Nom de l’atelier', 'buildingFill', { placeholder: 'Facultatif' })}
      <div className="fcard indent"><div className="fcard-head"><Icon name="phoneFill" /><label htmlFor="ph">Téléphone (visible des clients)</label></div>
        <div className="frow"><select className="cc" aria-label="Indicatif" defaultValue="+229"><option>+229</option></select><input id="ph" type="tel" required pattern="[0-9 ]{8,14}" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div></div>
      <div className="fcard indent"><div className="fcard-head"><Icon name="pinFill" /><label htmlFor="co">Commune, quartier et adresse</label></div>
        <div className="frow"><select id="co" value={f.commune} onChange={(e) => set('commune', e.target.value)}>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select><input aria-label="Quartier" placeholder="Quartier" value={f.quartier} onChange={(e) => set('quartier', e.target.value)} /></div>
        <div className="finput blue" style={{ marginTop: 8 }}><input aria-label="Adresse" placeholder="Adresse / repère de l’atelier" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
        <button type="button" className="btn btn-light btn-sm" style={{ marginTop: 8, marginLeft: 34 }} onClick={() => navigator.geolocation?.getCurrentPosition((p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); toast('Position GPS mise à jour (enregistrez)'); }, () => toast('Position refusée', 'danger'))}>
          <Icon name="gps" />{pos ? 'Nouvelle position prête' : 'Mettre à jour ma position GPS'}</button>
      </div>
      <div className="fcard indent"><div className="fcard-head"><Icon name="docFill" /><label htmlFor="ds">Présentation</label></div>
        <div className="finput"><textarea id="ds" maxLength={1000} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Votre expérience, vos spécialités…" /></div></div>
      {field('services', 'Services (séparés par des virgules)', 'wrench', { placeholder: 'Vidange, freins, diagnostic…' })}
      {field('hours', 'Horaires', 'clock', { placeholder: 'Ex. : 08:00-19:00, lun-sam' })}
      {field('indicativeRates', 'Tarifs indicatifs', 'tag', { placeholder: 'Ex. : dès 5 000 FCFA' })}
      {field('zoneRadiusKm', 'Rayon d’intervention (km)', 'gps', { type: 'number', min: 1, max: 200 })}
      <ErrorBox error={err} />
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  );
}
