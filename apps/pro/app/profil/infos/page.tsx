'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { uploadImage } from '@/components/pro';
import { useSession } from '@/components/session';
import { ErrorBox, useFetch, useToast } from '@/components/ui';

/** Grilles d'horaires proposées : le professionnel choisit celle qui lui convient. */
const HOURS = [
  { label: 'Lun – Sam · 8 h – 18 h', sub: 'Horaires classiques' },
  { label: 'Lun – Ven · 8 h – 17 h', sub: 'Semaine uniquement' },
  { label: 'Lun – Sam · 7 h – 20 h', sub: 'Journée élargie' },
  { label: 'Tous les jours · 8 h – 20 h', sub: 'Dimanche compris' },
  { label: '7 j/7 · 24 h/24', sub: 'Urgences jour et nuit' },
  { label: 'Week-end · 8 h – 18 h', sub: 'Samedi et dimanche' },
];
const RADIUS = [5, 10, 20, 30, 50];

/** Fiche publique du professionnel telle que les clients la voient. */
export default function ProInfos() {
  const { pro, setPro } = useSession();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    firstName: pro?.firstName ?? '', lastName: pro?.lastName ?? '', businessName: pro?.businessName ?? '', phone: (pro?.phone ?? '').replace(/^\+229/, ''),
    photoUrl: pro?.photoUrl ?? '', coverUrl: pro?.coverUrl ?? '', commune: pro?.commune ?? 'Cotonou', quartier: pro?.quartier ?? '', address: pro?.address ?? '', description: pro?.description ?? '',
    hours: pro?.hours ?? '', indicativeRates: pro?.indicativeRates ?? '', zoneRadiusKm: String(pro?.zoneRadiusKm ?? ''),
  }));
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const [upCover, setUpCover] = useState(false);
  const [services, setServices] = useState<string[]>(pro?.services ?? []);
  const cats = useFetch<any[]>('/service-categories');
  if (!pro) return null;
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  // Grille de spécialités : les pannes définies par l'administration pour le métier du pro (+ celles déjà choisies).
  const grid: string[] = (cats.data?.find((c) => c.trade === pro.trade)?.problems ?? []).map((p: any) => p.label as string);
  const toggle = (sp: string) => setServices((l) => (l.includes(sp) ? l.filter((x) => x !== sp) : [...l, sp]));
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
          firstName: f.firstName, lastName: f.lastName, businessName: f.businessName, phone: `+229${f.phone.replace(/\D/g, '')}`, photoUrl: f.photoUrl, coverUrl: f.coverUrl,
          commune: f.commune, quartier: f.quartier, address: f.address, description: f.description, hours: f.hours, indicativeRates: f.indicativeRates,
          services: cats.data ? services.filter((x) => grid.includes(x)) : services, ...(f.zoneRadiusKm ? { zoneRadiusKm: Number(f.zoneRadiusKm) } : {}),
          ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
        };
        const r = await api('/auth/me', { method: 'PATCH', body });
        setPro({ ...pro, ...r });
        toast('Profil enregistré');
      } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
    }}>
      <Blob soft />
      <PageHead title="Mon profil pro" back="/profil" />
      <div className="fcard cover-edit">
        <div className="cover-prev" style={f.coverUrl ? { backgroundImage: `url(${f.coverUrl})` } : undefined}>
          {!f.coverUrl && <span><Icon name="sparkle" />Aucune bannière : l’image de votre métier est affichée</span>}
        </div>
        <div className="cover-bar">
          <span className="grow"><b>Bannière de votre fiche</b><small>Grande image en haut de votre profil (atelier, véhicule, équipe…). Format paysage.</small></span>
          <label className="btn btn-light btn-sm">{upCover ? 'Envoi…' : f.coverUrl ? 'Changer' : 'Ajouter'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const file = e.target.files?.[0]; e.target.value = '';
              if (!file) return;
              setUpCover(true);
              try { set('coverUrl', await uploadImage(file, 'photos')); } catch (e2: any) { toast(e2.message, 'danger'); } finally { setUpCover(false); }
            }} /></label>
          {f.coverUrl && <button type="button" className="btn btn-light btn-sm" onClick={() => set('coverUrl', '')}>Retirer</button>}
        </div>
      </div>
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
        {pro?.area?.commune && (
          <p className="small text-2" style={{ margin: '8px 0 0 34px' }}>
            <b>Localisation détectée :</b> {[pro.area.quartier, pro.area.arrondissement, pro.area.commune, pro.area.departement && `département ${pro.area.departement}`].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
      <div className="fcard indent"><div className="fcard-head"><Icon name="docFill" /><label htmlFor="ds">Présentation</label></div>
        <div className="finput"><textarea id="ds" maxLength={1000} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Votre expérience, vos spécialités…" /></div></div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="wrench" /><label>Mes spécialités</label><span className="grid-count">{services.filter((x) => grid.includes(x)).length} choisie{services.filter((x) => grid.includes(x)).length > 1 ? 's' : ''}</span></div>
        <p className="xs text-2 grid-help">Cochez ce que vous faites : elles s’affichent sur votre fiche, à titre indicatif.</p>
        {!cats.data ? <p className="xs text-2">Chargement des spécialités…</p> : grid.length === 0 ? <p className="xs text-2">Aucune spécialité définie pour votre métier pour l’instant.</p> : (
          <div className="pick-grid">
            {grid.map((sp) => {
              const on = services.includes(sp);
              return <button key={sp} type="button" className={`pick${on ? ' on' : ''}`} onClick={() => toggle(sp)} aria-pressed={on}><span className="box">{on && <Icon name="check" />}</span>{sp}</button>;
            })}
          </div>
        )}
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="clock" /><label>Mes horaires</label></div>
        <p className="xs text-2 grid-help">Choisissez la grille qui vous convient.</p>
        <div className="pick-grid hours">
          {HOURS.map((h) => {
            const on = f.hours === h.label;
            return <button key={h.label} type="button" className={`pick radio${on ? ' on' : ''}`} onClick={() => set('hours', on ? '' : h.label)} aria-pressed={on}><span className="box">{on && <i />}</span><span className="grow"><b>{h.label}</b><small>{h.sub}</small></span></button>;
          })}
        </div>
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="gps" /><label>Rayon d’intervention</label></div>
        <div className="pick-row">
          {RADIUS.map((r) => <button key={r} type="button" className={`pick-chip${f.zoneRadiusKm === String(r) ? ' on' : ''}`} onClick={() => set('zoneRadiusKm', String(r))} aria-pressed={f.zoneRadiusKm === String(r)}>{r} km</button>)}
        </div>
      </div>
      {field('indicativeRates', 'Tarifs indicatifs', 'tag', { placeholder: 'Ex. : dès 5 000 FCFA' })}
      <ErrorBox error={err} />
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  );
}
