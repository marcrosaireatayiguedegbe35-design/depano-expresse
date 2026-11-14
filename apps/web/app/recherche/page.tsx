'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, qs } from '@/lib/api';
import { Icon, iconFor } from '@/components/icons';
import { labelImage } from '@/lib/images';
import { Blob, ProductCard, SearchBar, SecHead } from '@/components/ds';
import { usePlace, useSession } from '@/components/session';
import { Empty, Loading, useFetch } from '@/components/ui';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Onglet « Recherche » : position, recherche, « Nos catégories » (chaque catégorie ou panne ouvre le parcours
 *  pannes → professionnels, comme depuis Découvrir), puis les produits de la boutique. */
function Search() {
  const sp = useSearchParams();
  const { place, setPicking } = usePlace();
  const { user } = useSession();
  const cats = useFetch<any[]>('/service-categories');
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [all, setAll] = useState(false);
  const [products, setProducts] = useState<any[] | null>(null);

  // Catégories réelles (services et pannes déclarées), chacune menant au parcours du service.
  const tags = useMemo(() => {
    const seen = new Map<string, { label: string; href: string }>();
    cats.data?.forEach((c) => {
      if (!seen.has(norm(c.name))) seen.set(norm(c.name), { label: c.name, href: `/services/${c.trade}` });
      c.problems?.forEach((p: any) => {
        if (!seen.has(norm(p.label))) seen.set(norm(p.label), { label: p.label, href: `/services/${c.trade}${qs({ problem: p.label })}` });
      });
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

  const matching = q.trim() ? tags.filter((t) => norm(t.label).includes(norm(q.trim()))) : tags;
  const shown = all || q.trim() ? matching : matching.slice(0, 16);

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

      <SearchBar value={q} onChange={setQ} placeholder="Rechercher une panne, un service, une pièce…" />

      <section className="section">
        <SecHead title="Nos catégories" right={!q.trim() && tags.length > 16 ? <button className="see-all" onClick={() => setAll(!all)}>{all ? 'Réduire' : 'Voir tout'}<Icon name="arrow" /></button> : undefined} />
        {!cats.data ? <Loading rows={1} height={160} /> : shown.length === 0 ? (
          <p className="text-2 small">Aucune catégorie ne correspond à « {q.trim()} ».</p>
        ) : (
          <div className="chips">
            {shown.map((t) => (
              <Link key={t.label} href={t.href} className="chip-tile">
                {labelImage(t.label) ? <img className="chip-img" src={labelImage(t.label)!} alt="" /> : <Icon name={iconFor(t.label)} />}{t.label}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <SecHead title={q.trim() ? `Produits${products ? ` (${products.length})` : ''}` : 'Produits de la boutique'} right={<Link href="/marketplace" className="see-all">Boutique<Icon name="arrow" /></Link>} />
        <div className="stack" style={{ gap: 16 }}>
          {!products ? <Loading rows={3} height={130} /> : products.length === 0
            ? <Empty icon="cart" title={q.trim() ? 'Aucun produit ne correspond' : 'La boutique sera bientôt garnie'}>{q.trim() ? 'Essayez un autre mot ou consultez toute la boutique.' : undefined}</Empty>
            : products.map((p) => <ProductCard key={p._id} p={p} />)}
        </div>
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><Search /></Suspense>;
}
