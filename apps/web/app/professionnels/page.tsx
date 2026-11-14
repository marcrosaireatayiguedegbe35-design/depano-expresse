'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { qs } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, LocationTopbar, ProWideCard, Skyline, TradeCard } from '@/components/ds';
import { usePlace } from '@/components/session';
import { Empty, ErrorBox, Loading, useFetch } from '@/components/ui';

/** Onglet « Professionnels » (maquette 12). */
function Pros() {
  const sp = useSearchParams();
  const router = useRouter();
  const { place } = usePlace();
  const trade = sp.get('trade') ?? '';
  const { data, error } = useFetch<any>(`/professionals/search${qs({ trade, lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), includeUnavailable: 'true' })}`);
  const n = data?.items.length ?? 0;

  return (
    <div className="screen">
      <Blob />
      <LocationTopbar />
      <header className="big-head">
        <h1 className="title-xl">Professionnels</h1>
        <p>Des experts à votre service</p>
        <i className="underline" />
      </header>

      <div className="trade-row">
        {Object.keys(TRADES).map((k, i) => (
          <TradeCard key={k} trade={k} index={i} href={trade === k ? '/professionnels' : `/professionnels?trade=${k}`} />
        ))}
      </div>

      <section className="section">
        <div className="sec-head">
          <h2>{trade ? TRADES[trade]?.label : 'Tous les professionnels'}</h2>
          {trade
            ? <button className="see-all muted" onClick={() => router.push('/professionnels')}>Tout voir<Icon name="chevR" /></button>
            : data && <span className="see-all muted">{n} professionnel{n > 1 ? 's' : ''}<Icon name="chevR" /></span>}
        </div>
        <ErrorBox error={error} />
        {!data ? <Loading rows={2} height={180} /> : n === 0
          ? <Empty icon="users" title="Aucun professionnel trouvé">Essayez un autre métier ou changez de position.</Empty>
          : <div className="stack" style={{ gap: 16 }}>{data.items.map((p: any) => <ProWideCard key={p._id} p={p} />)}</div>}
      </section>

      <section className="section">
        <div className="sec-head"><h2>Pourquoi choisir nos professionnels ?</h2></div>
        <div className="why">
          <div><span className="ic"><Icon name="shieldFill" /></span>Professionnels vérifiés</div>
          <div><span className="ic"><Icon name="bolt" /></span>Intervention rapide</div>
          <div><span className="ic"><Icon name="headsetFill" /></span>Assistance 24h/24</div>
        </div>
      </section>
      <Skyline waves={false} />
    </div>
  );
}

export default function Page() {
  return <Suspense><Pros /></Suspense>;
}
