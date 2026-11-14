'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { qs } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { tradeArt } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { Blob, PageHead, ProCoverCard, Seg, TRADE_ICON } from '@/components/ds';
import { usePlace } from '@/components/session';
import { Empty, Loading, useFetch } from '@/components/ui';

/** Professionnels d'un service : le client choisit celui qu'il veut. */
export default function ServicePros({ params }: { params: { trade: string } }) {
  const { place, setPicking } = usePlace();
  const cats = useFetch<any[]>('/service-categories');
  const { data } = useFetch<any>(`/professionals/search${qs({ trade: params.trade, lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), includeUnavailable: 'true' })}`);
  const [sort, setSort] = useState<'best' | 'near' | 'rating'>('best');
  const cat = cats.data?.find((c) => c.trade === params.trade);
  const name = cat?.name ?? TRADES[params.trade]?.label ?? 'Service';
  const art = cat?.imageUrl || tradeArt(params.trade);
  const items = useMemo(() => {
    const list = [...(data?.items ?? [])];
    if (sort === 'near') list.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sort === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0));
    return list;
  }, [data, sort]);

  return (
    <div className="screen">
      <Blob soft />
      <PageHead title={name} back="/services" />
      <section className="svc-hero">
        <span className="art">{art ? <img src={art} alt="" /> : <Icon name={TRADE_ICON[params.trade] ?? iconFor(name)} />}</span>
        <div className="grow">
          <p className="small" style={{ color: 'var(--navy)' }}>{cat?.description || TRADES[params.trade]?.desc}</p>
          <button className="dc-loc" style={{ marginTop: 8, padding: '8px 12px' }} onClick={() => setPicking(true)}>
            <Icon name="pinFill" className="pin" /><span className="grow"><b>Près de {place.label}</b></span><Icon name="settings" className="gear" />
          </button>
        </div>
      </section>

      <div className="section">
        <Seg small value={sort} onChange={setSort} options={[{ value: 'best', label: 'Recommandés' }, { value: 'near', label: 'Plus proches' }, { value: 'rating', label: 'Mieux notés' }]} />
      </div>

      <section className="section stack" style={{ gap: 16 }}>
        {data && <p className="small text-2">{items.length} professionnel{items.length > 1 ? 's' : ''} {data.expanded ? `dans un rayon de ${data.radiusKm} km` : 'à proximité'}</p>}
        {!data ? <Loading rows={2} height={280} /> : items.length === 0
          ? <Empty icon="users" title={`Aucun professionnel en ${name.toLowerCase()} pour le moment`}>Essayez une autre position ou un autre service. <Link className="link" href="/services">Voir les services</Link></Empty>
          : items.map((p: any) => <ProCoverCard key={p._id} p={p} />)}
      </section>
    </div>
  );
}
