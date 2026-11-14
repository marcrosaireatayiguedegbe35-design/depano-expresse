'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, qs } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { labelImage } from '@/lib/images';
import { Blob, ProCoverCard, ProductCard, SearchBar, SecHead, Seg } from '@/components/ds';
import { usePlace, useSession } from '@/components/session';
import { Empty, Loading, useFetch } from '@/components/ui';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Onglet « Recherche » (maquette 2 : position, recherche, « Nos catégories », bascule Professionnels / Produits). */
function Search() {
  const sp = useSearchParams();
  const { place, setPicking } = usePlace();
  const { user } = useSession();
  const cats = useFetch<any[]>('/service-categories');
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [tab, setTab] = useState<'pros' | 'products'>(sp.get('tab') === 'products' ? 'products' : 'pros');
  const [all, setAll] = useState(false);
  const [products, setProducts] = useState<any[] | null>(null);
  const pros = useFetch<any>(`/professionals/search${qs({ lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), includeUnavailable: 'true' })}`);

  // Étiquettes issues des catégories de services réelles (nom + problèmes déclarés).
  const tags = useMemo(() => {
    const seen = new Map<string, string>();
    cats.data?.forEach((c) => {
      if (!seen.has(norm(c.name))) seen.set(norm(c.name), c.name);
      c.problems?.forEach((p: any) => { if (!seen.has(norm(p.label))) seen.set(norm(p.label), p.label); });
    });
    return [...seen.values()];
  }, [cats.data]);

  useEffect(() => {
    const t = setTimeout(() => {
      setProducts(null);
      api(`/products${qs({ q, limit: 24 })}`).then((r) => setProducts(r.items)).catch(() => setProducts([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const proResults = useMemo(() => {
    const items = pros.data?.items ?? [];
    if (!q.trim()) return items;
    const n = norm(q.trim());
    return items.filter((p: any) => {
      const cat = cats.data?.find((c) => c.trade === p.trade);
      const hay = [p.businessName, p.firstName, p.lastName, TRADES[p.trade]?.label, cat?.name, p.commune, p.quartier, p.description, ...(p.services ?? []), ...(cat?.problems?.map((x: any) => x.label) ?? [])].join(' ');
      return norm(hay).includes(n);
    });
  }, [pros.data, cats.data, q]);

  const shown = all ? tags : tags.slice(0, 16);

  return (
    <div className="screen">
      <Blob />
      <div className="topbar">
        <button className="loc-inline grow" onClick={() => setPicking(true)} aria-label="Changer ma position">
          <Icon name="pinFill" className="pin" />{place.label}<Icon name="chevD" className="chev" />
        </button>
        <Link href={user ? '/compte/notifications' : '/connexion?next=/compte/notifications'} className="icon-btn" aria-label="Notifications">
          <Icon name="bell" />{(notifs.data?.unread ?? 0) > 0 && <span className="dot" />}
        </Link>
        <Link href="/compte" className="avatar-sm" aria-label="Mon profil">
          {user ? <span>{(user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')}</span> : <Icon name="userFill" />}
        </Link>
      </div>

      <SearchBar value={q} onChange={setQ} placeholder="Rechercher un service, une personne…" />

      <section className="section">
        <SecHead title="Nos catégories" right={tags.length > 16 ? <button className="see-all" onClick={() => setAll(!all)}>{all ? 'Réduire' : 'Voir tout'}<Icon name="arrow" /></button> : undefined} />
        {!cats.data ? <Loading rows={1} height={160} /> : (
          <div className="chips">
            {shown.map((t) => {
              const on = norm(q) === norm(t);
              return (
                <button key={t} className={`chip-tile${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setQ(on ? '' : t)}>
                  {labelImage(t) ? <img className="chip-img" src={labelImage(t)!} alt="" /> : <Icon name={iconFor(t)} />}{t}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="section">
        <Seg value={tab} onChange={setTab} options={[
          { value: 'pros', label: `Professionnels${q && pros.data ? ` (${proResults.length})` : ''}`, icon: 'briefcase' },
          { value: 'products', label: `Produits${q && products ? ` (${products.length})` : ''}`, icon: 'bag' },
        ]} />
      </div>

      <section className="section stack" style={{ gap: 16 }}>
        {tab === 'pros' ? (
          !pros.data ? <Loading rows={2} height={300} /> : proResults.length === 0
            ? <Empty title="Aucun professionnel ne correspond">Essayez une autre catégorie ou changez de position.</Empty>
            : proResults.slice(0, 30).map((p: any) => <ProCoverCard key={p._id} p={p} />)
        ) : (
          !products ? <Loading rows={3} height={130} /> : products.length === 0
            ? <Empty icon="cart" title="Aucun produit ne correspond">Consultez la marketplace pour voir tous les produits.</Empty>
            : products.map((p) => <ProductCard key={p._id} p={p} />)
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><Search /></Suspense>;
}
