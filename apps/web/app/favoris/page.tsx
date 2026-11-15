'use client';

import Link from 'next/link';
import { fcfa } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { Blob, HeartButton } from '@/components/ds';
import { useFavs } from '@/components/session';

/** Onglet « Favoris » : les produits de la boutique mis de côté, état vide illustré. */
export default function FavoritesPage() {
  const { list } = useFavs();
  const items = list.filter((f) => f.kind === 'product');
  return (
    <div className="screen">
      <Blob />
      <header className="hero-head">
        <div className="txt">
          <h1 className="title-xl">Favoris</h1>
          <p className="sub">Retrouvez les produits de la boutique que vous avez aimés.</p>
        </div>
        <div className="art heart-art" aria-hidden><Icon name="heartFill" /></div>
      </header>

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-art"><Icon name="box" /></div>
          <h2>Aucun favori pour le moment</h2>
          <p>Touchez le cœur sur un produit de la boutique pour le retrouver ici.</p>
          <Link href="/marketplace" className="btn btn-primary btn-md">Voir la boutique<Icon name="arrow" /></Link>
        </div>
      ) : (
        <div className="stack section" style={{ gap: 12 }}>
          {items.map((f) => (
            <Link key={f.id} href={`/marketplace/${f.id}`} className="row-card" style={{ position: 'relative' }}>
              <span className="pic">{f.image ? <img src={f.image} alt="" /> : <Icon name={iconFor(f.sub ?? f.name)} />}</span>
              <span className="grow">
                <h3 style={{ paddingRight: 36 }}>{f.name}</h3>
                {f.sub && <span className="meta" style={{ marginTop: 4 }}><span>{f.sub}</span></span>}
                <span className="meta" style={{ marginTop: 4 }}>
                  {f.price !== undefined && <span className="price" style={{ fontSize: 16 }}>{fcfa(f.price)}</span>}
                </span>
              </span>
              <HeartButton fav={f} className="heart fav-corner" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
