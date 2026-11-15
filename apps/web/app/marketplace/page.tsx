'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { qs } from '@/lib/api';
import { Icon, iconFor } from '@/components/icons';
import { AdBanner, Blob, ProductCard, SearchBar } from '@/components/ds';
import { useSession } from '@/components/session';
import { Empty, ErrorBox, Modal, useFetch } from '@/components/ui';
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
    <div className="screen mk">
      <Blob />
      <div className="topbar">
        <span className="head-ico"><Icon name="cart" /></span>
        <div className="grow"><h1 className="h-title">Marketplace</h1><p className="small" style={{ color: '#3d4a6a' }}>Trouvez facilement ce dont vous avez besoin</p></div>
        <Link href={user ? '/compte/notifications' : '/connexion?next=/compte/notifications'} className="round-btn" aria-label="Notifications">
          <Icon name="bell" />{(notifs.data?.unread ?? 0) > 0 && <span className="dot" />}
        </Link>
      </div>

      <SearchBar value={q} onChange={setQ} onSubmit={() => go({ q })} placeholder="Pièce, marque, véhicule compatible…" />

      <nav className="mk-cats section" aria-label="Catégories">
        <button className={`mk-cat${!params.category ? ' on' : ''}`} onClick={() => go({ category: '' })} aria-pressed={!params.category}>
          <span className="th"><Icon name="cart" /></span>Tout
        </button>
        {cats.data?.map((c) => {
          const on = params.category === c._id;
          return (
            <button key={c._id} className={`mk-cat${on ? ' on' : ''}`} onClick={() => go({ category: on ? '' : c._id })} aria-pressed={on}>
              <span className="th">{isPhoto(c.imageUrl) ? <img src={sized(c.imageUrl, 96)} alt="" loading="lazy" /> : c.imageUrl ? <img className="ico" src={c.imageUrl} alt="" /> : <Icon name={iconFor(c.name)} />}</span>
              {c.name}
            </button>
          );
        })}
      </nav>

      <div className="mk-bar">
        <p className="mk-count">{data ? <><b>{data.total}</b> {data.total > 1 ? 'produits' : 'produit'}</> : ' '}</p>
        <button className={`mk-pill${active > 0 ? ' on' : ''}`} onClick={() => setFilters(true)}><Icon name="sliders" />Filtres{active > 0 && <span className="count-inline">{active}</span>}</button>
        <label className="mk-pill mk-sort">
          <select aria-label="Trier" value={params.sort} onChange={(e) => go({ sort: e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Icon name="chevD" />
        </label>
      </div>

      <div className="section"><AdBanner placement="marketplace" /></div>

      <section className="section">
        <ErrorBox error={error} />
        {!data ? <div className="mk-grid">{[0, 1, 2, 3].map((k) => <div key={k} className="mk-skel" />)}</div> : data.items.length === 0
          ? <Empty icon="cart" title="Aucun produit ne correspond">Modifiez votre recherche ou vos filtres.</Empty>
          : <div className="mk-grid">{data.items.map((p: any) => <ProductCard key={p._id} p={p} />)}</div>}
      </section>

      {pages > 1 && (
        <div className="mk-pages">
          <button className="mk-page-btn" aria-label="Page précédente" disabled={Number(params.page) <= 1} onClick={() => go({ page: String(Number(params.page) - 1) })}><Icon name="back" /></button>
          <span>Page <b>{params.page}</b> sur {pages}</span>
          <button className="mk-page-btn" aria-label="Page suivante" disabled={Number(params.page) >= pages} onClick={() => go({ page: String(Number(params.page) + 1) })}><Icon name="chevR" /></button>
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
