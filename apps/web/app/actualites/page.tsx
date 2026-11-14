'use client';

import Link from 'next/link';
import { useState } from 'react';
import { date } from '@/lib/format';
import { Icon } from '@/components/icons';
import { AdBanner, BackButton, Blob, SecHead } from '@/components/ds';
import { useSession } from '@/components/session';
import { Empty, Loading, useFetch } from '@/components/ui';

const KIND: Record<string, string> = { news: 'Actualité', event: 'Événement', announcement: 'Annonce', ad: 'Promotion', promo: 'Promotion' };

/** Publicités & actualités (maquette 14). */
export default function NewsPage() {
  const { user } = useSession();
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  const news = useFetch<any[]>('/ads?kind=news&limit=20');
  const offers = useFetch<any[]>('/ads?placement=home&limit=20');
  const [allNews, setAllNews] = useState(false);
  const [allOffers, setAllOffers] = useState(false);
  const offerList = (offers.data ?? []).filter((a) => !['news', 'event', 'announcement'].includes(a.kind));

  return (
    <div className="screen">
      <Blob />
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <BackButton />
        <Link href={user ? '/compte/notifications' : '/connexion?next=/compte/notifications'} className="back-btn" style={{ position: 'relative' }} aria-label="Notifications">
          <Icon name="bell" />{(notifs.data?.unread ?? 0) > 0 && <span className="dot" style={{ position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: '50%', background: 'var(--red)' }} />}
        </Link>
      </div>
      <header className="hero-head" style={{ paddingTop: 0 }}>
        <div className="txt">
          <h1 className="title-xl">Publicités &amp; actualités</h1>
          <p className="sub">Restez informé des dernières actualités et offres de la plateforme.</p>
        </div>
        <div className="art auth-art" aria-hidden><Icon name="megaphone" /></div>
      </header>

      <AdBanner placement="news" />

      <section className="section">
        <SecHead title="Actualités automobiles" icon="megaphone" right={(news.data?.length ?? 0) > 2 ? <button className="see-all" onClick={() => setAllNews(!allNews)}>{allNews ? 'Réduire' : 'Voir tout'}<Icon name="chevR" /></button> : undefined} />
        {!news.data ? <Loading rows={2} height={130} /> : news.data.length === 0 ? <Empty icon="megaphone" title="Aucune actualité pour le moment" /> : (
          <div className="stack" style={{ gap: 12 }}>
            {(allNews ? news.data : news.data.slice(0, 2)).map((n) => (
              <Link key={n._id} href={`/actualites/${n._id}`} className="news-card">
                <span className="pic">{n.imageUrl ? <img src={n.imageUrl} alt="" /> : <Icon name="megaphone" />}<span className="tagx">{KIND[n.kind] ?? 'Info'}</span></span>
                <span className="grow">
                  <h3>{n.title}</h3>
                  {n.description && <p>{n.description}</p>}
                  <span className="meta"><span><Icon name="calendar" />{date(n.startAt)}</span></span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <SecHead title="Offres de nos partenaires" icon="tag" right={offerList.length > 2 ? <button className="see-all" onClick={() => setAllOffers(!allOffers)}>{allOffers ? 'Réduire' : 'Voir tout'}<Icon name="chevR" /></button> : undefined} />
        {!offers.data ? <Loading rows={1} height={130} /> : offerList.length === 0 ? <Empty icon="tag" title="Aucune offre partenaire pour le moment" /> : (
          <div className="stack" style={{ gap: 12 }}>
            {(allOffers ? offerList : offerList.slice(0, 2)).map((a) => (
              <article key={a._id} className="news-card promo">
                <span className="pic">{a.imageUrl ? <img src={a.imageUrl} alt="" /> : <Icon name="tag" />}<span className="tagx">{a.sponsoredLabel || 'Promotion'}</span></span>
                <span className="grow">
                  <h3>{a.title}</h3>
                  {a.description && <p>{a.description}</p>}
                  <Link href={`/actualites/${a._id}`} className="btn btn-primary btn-xs" style={{ marginTop: 8 }}>Voir l’offre<Icon name="chevR" /></Link>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
