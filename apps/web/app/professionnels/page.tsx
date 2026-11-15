'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { qs } from '@/lib/api';
import { proName, TRADES } from '@/lib/format';
import { tradeArt, tradeCover } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { BackButton, TRADE_ICON } from '@/components/ds';
import { usePlace } from '@/components/session';
import { Empty, ErrorBox, Loading, useFetch } from '@/components/ui';
import { Art } from '@/components/art';

const availLabel = (a?: string) => (a === 'available' ? 'Disponible' : a === 'busy' ? 'Occupé' : 'Indisponible');

/** Professionnels (même composition que Découvrir) : position, filtre par service, liste à choisir. */
function Pros() {
  const sp = useSearchParams();
  const router = useRouter();
  const { place, setPicking } = usePlace();
  const trade = sp.get('trade') ?? '';
  const [q, setQ] = useState('');
  const { data, error } = useFetch<any>(`/professionals/search${qs({ trade, lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), includeUnavailable: 'true' })}`);
  const items = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = data?.items ?? [];
    return n ? list.filter((p: any) => `${proName(p)} ${p.commune ?? ''} ${p.quartier ?? ''} ${TRADES[p.trade]?.label ?? ''}`.toLowerCase().includes(n)) : list;
  }, [data, q]);
  const go = (k: string) => router.replace(k ? `/professionnels?trade=${k}` : '/professionnels');

  return (
    <div className="screen dc">
      <header className="dc-head">
        <BackButton href="/" />
        <div className="grow">
          <h1>Professionnels</h1>
          <p>Des experts vérifiés près de chez vous</p>
        </div>
      </header>

      <label className="dc-search">
        <Icon name="search" />
        <input type="search" placeholder="Nom, quartier, métier…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un professionnel" />
      </label>

      <button className="dc-loc" onClick={() => setPicking(true)} aria-label="Changer ma position">
        <Icon name="pinFill" className="pin" />
        <span className="grow"><b>{place.label}</b>{place.detail && place.detail !== 'Choisir ma position' && <small>{place.detail}</small>}</span>
        <Icon name="settings" className="gear" />
      </button>

      <section className="section">
        <div className="dc-sec"><h2>Services</h2><Link href="/services">Voir tout</Link></div>
        <div className="dc-filter">
          <button className={`dc-chip${!trade ? ' on' : ''}`} onClick={() => go('')}><span className="ic"><Icon name="users" /></span>Tous</button>
          {Object.keys(TRADES).map((k) => {
            const art = tradeArt(k);
            return (
              <button key={k} className={`dc-chip${trade === k ? ' on' : ''}`} onClick={() => go(trade === k ? '' : k)} aria-pressed={trade === k}>
                <span className="ic">{art ? <Art src={art} size={40} /> : <Icon name={TRADE_ICON[k] ?? iconFor(TRADES[k].label)} />}</span>{TRADES[k].label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="dc-sec"><h2>{trade ? TRADES[trade]?.label : 'Tous les professionnels'}</h2>{data && <span className="small text-2">{items.length} résultat{items.length > 1 ? 's' : ''}</span>}</div>
        <ErrorBox error={error} />
        {!data ? <Loading rows={3} height={110} /> : items.length === 0
          ? <Empty icon="users" title="Aucun professionnel trouvé">Essayez un autre service ou changez de position.</Empty>
          : (
            <div className="stack" style={{ gap: 12 }}>
              {items.map((p: any) => {
                const pic = p.photoUrl ?? tradeCover(p.trade);
                return (
                  <article key={p._id} className="dc-pack" style={{ position: 'relative' }}>
                    <Link href={`/professionnels/${p._id}`} className="pic">
                      {pic ? <img src={pic} alt="" loading="lazy" /> : <Icon name={TRADE_ICON[p.trade] ?? 'wrench'} />}
                      <i className={`dot ${p.availability}`} title={availLabel(p.availability)} />
                    </Link>
                    <div className="grow">
                      <Link href={`/professionnels/${p._id}`}><h3 style={{ paddingRight: 34 }}>{proName(p)} <span className="verified" title="Professionnel vérifié"><Icon name="check" /></span></h3></Link>
                      <p>{TRADES[p.trade]?.label} · {[p.quartier, p.commune].filter(Boolean).join(', ')}</p>
                      <div className="row">
                        <span className="meta-l">
                          {p.reviewsCount ? <><Icon name="star" className="star" />{p.rating.toFixed(1)}</> : <span className="new">Nouveau</span>}
                          {p.distanceKm !== undefined && <> · {String(p.distanceKm).replace('.', ',')} km</>}
                          {p.availability === 'busy' && <> · <span className="busy">Occupé</span></>}
                        </span>
                        <Link href={`/professionnels/${p._id}?contact=1`} className="btn-mini">Écrire</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><Pros /></Suspense>;
}
