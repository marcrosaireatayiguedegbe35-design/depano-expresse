'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { areaLine, fcfa, kmLabel } from '@/lib/format';
import { Icon } from '@/components/icons';
import { ProTopbar, VerificationBanner } from '@/components/pro';
import { AdBanner } from '@/components/shop';
import { useSession } from '@/components/session';
import { useFetch, useToast } from '@/components/ui';

/** Grand interrupteur de disponibilité : le pro voit tout de suite s'il reçoit les urgences. */
function AvailabilityCard() {
  const { pro, setPro } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!pro) return null;
  const on = pro.availability === 'available';
  const set = async (v: string) => {
    setBusy(true);
    try { const r = await api('/auth/availability', { method: 'PATCH', body: { availability: v } }); setPro({ ...pro, availability: r.availability }); toast(v === 'available' ? 'Vous recevez les demandes' : 'Vous ne recevez plus de demandes'); }
    catch (e: any) { toast(e.message, 'danger'); }
    finally { setBusy(false); }
  };
  return (
    <section className={`hm-avail${on ? ' on' : pro.availability === 'busy' ? ' busy' : ''}`}>
      <span className="grow">
        <b>{on ? 'Vous êtes disponible' : pro.availability === 'busy' ? 'Vous êtes occupé' : 'Vous êtes indisponible'}</b>
        <small>{on ? 'Les urgences des clients proches vous arrivent.' : 'Vous ne recevez pas de nouvelles urgences.'}</small>
      </span>
      <button type="button" className={`hm-switch${on ? ' on' : ''}`} disabled={busy || pro.availability === 'busy'} onClick={() => set(on ? 'unavailable' : 'available')} aria-pressed={on} aria-label={on ? 'Passer indisponible' : 'Passer disponible'}><i /></button>
    </section>
  );
}

/** Accueil de l'espace professionnels : disponibilité, gains du mois, raccourcis, nouvelles demandes, interventions en cours. */
export default function ProHome() {
  const { pro } = useSession();
  const { data } = useFetch<any>('/dashboard');
  const conv = useFetch<any>('/conversations/unread');
  const msgs = (conv.data?.pending ?? 0) + (conv.data?.unread ?? 0);
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="screen pg hm-fit">
      <ProTopbar />
      <div className="hm-hello"><h1>Bonjour{pro?.firstName ? `, ${pro.firstName}` : ''} 👋</h1><p>{today}</p></div>
      <VerificationBanner />
      <AvailabilityCard />

      {data?.engaged && (
        <Link href={`/intervention?id=${data.engaged._id}`} className="pg-acc hm-engaged">
          <span className="ic"><Icon name="wrench" /></span>
          <span className="grow"><small>Intervention en cours · {data.engaged.reference}</small><b>{data.engaged.problem}</b></span>
          <Icon name="chevR" />
        </Link>
      )}

      <section className="pg-hero hm-hero">
        <small>Gains nets du mois</small>
        <strong>{data ? fcfa(data.earnings.month) : '—'}</strong>
        <div className="pg-hero-row">
          <span><small>Interventions payées</small><b>{data?.earnings.monthJobs ?? '—'}</b></span>
          <span><small>À reverser</small><b>{data ? fcfa(data.earnings.awaitingPayout) : '—'}</b></span>
        </div>
        <Link href="/gains" className="hm-hero-link">Voir mes gains<Icon name="chevR" /></Link>
      </section>

      <div className="hm-tiles">
        <Link href="/demandes"><span className="ic"><Icon name="clipboard" /></span><b>{data?.counts.pending ?? '—'}</b><small>Urgences à traiter</small></Link>
        <Link href="/demandes?tab=contacts"><span className="ic"><Icon name="chat" /></span><b>{msgs}</b><small>Messages clients</small></Link>
        <Link href="/interventions"><span className="ic"><Icon name="wrench" /></span><b>{data?.counts.active ?? '—'}</b><small>En cours</small></Link>
        <Link href="/profil/avis"><span className="ic"><Icon name="star" /></span><b>{data?.pro?.reviewsCount ? data.pro.rating.toFixed(1) : '—'}</b><small>{data?.pro?.reviewsCount ? `${data.pro.reviewsCount} avis` : 'Pas d’avis'}</small></Link>
      </div>

      <div className="hm-ads"><AdBanner placement="pro,home" limit={6} /></div>

      <Link href="/boutique" className="pg-acc hm-shop">
        <span className="ic"><Icon name="cartFill" /></span>
        <span className="grow"><small>Boutique Depanno Expresse</small><b>Pièces, outils et accessoires</b></span>
        <Icon name="chevR" />
      </Link>

      <section className="hm-todo">
        <div className="hm-sec"><h2>À traiter</h2><Link href="/demandes">Tout voir</Link></div>
        {!data ? null : data.latestRequests.length === 0 ? (
          <p className="hm-none"><Icon name="clipboard" />{data.pro?.availability === 'available' ? 'Aucune demande pour le moment : elles arrivent ici.' : 'Passez « Disponible » pour recevoir des demandes.'}</p>
        ) : data.latestRequests.slice(0, 2).map((r: any) => (
          <Link key={r._id} href={`/demande?id=${r.requestId._id}`} className={`hm-req${r.requestId.urgency === 'high' ? ' urgent' : ''}`}>
            <span className="ic"><Icon name={r.requestId.urgency === 'high' ? 'bolt' : 'clipboard'} /></span>
            <span className="grow"><b>{r.requestId.problem}</b><small>{[areaLine(r.requestId.area) || r.requestId.address || 'Client à proximité', r.distanceKm !== undefined ? `à ${kmLabel(r.distanceKm)}` : ''].filter(Boolean).join(' · ')}</small></span>
            <i className="pill new">{r.status === 'pending' ? 'Nouvelle' : 'Vue'}</i>
          </Link>
        ))}
      </section>
    </div>
  );
}
