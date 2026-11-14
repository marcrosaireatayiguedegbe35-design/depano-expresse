'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, qs, WELCOME_KEY } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { IMAGES } from '@/lib/images';
import { Icon } from '@/components/icons';
import { Blob, LocationTopbar, ProRowCard, SecHead, Skyline, TradeCard } from '@/components/ds';
import { usePlace, useSession } from '@/components/session';
import { Loading, useFetch } from '@/components/ui';

type Slide = { key: string; tag: string; tagIcon?: string; title: string; em?: string; tail?: string; cta: string; href: string; image?: string | null; external?: boolean; adId?: string; person?: boolean };

/** Accueil « Découvrir » (maquette 5). */
export default function DiscoverPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const { place } = usePlace();
  const nearby = useFetch<any>(`/professionals/search${qs({ lat: place.lat.toFixed(4), lng: place.lng.toFixed(4) })}`);
  const ads = useFetch<any[]>('/ads?placement=home&limit=4');
  const [i, setI] = useState(0);

  // Premier lancement sans compte : écran de bienvenue (maquette 6).
  useEffect(() => {
    if (loading || user) return;
    try { if (!localStorage.getItem(WELCOME_KEY)) router.replace('/bienvenue'); } catch {}
  }, [loading, user, router]);

  const slides: Slide[] = useMemo(() => [
    { key: 'sos', tag: 'Dépannage 24h/24', tagIcon: 'clock', title: 'En panne ?', em: 'Un pro vérifié', tail: 'arrive près de vous !', cta: 'Demander un dépannage', href: '/depannage', image: IMAGES.home.towTruck },
    ...(ads.data ?? []).map((a) => ({
      key: a._id, adId: a._id, tag: a.sponsoredLabel || 'Publicité', title: a.title, tail: a.companyId?.name, cta: 'Découvrir',
      href: a.link || a.website || a.companyId?.website || `/actualites/${a._id}`, image: a.imageUrl, person: !a.imageUrl, external: !!(a.link || a.website || a.companyId?.website),
    })),
  ], [ads.data]);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);
  const s = slides[i % slides.length];
  useEffect(() => { if (s?.adId) api(`/ads/${s.adId}/impression`, { method: 'POST' }).catch(() => {}); }, [s?.adId]);

  const fastest = (nearby.data?.items ?? []).filter((p: any) => p.availability === 'available').slice(0, 5);
  const cta = <>{s.cta}<i><Icon name="arrow" /></i></>;

  return (
    <div className="screen">
      <Blob />
      <LocationTopbar />

      <section className="banner" aria-roledescription="carrousel">
        <div className="copy">
          <span className={`tagpill${s.adId ? ' yellow' : ''}`}>{s.tagIcon && <Icon name={s.tagIcon} />}{s.tag}</span>
          <h2>{s.title}{s.em && <><br /><em>{s.em}</em></>}{s.tail && <><br /><span className="tail" style={{ fontWeight: s.adId ? 500 : undefined }}>{s.tail}</span></>}</h2>
          {s.external
            ? <a className="cta" href={s.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => s.adId && api(`/ads/${s.adId}/click`, { method: 'POST' }).catch(() => {})}>{cta}</a>
            : <Link className="cta" href={s.href}>{cta}</Link>}
        </div>
        {s.person ? <div className="art person"><img src={IMAGES.advertisements.fallback} alt="" /></div> : s.image ? <div className="photo" style={{ backgroundImage: `url(${s.image})`, backgroundPosition: s.key === 'sos' ? '35% 62%' : 'center' }} /> : <div className="art"><Icon name="megaphone" /></div>}
      </section>
      {slides.length > 1 && (
        <div className="dots">{slides.map((x, k) => <button key={x.key} className={k === i % slides.length ? 'on' : ''} onClick={() => setI(k)} aria-label={`Diapositive ${k + 1}`} />)}</div>
      )}

      <section className="section">
        <SecHead title="De quoi avez-vous besoin ?" />
        <div className="trade-row">
          {Object.keys(TRADES).map((k, n) => <TradeCard key={k} trade={k} index={n} href={`/depannage?trade=${k}`} />)}
        </div>
      </section>

      <section className="section">
        <SecHead title="Dépannage le plus rapide" href="/professionnels" pill />
        {!nearby.data ? <Loading rows={2} height={130} /> : fastest.length === 0
          ? <p className="text-2">Aucun professionnel disponible autour de {place.label} pour le moment.</p>
          : <div className="stack">{fastest.map((p: any) => <ProRowCard key={p._id} p={p} />)}</div>}
      </section>

      {!user && !loading && (
        <section className="section card peach">
          <h3>Bienvenue sur Depanno Expresse</h3>
          <p className="text-2 small mt-s">Créez un compte pour demander une intervention et suivre vos factures.</p>
          <div className="hstack mt">
            <Link href="/connexion" className="btn btn-primary btn-sm grow">Se connecter</Link>
            <Link href="/inscription" className="btn btn-outline btn-sm grow">S’inscrire</Link>
          </div>
        </section>
      )}
      <Skyline waves={false} />
    </div>
  );
}
