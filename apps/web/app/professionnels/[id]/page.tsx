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
  const [allSpecs, setAllSpecs] = useState(false);
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

  return (
    <div className="screen">
      <div className="cover-hero">
        {cover ? <img className="bg" src={cover} alt="" /> : <div className="ph"><Icon name={iconFor(t?.label ?? '')} /></div>}
        <div className="cover-tools">
          <BackButton />
          <div className="r">
            <button className="back-btn" onClick={share} aria-label="Partager"><Icon name="share" /></button>
          </div>
        </div>
      </div>
      <div className="avatar-xl"><div className="in">{p.photoUrl ? <img src={p.photoUrl} alt="" /> : tradeArt(p.trade) ? (isPhoto(tradeArt(p.trade)) ? <Art src={tradeArt(p.trade)!} size={96} /> : <img src={tradeArt(p.trade)!} alt="" style={{ objectFit: 'contain', padding: 10 }} />) : <Icon name={iconFor(t?.label ?? '')} />}</div></div>

      <h1 className="pro-title">{proName(p)} <span className="verified blue" title="Professionnel vérifié"><Icon name="check" /></span></h1>
      <p className="text-2" style={{ marginTop: 4 }}>{t?.label ? `${t.label} · ` : ''}{p.quartier ? `${p.quartier}, ` : ''}{p.commune}</p>
      <div className="hstack wrap" style={{ marginTop: 12, gap: 14 }}>
        {p.reviewsCount
          ? <span className="hstack" style={{ gap: 6 }}><Icon name="star" className="star" /><b style={{ fontSize: 17 }}>{p.rating.toFixed(1)}/5</b><span className="text-2">({p.reviewsCount} avis)</span></span>
          : <span className="text-2">Pas encore d’avis</span>}
        <span className={`status${status[0]}`}>{status[1]}</span>
      </div>

      <div className="facts">
        <div className="fact"><Icon name="pinFill" /><span>{p.commune}{km !== undefined && <><br />• {String(km).replace('.', ',')} km</>}</span></div>
        <div className="fact"><Icon name="clock" /><span className="clamp2">{p.hours || (p.availability === 'available' ? <>Disponible<br />aujourd’hui</> : 'Horaires non renseignés')}</span></div>
        <div className="fact"><Icon name="carFill" /><span>{p.indicativeRates ? <>Tarif<br /><span className="clamp2">{p.indicativeRates.replace(/^à partir de /i, 'dès ')}</span></> : <>Tarif<br />selon la panne</>}</span></div>
      </div>

      {specs.length > 0 && (
        <section className="section">
          <div className="sec-head ico">
            <h2><Icon name="wrench" />Spécialités</h2>
            {specs.length > 4 && <button className="see-all" onClick={() => setAllSpecs(!allSpecs)}>{allSpecs ? 'Réduire' : 'Voir tout'}<Icon name="chevR" /></button>}
          </div>
          <p className="xs text-2" style={{ margin: '-4px 0 10px' }}>Indiquées par le professionnel, à titre indicatif.</p>
          <div className="spec-row">
            {(allSpecs ? specs : specs.slice(0, 4)).map((s) => (
              <div key={s} className="spec static"><span className="spec-ic">{labelImage(s) ? <img src={labelImage(s)!} alt="" /> : <Icon name={iconFor(s)} />}</span>{s}</div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="sec-head ico"><h2><Icon name="briefcase" />À propos</h2></div>
        <p className={`about${more ? ' open' : ''}`}>{about}</p>
        {about.length > 140 && <div className="hstack" style={{ justifyContent: 'flex-end' }}><button className="see-all pill" onClick={() => setMore(!more)}>{more ? 'Réduire' : 'Lire plus'}<Icon name="chevD" /></button></div>}
        {p.zoneRadiusKm ? <p className="small text-2" style={{ marginTop: 8 }}>Intervient dans un rayon de {p.zoneRadiusKm} km.</p> : null}
      </section>

      <section className="section" id="avis">
        <div className="sec-head ico">
          <h2><Icon name="star" />Avis clients <span className="text-2" style={{ fontWeight: 500 }}>({p.reviewsCount ?? 0})</span></h2>
          {reviews.length > 1 && <button className="see-all" onClick={() => setAllReviews(!allReviews)}>{allReviews ? 'Réduire' : 'Voir tous'}<Icon name="chevR" /></button>}
        </div>
        {reviews.length === 0
          ? <div className="review-empty"><Icon name="star" /><span><b>Pas encore d’avis</b><small>Seuls les clients ayant payé une intervention peuvent laisser un avis.</small></span></div>
          : (allReviews ? reviews : reviews.slice(0, 1)).map((r) => (
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
      <p className="xs text-2 center" style={{ marginTop: 6 }}>Besoin précis (révision, amélioration…) : écrivez-lui. S’il accepte, vous pourrez discuter et vous appeler.</p>
      {contact !== null && <ContactSheet pro={p} initialTopic={contact || undefined} onClose={() => setContact(null)} />}
    </div>
  );
}
