'use client';

import Link from 'next/link';
import { fcfa } from '@/lib/format';
import { Icon } from '@/components/icons';
import { InterventionCard, RequestCard } from '@/components/cards';
import { AssistBanner, Blob, SecHead, Skyline } from '@/components/ds';
import { ProTopbar, VerificationBanner } from '@/components/pro';
import { Empty, Loading, useFetch } from '@/components/ui';

/** Accueil de l'espace professionnels : disponibilité, chiffres clés, nouvelles demandes, interventions en cours. */
export default function ProHome() {
  const { data } = useFetch<any>('/dashboard');
  return (
    <div className="screen">
      <Blob />
      <ProTopbar />
      <VerificationBanner />
      {data?.engaged && (
        <Link href={`/interventions/${data.engaged._id}`} className="verif-banner" style={{ background: 'linear-gradient(110deg,#e9f8ee,#d6f2df)' }}>
          <span className="ic" style={{ color: 'var(--green)' }}><Icon name="wrench" /></span>
          <span className="grow"><b>Intervention en cours · {data.engaged.reference}</b><small>{data.engaged.problem} — vous ne recevez pas de nouveau client avant la fin confirmée.</small></span>
          <Icon name="chevR" className="chev" />
        </Link>
      )}

      <section className="section earn-banner">
        <small>Gains nets du mois</small>
        <span className="amt">{data ? fcfa(data.earnings.month) : '—'}</span>
        <div className="row">
          <span><b>{data?.earnings.monthJobs ?? '—'}</b>interventions payées</span>
          <span><b>{data ? fcfa(data.earnings.awaitingPayout) : '—'}</b>à reverser</span>
        </div>
      </section>

      <section className="section stat-row">
        <Link href="/demandes" className="stat-card"><span className="ic"><Icon name="clipboard" /></span><b>{data?.counts.pending ?? '—'}</b><small>Demandes à traiter</small></Link>
        <Link href="/interventions" className="stat-card"><span className="ic"><Icon name="wrench" /></span><b>{data?.counts.active ?? '—'}</b><small>Interventions en cours</small></Link>
        <Link href="/profil/avis" className="stat-card"><span className="ic"><Icon name="star" /></span><b>{data?.pro?.reviewsCount ? data.pro.rating.toFixed(1) : '—'}</b><small>{data?.pro?.reviewsCount ? `${data.pro.reviewsCount} avis` : 'Pas encore d’avis'}</small></Link>
      </section>

      <section className="section">
        <SecHead title="Nouvelles demandes" href="/demandes" pill />
        {!data ? <Loading rows={2} height={120} /> : data.latestRequests.length === 0
          ? <Empty icon="clipboard" title="Aucune demande en attente">{data.pro?.availability === 'available' ? 'Les nouvelles demandes des clients proches apparaîtront ici.' : 'Passez en « Disponible » pour recevoir des demandes.'}</Empty>
          : <div className="stack">{data.latestRequests.map((r: any) => <RequestCard key={r._id} r={r} />)}</div>}
      </section>

      <section className="section">
        <SecHead title="Interventions en cours" href="/interventions" pill />
        {!data ? <Loading rows={1} height={120} /> : data.current.length === 0
          ? <p className="text-2 small">Aucune intervention en cours.</p>
          : <div className="stack">{data.current.map((i: any) => <InterventionCard key={i._id} i={i} />)}</div>}
      </section>

      <section className="section"><AssistBanner compact title="Besoin d’aide ?" text="Notre équipe accompagne les professionnels partenaires." cta="Contacter" /></section>
      <Skyline waves={false} />
    </div>
  );
}
