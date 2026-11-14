'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { qs, WELCOME_KEY } from '@/lib/api';
import { proName, TRADES } from '@/lib/format';
import { IMAGES, tradeArt, tradeCover } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { AdBanner, TRADE_ICON } from '@/components/ds';
import { usePlace, useSession } from '@/components/session';
import { Loading, useFetch } from '@/components/ui';

/** Accueil « Découvrir » : salutation, bannière, position, services, offre, professionnels disponibles. */
export default function DiscoverPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const { place, setPicking } = usePlace();
  const nearby = useFetch<any>(`/professionals/search${qs({ lat: place.lat.toFixed(4), lng: place.lng.toFixed(4) })}`);
  const ads = useFetch<any[]>('/ads?placement=home&limit=4');
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);

  // Premier lancement sans compte : écran de bienvenue.
  useEffect(() => {
    if (loading || user) return;
    try { if (!localStorage.getItem(WELCOME_KEY)) router.replace('/bienvenue'); } catch {}
  }, [loading, user, router]);

  const pros = (nearby.data?.items ?? []).filter((p: any) => p.availability !== 'unavailable').slice(0, 6);
  const trades = Object.keys(TRADES).slice(0, 4);
  const unread = notifs.data?.unread ?? 0;

  return (
    <div className="screen dc">
      <header className="dc-head">
        <Link href="/compte" className="dc-menu" aria-label="Mon profil"><Icon name="filters" /></Link>
        <div className="grow">
          <h1>Bonjour{user ? `, ${user.firstName}` : ''} <span aria-hidden>👋</span></h1>
          <p>Un professionnel vérifié pour votre véhicule</p>
        </div>
        <Link href={user ? '/compte/notifications' : '/connexion?next=/compte/notifications'} className="dc-bell" aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
          <Icon name="bell" />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
        </Link>
      </header>

      <Link href="/depannage" className="dc-hero" style={{ backgroundImage: `url(${IMAGES.home.towTruck})` }}>
        <span className="dc-hero-copy">
          <small>Dépannage 24h/24</small>
          <strong>Un pro vérifié<br />près de vous</strong>
          <em>Décrivez votre panne, on s’occupe du reste</em>
        </span>
      </Link>

      <button className="dc-loc" onClick={() => setPicking(true)} aria-label="Changer ma position">
        <Icon name="pinFill" className="pin" />
        <span className="grow"><b>{place.label}</b>{place.detail && place.detail !== 'Choisir ma position' && <small>{place.detail}</small>}</span>
        <Icon name="settings" className="gear" />
      </button>

      <section className="section">
        <div className="dc-sec"><h2>Nos services</h2><Link href="/professionnels">Voir tout</Link></div>
        <div className="dc-services">
          {trades.map((k) => {
            const art = tradeArt(k);
            return (
              <Link key={k} href={`/depannage?trade=${k}`} className="dc-service">
                <span className="ic">{art ? <img src={art} alt="" /> : <Icon name={TRADE_ICON[k] ?? iconFor(TRADES[k].label)} />}</span>
                <span>{TRADES[k].label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section">
        {(ads.data?.length ?? 0) > 0 ? <AdBanner placement="home" /> : (
          <Link href="/marketplace" className="dc-promo">
            <span className="dc-promo-copy">
              <strong>Pièces &amp; accessoires</strong>
              <small>Batteries, pneus, huiles… livrés au Bénin</small>
              <span className="btn-mini">Découvrir</span>
            </span>
            <span className="dc-promo-art"><Icon name="cartFill" /></span>
          </Link>
        )}
      </section>

      <section className="section">
        <div className="dc-sec"><h2>Professionnels disponibles</h2><Link href="/professionnels">Voir tout</Link></div>
        {!nearby.data ? <Loading rows={2} height={120} /> : pros.length === 0
          ? <p className="text-2 small">Aucun professionnel disponible autour de {place.label} pour le moment.</p>
          : (
            <div className="stack" style={{ gap: 12 }}>
              {pros.map((p: any) => {
                const pic = p.photoUrl ?? tradeCover(p.trade);
                return (
                  <article key={p._id} className="dc-pack">
                    <Link href={`/professionnels/${p._id}`} className="pic">{pic ? <img src={pic} alt="" loading="lazy" /> : <Icon name={TRADE_ICON[p.trade] ?? 'wrench'} />}</Link>
                    <div className="grow">
                      <Link href={`/professionnels/${p._id}`}><h3>{proName(p)}</h3></Link>
                      <p>{TRADES[p.trade]?.desc ?? TRADES[p.trade]?.label}</p>
                      <div className="row">
                        <span className="meta-l">
                          {p.reviewsCount ? <><Icon name="star" className="star" />{p.rating.toFixed(1)}</> : <span className="new">Nouveau</span>}
                          {p.distanceKm !== undefined && <> · {String(p.distanceKm).replace('.', ',')} km</>}
                          {p.availability === 'busy' && <> · <span className="busy">Occupé</span></>}
                        </span>
                        <Link href={`/depannage?trade=${p.trade}&pro=${p._id}`} className="btn-mini">Demander</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </section>

      {!user && !loading && (
        <section className="section dc-join">
          <b>Pas encore de compte ?</b>
          <span>Créez-le pour demander une intervention et suivre vos factures.</span>
          <div className="hstack" style={{ gap: 10, marginTop: 10 }}>
            <Link href="/connexion" className="btn btn-outline btn-sm grow">Se connecter</Link>
            <Link href="/inscription" className="btn btn-primary btn-sm grow">S’inscrire</Link>
          </div>
        </section>
      )}
    </div>
  );
}
