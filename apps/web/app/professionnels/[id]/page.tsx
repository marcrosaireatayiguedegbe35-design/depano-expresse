'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { date, proName, TRADES } from '@/lib/format';
import { labelImage, tradeArt, tradeCover } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { BackButton, useDistanceKm } from '@/components/ds';
import { ErrorBox, Loading, StarRow, useFetch, useToast } from '@/components/ui';
import { Art, isPhoto } from '@/components/art';
import { ContactSheet } from '@/components/contact';

/** Fiche professionnel (maquette 13). */
export default function ProProfile({ params }: { params: { id: string } }) {
  const { data, error } = useFetch<any>(`/professionals/${params.id}`);
  const cats = useFetch<any[]>('/service-categories');
  const toast = useToast();
  const [more, setMore] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [contact, setContact] = useState<string | null>(null);
  // Arrivée depuis « Écrire » (liste des pros, Recherche) : la fenêtre de message s'ouvre directement.
  useEffect(() => { if (new URLSearchParams(location.search).get('contact') === '1') setContact(''); }, []);
  const p = data?.professional;
  const km = useDistanceKm(p?.location?.coordinates);
  if (error) return <div className="screen"><BackButton /><ErrorBox error={error} /></div>;
  if (!data) return <div className="screen"><Loading rows={4} /></div>;

  const t = TRADES[p.trade];
  const cover = p.coverUrl ?? tradeCover(p.trade);
  // Spécialités cochées par le professionnel lui-même : affichées à titre indicatif.
  // Seules les spécialités de la grille du métier (définie par l'administration) : pas de texte libre comme « tous ».
  const grid: string[] = (cats.data?.find((x) => x.trade === p.trade)?.problems ?? []).map((x: any) => x.label);
  const specs: string[] = (p.services ?? []).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i && grid.includes(v));
  const about: string = p.description || `${t?.label ?? 'Professionnel'} vérifié par l’équipe Depanno Expresse, basé à ${p.commune}.`;
  const reviews: any[] = data.reviews ?? [];
  const status = p.availability === 'available' ? ['', 'En activité'] : p.availability === 'busy' ? [' busy', 'Occupé'] : [' off', 'Indisponible'];

  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: proName(p), url });
      else { await navigator.clipboard.writeText(url); toast('Lien copié'); }
    } catch {}
  };

  const since = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null;
  const done: number = data.completedCount ?? 0;
  const avatar = p.photoUrl ? <img src={p.photoUrl} alt="" /> : tradeArt(p.trade) ? (isPhoto(tradeArt(p.trade)) ? <Art src={tradeArt(p.trade)!} size={96} /> : <img src={tradeArt(p.trade)!} alt="" style={{ objectFit: 'contain', padding: 10 }} />) : <Icon name={iconFor(t?.label ?? '')} />;

  return (
    <div className="screen pf2">
      <div className="pf2-cover">
        {cover ? <img src={cover} alt="" /> : <div className="ph"><Icon name={iconFor(t?.label ?? '')} /></div>}
        <div className="pf2-tools">
          <BackButton />
          <button className="back-btn" onClick={share} aria-label="Partager"><Icon name="share" /></button>
        </div>
      </div>

      <section className="pf2-id">
        <span className="pf2-av">{avatar}<i className={`dot${status[0]}`} title={status[1]} /></span>
        <h1>{proName(p)} <span className="verified blue" title="Professionnel vérifié"><Icon name="check" /></span></h1>
        <p className="pf2-trade">{t?.label ?? 'Professionnel'}</p>
        <p className="pf2-place"><Icon name="pinFill" />{[p.quartier, p.commune].filter(Boolean).join(', ')}{km !== undefined && ` · à ${String(km).replace('.', ',')} km`}</p>
        <div className="pf2-badges">
          <span className="ok"><Icon name="shieldFill" />Vérifié par Depanno</span>
          <span className={`st${status[0]}`}><i />{status[1]}</span>
        </div>
      </section>

      <div className="pf2-stats">
        <div><b>{p.reviewsCount ? p.rating.toFixed(1) : '—'}</b><small>{p.reviewsCount ? <><Icon name="star" className="star" />Note sur 5</> : 'Pas encore noté'}</small></div>
        <div><b>{p.reviewsCount ?? 0}</b><small>Avis clients</small></div>
        <div><b>{done}</b><small>Intervention{done > 1 ? 's' : ''} réalisée{done > 1 ? 's' : ''}</small></div>
      </div>

      <section className="pf2-card">
        <h2><Icon name="clipboard" />Informations pratiques</h2>
        <div className="pf2-info"><span className="ic"><Icon name="clock" /></span><span className="grow"><small>Horaires</small><b>{p.hours || 'Non renseignés'}</b></span></div>
        <div className="pf2-info"><span className="ic"><Icon name="gps" /></span><span className="grow"><small>Zone d’intervention</small><b>{p.zoneRadiusKm ? `${p.zoneRadiusKm} km autour de ${p.commune}` : p.commune}</b></span></div>
        <div className="pf2-info"><span className="ic"><Icon name="tag" /></span><span className="grow"><small>Tarifs indicatifs</small><b>{p.indicativeRates || 'Selon le travail, facture détaillée'}</b></span></div>
        {since && <div className="pf2-info"><span className="ic"><Icon name="calendar" /></span><span className="grow"><small>Sur Depanno Expresse</small><b>Depuis {since}</b></span></div>}
      </section>

      {specs.length > 0 && (
        <section className="pf2-card">
          <h2><Icon name="wrench" />Spécialités</h2>
          <div className="pf2-specs">
            {specs.map((sp) => <span key={sp}>{labelImage(sp) ? <img src={labelImage(sp)!} alt="" /> : <Icon name={iconFor(sp)} />}{sp}</span>)}
          </div>
          <p className="pf2-hint">Indiquées par le professionnel, à titre indicatif.</p>
        </section>
      )}

      <section className="pf2-card">
        <h2><Icon name="briefcase" />À propos</h2>
        <p className={`about${more ? ' open' : ''}`}>{about}</p>
        {about.length > 140 && <button className="see-all pill" onClick={() => setMore(!more)}>{more ? 'Réduire' : 'Lire plus'}<Icon name="chevD" /></button>}
      </section>

      <section className="pf2-trust">
        <div><Icon name="shieldFill" /><span><b>Identité et documents vérifiés</b><small>Contrôlés par l’équipe avant toute mission.</small></span></div>
        <div><Icon name="docFill" /><span><b>Facture détaillée</b><small>Vous l’acceptez ou la contestez avant de payer.</small></span></div>
        <div><Icon name="star" /><span><b>Avis authentiques</b><small>Seuls les clients servis peuvent noter.</small></span></div>
      </section>

      <section className="pf2-card" id="avis">
        <h2><Icon name="star" />Avis clients <span className="pf2-count">{p.reviewsCount ?? 0}</span>
          {reviews.length > 2 && <button className="see-all" onClick={() => setAllReviews(!allReviews)}>{allReviews ? 'Réduire' : 'Voir tous'}<Icon name="chevR" /></button>}
        </h2>
        {reviews.length === 0
          ? <div className="review-empty"><Icon name="star" /><span><b>Pas encore d’avis</b><small>Seuls les clients ayant payé une intervention peuvent laisser un avis.</small></span></div>
          : (allReviews ? reviews : reviews.slice(0, 2)).map((r) => (
            <div key={r._id} className="review">
              <span className="who">{r.author?.[0] ?? '?'}</span>
              <div className="grow">
                <div className="hstack between"><b>{r.author}</b><span className="xs text-2">{date(r.createdAt)}</span></div>
                <StarRow value={r.rating} />
                {r.comment && <p className="small" style={{ marginTop: 4 }}>{r.comment}</p>}
              </div>
            </div>
          ))}
      </section>

      <div className="sticky-actions pp-actions">
        <Link className="pp-btn urgent" href={`/services/${p.trade}`}><Icon name="bolt" /><span><b>Urgence</b><small>Dépannage</small></span></Link>
        <button type="button" className="pp-btn write" onClick={() => setContact('')}><Icon name="chatFill" /><span><b>Écrire</b><small>Hors urgence</small></span></button>
      </div>
      {contact !== null && <ContactSheet pro={p} initialTopic={contact || undefined} onClose={() => setContact(null)} />}
    </div>
  );
}
