'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, qs } from '@/lib/api';
import { Icon, iconFor } from '@/components/icons';
import { Blob, ProCoverCard, ProductCard, SearchBar, Seg, TRADE_ICON } from '@/components/ds';
import { Art } from '@/components/art';
import { usePlace, useSession } from '@/components/session';
import { Empty, Loading, useFetch } from '@/components/ui';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Onglet « Recherche » : trouver un professionnel pour un besoin précis hors urgence (révision, amélioration…)
 *  et lui écrire, ou chercher un produit de la boutique. Les pannes urgentes passent par « Nos services ». */
function Search() {
  const sp = useSearchParams();
  const { place, setPicking } = usePlace();
  const { user } = useSession();
  const cats = useFetch<any[]>('/service-categories');
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [tab, setTab] = useState<'pros' | 'products'>(sp.get('tab') === 'products' ? 'products' : 'pros');
  const [trade, setTrade] = useState(sp.get('trade') ?? '');
  const [products, setProducts] = useState<any[] | null>(null);
  const pros = useFetch<any>(tab === 'pros' ? `/professionals/search${qs({ lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), includeUnavailable: 'true', trade: trade || undefined })}` : null);

  // Grandes catégories de services définies par l'administration : elles filtrent les professionnels.
  const tags = useMemo(() => (cats.data ?? []).map((c) => ({ label: c.name, image: c.imageUrl as string | undefined, trade: c.trade as string, problems: (c.problems ?? []).map((p: any) => p.label) as string[] })), [cats.data]);

  useEffect(() => {
    if (tab !== 'products') return;
    const t = setTimeout(() => {
      setProducts(null);
      api(`/products${qs({ q, limit: 24 })}`).then((r) => setProducts(r.items)).catch(() => setProducts([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, tab]);

  const proResults = useMemo(() => {
    const items: any[] = pros.data?.items ?? [];
    if (!q.trim()) return items;
    const n = norm(q.trim());
    return items.filter((p) => {
      const cat = tags.find((c) => c.trade === p.trade);
      return norm([p.businessName, p.firstName, p.lastName, cat?.label, p.commune, p.quartier, p.description, ...(p.services ?? []), ...(cat?.problems ?? [])].join(' ')).includes(n);
    });
  }, [pros.data, tags, q]);

  return (
    <div className="screen rs">
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

      <SearchBar value={q} onChange={setQ} placeholder={tab === 'pros' ? 'Un professionnel, un service, un quartier…' : 'Une pièce, une marque, un véhicule…'} />

      <div className="section">
        <Seg value={tab} onChange={setTab} options={[
          { value: 'pros', label: 'Professionnels', icon: 'briefcase' },
          { value: 'products', label: 'Produits', icon: 'bag' },
        ]} />
      </div>

      {tab === 'pros' ? (
        <>
          <div className="rs-note section">
            <span className="ic"><Icon name="chatFill" /></span>
            <span className="grow"><b>Un besoin précis, hors urgence ?</b><small>Révision, amélioration, pose… Choisissez un professionnel et écrivez-lui.</small></span>
            <Link href="/services" className="rs-urgent"><Icon name="bolt" />Panne ?</Link>
          </div>

          {cats.data && (
            <nav className="rs-cats section" aria-label="Catégories">
              <button type="button" className={`rs-cat${!trade ? ' on' : ''}`} onClick={() => setTrade('')} aria-pressed={!trade}><span className="th"><Icon name="usersFill" /></span><span className="lbl">Tous</span></button>
              {tags.map((t) => (
                <button key={t.trade} type="button" className={`rs-cat${trade === t.trade ? ' on' : ''}`} onClick={() => setTrade(trade === t.trade ? '' : t.trade)} aria-pressed={trade === t.trade}>
                  <span className="th">{t.image ? <Art src={t.image} size={96} /> : <Icon name={TRADE_ICON[t.trade] ?? iconFor(t.label)} />}</span><span className="lbl">{t.label}</span>
                </button>
              ))}
            </nav>
          )}

          <section className="section">
            <div className="rs-head">
              <p className="mk-count">{pros.data && cats.data ? <><b>{proResults.length}</b> {proResults.length > 1 ? 'professionnels' : 'professionnel'}</> : ' '}</p>
              <span className="rs-near"><Icon name="pinFill" />{place.label}</span>
            </div>
            <div className="rs-list">
              {!pros.data || !cats.data ? <Loading rows={2} height={200} /> : proResults.length === 0
                ? <Empty icon="users" title="Aucun professionnel trouvé">Essayez une autre catégorie, un autre mot ou changez de position.</Empty>
                : proResults.slice(0, 40).map((p: any) => <ProCoverCard key={p._id} p={p} />)}
            </div>
          </section>
        </>
      ) : (
        <section className="section mk">
          <div className="rs-head">
            <p className="mk-count">{q.trim() ? (products ? <><b>{products.length}</b> {products.length > 1 ? 'produits' : 'produit'}</> : ' ') : <b>Produits de la boutique</b>}</p>
            <Link href="/marketplace" className="see-all">Boutique<Icon name="arrow" /></Link>
          </div>
          {!products ? <Loading rows={3} height={130} /> : products.length === 0
            ? <Empty icon="cart" title={q.trim() ? 'Aucun produit ne correspond' : 'La boutique sera bientôt garnie'}>{q.trim() ? 'Essayez un autre mot ou consultez toute la boutique.' : undefined}</Empty>
            : <div className="mk-grid">{products.map((p) => <ProductCard key={p._id} p={p} />)}</div>}
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><Search /></Suspense>;
}
