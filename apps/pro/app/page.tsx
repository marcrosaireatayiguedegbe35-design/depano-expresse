'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fcfa } from '@/lib/format';
import { Icon } from '@/components/icons';
import { InterventionCard, RequestCard } from '@/components/cards';
import { AssistBanner } from '@/components/ds';
import { ProTopbar, VerificationBanner } from '@/components/pro';
import { useSession } from '@/components/session';
import { Empty, Loading, useFetch, useToast } from '@/components/ui';

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
    <div className="screen pg">
      <ProTopbar />
      <div className="hm-hello"><h1>Bonjour{pro?.firstName ? `, ${pro.firstName}` : ''} 👋</h1><p>{today}</p></div>
      <VerificationBanner />
      <AvailabilityCard />

      {data?.engaged && (
        <Link href={`/interventions/${data.engaged._id}`} className="pg-acc hm-engaged">
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

      <section className="section">
        <div className="hm-sec"><h2>Nouvelles demandes</h2><Link href="/demandes">Tout voir</Link></div>
        {!data ? <Loading rows={2} height={120} /> : data.latestRequests.length === 0
          ? <Empty icon="clipboard" title="Aucune demande en attente">{data.pro?.availability === 'available' ? 'Les nouvelles demandes des clients proches apparaîtront ici.' : 'Passez « Disponible » pour recevoir des demandes.'}</Empty>
          : <div className="rq-list">{data.latestRequests.map((r: any) => <RequestCard key={r._id} r={r} />)}</div>}
      </section>

      <section className="section">
        <div className="hm-sec"><h2>Interventions en cours</h2><Link href="/interventions">Tout voir</Link></div>
        {!data ? null : data.current.length === 0
          ? <p className="pg-empty">Aucune intervention en cours.</p>
          : <div className="iv-list">{data.current.map((i: any) => <InterventionCard key={i._id} i={i} />)}</div>}
      </section>

      <section className="section"><AssistBanner compact title="Besoin d’aide ?" text="Notre équipe accompagne les professionnels partenaires." cta="Contacter" /></section>
    </div>
  );
}
