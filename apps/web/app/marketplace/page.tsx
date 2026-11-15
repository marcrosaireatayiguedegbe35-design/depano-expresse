'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { qs } from '@/lib/api';
import { Icon, iconFor } from '@/components/icons';
import { AdBanner, Blob, ProductCard, SearchBar } from '@/components/ds';
import { useSession } from '@/components/session';
import { Empty, ErrorBox, Loading, Modal, useFetch } from '@/components/ui';
import { isPhoto, sized } from '@/components/art';

const SORTS = [['newest', 'Nouveautés'], ['price_asc', 'Prix croissant'], ['price_desc', 'Prix décroissant'], ['name', 'Nom (A-Z)']];

/** Marketplace (maquette 8). */
function Marketplace() {
  const sp = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const params = { q: sp.get('q') ?? '', category: sp.get('category') ?? '', sort: sp.get('sort') ?? 'newest', page: sp.get('page') ?? '1', inStock: sp.get('inStock') ?? '', promo: sp.get('promo') ?? '' };
  const [q, setQ] = useState(params.q);
  const [filters, setFilters] = useState(false);
  const cats = useFetch<any[]>('/product-categories');
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  const { data, error } = useFetch<any>(`/products${qs(params)}`);
  const go = (patch: Record<string, string>) => router.push(`/marketplace${qs({ ...params, page: '1', ...patch })}`);
  const pages = data ? Math.ceil(data.total / data.limit) : 1;
  const active = (params.inStock ? 1 : 0) + (params.promo ? 1 : 0);

  return (
    <div className="screen">
      <Blob />
      <div className="topbar">
        <span className="head-ico"><Icon name="cart" /></span>
        <div className="grow"><h1 className="h-title">Marketplace</h1><p className="small" style={{ color: '#3d4a6a' }}>Trouvez facilement ce dont vous avez besoin</p></div>
        <Link href={user ? '/compte/notifications' : '/connexion?next=/compte/notifications'} className="round-btn" aria-label="Notifications">
          <Icon name="bell" />{(notifs.data?.unread ?? 0) > 0 && <span className="dot" />}
        </Link>
      </div>

      <SearchBar value={q} onChange={setQ} onSubmit={() => go({ q })} placeholder="Pièce, marque, véhicule compatible…" />

      <div className="cat-scroll section">
        <button className={`cat-tile${!params.category ? ' on' : ''}`} onClick={() => go({ category: '' })} aria-pressed={!params.category}>
          {!params.category && <span className="tick"><Icon name="check" /></span>}
          <span className="art"><Icon name="cart" /></span>Tout{!params.category && <i className="bar" />}
        </button>
        {cats.data?.map((c) => {
          const on = params.category === c._id;
          return (
            <button key={c._id} className={`cat-tile${on ? ' on' : ''}${isPhoto(c.imageUrl) ? ' has-photo' : ''}`} onClick={() => go({ category: on ? '' : c._id })} aria-pressed={on}>
              {on && <span className="tick"><Icon name="check" /></span>}
              {isPhoto(c.imageUrl)
                ? <><img className="cover" src={sized(c.imageUrl, 120)} alt="" loading="lazy" /><span className="lbl">{c.name}</span></>
                : <><span className="art">{c.imageUrl ? <img src={c.imageUrl} alt="" /> : <Icon name={iconFor(c.name)} />}</span>{c.name}</>}
              {on && <i className="bar" />}
            </button>
          );
        })}
      </div>

      <div className="toolbar">
        <button className="tool-btn" onClick={() => setFilters(true)}><Icon name="sliders" />Filtres{active > 0 && <span className="count-inline">{active}</span>}</button>
        <span className="small text-2 grow center">{data ? `${data.total} produit(s)` : ''}</span>
        <label className="tool-select">
          <select aria-label="Trier" value={params.sort} onChange={(e) => go({ sort: e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="section"><AdBanner placement="marketplace" /></div>

      <section className="section stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        {!data ? <Loading rows={3} height={150} /> : data.items.length === 0
          ? <Empty icon="cart" title="Aucun produit ne correspond">Modifiez votre recherche ou vos filtres.</Empty>
          : data.items.map((p: any) => <ProductCard key={p._id} p={p} />)}
      </section>

      {pages > 1 && (
        <div className="hstack" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn btn-light btn-sm" disabled={Number(params.page) <= 1} onClick={() => go({ page: String(Number(params.page) - 1) })}><Icon name="back" />Précédent</button>
          <span className="small text-2">{params.page} / {pages}</span>
          <button className="btn btn-light btn-sm" disabled={Number(params.page) >= pages} onClick={() => go({ page: String(Number(params.page) + 1) })}>Suivant<Icon name="chevR" /></button>
        </div>
      )}

      {filters && (
        <Modal title="Filtres" onClose={() => setFilters(false)}>
          <label className="radio-row"><input type="checkbox" checked={!!params.inStock} onChange={(e) => go({ inStock: e.target.checked ? 'true' : '' })} /><span className="grow">Uniquement en stock</span></label>
          <label className="radio-row"><input type="checkbox" checked={!!params.promo} onChange={(e) => go({ promo: e.target.checked ? 'true' : '' })} /><span className="grow">En promotion</span></label>
          <div className="hstack" style={{ marginTop: 18 }}>
            <button className="btn btn-outline grow" onClick={() => { go({ inStock: '', promo: '' }); setFilters(false); }}>Réinitialiser</button>
            <button className="btn btn-primary grow" onClick={() => setFilters(false)}>Voir les produits</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><Marketplace /></Suspense>;
}
