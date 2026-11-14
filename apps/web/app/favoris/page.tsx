'use client';

import Link from 'next/link';
import { useState } from 'react';
import { fcfa } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { Blob, HeartButton, Seg } from '@/components/ds';
import { useFavs } from '@/components/session';

/** Onglet « Favoris » (maquette 9) : bascule Professionnels / Produits, état vide illustré. */
export default function FavoritesPage() {
  const { list } = useFavs();
  const [tab, setTab] = useState<'pro' | 'product'>('pro');
  const items = list.filter((f) => f.kind === tab);
  return (
    <div className="screen">
      <Blob />
      <header className="hero-head">
        <div className="txt">
          <h1 className="title-xl">Favoris</h1>
          <p className="sub">Retrouvez vos professionnels et produits préférés.</p>
        </div>
        <div className="art heart-art" aria-hidden><Icon name="heartFill" /></div>
      </header>

      <Seg value={tab} onChange={setTab} options={[
        { value: 'pro', label: 'Professionnels', icon: 'users' },
        { value: 'product', label: 'Produits', icon: 'bag' },
      ]} />

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-art"><Icon name="box" /></div>
          <h2>Aucun favori pour le moment</h2>
          <p>Touchez le cœur sur un {tab === 'pro' ? 'professionnel' : 'produit'} pour le retrouver ici.</p>
          <Link href={tab === 'pro' ? '/professionnels' : '/marketplace'} className="btn btn-primary btn-md">Explorer maintenant<Icon name="arrow" /></Link>
        </div>
      ) : (
        <div className="stack section" style={{ gap: 12 }}>
          {items.map((f) => (
            <Link key={f.id} href={f.kind === 'pro' ? `/professionnels/${f.id}` : `/marketplace/${f.id}`} className="row-card" style={{ position: 'relative' }}>
              <span className="pic">{f.image ? <img src={f.image} alt="" /> : <Icon name={iconFor(f.sub ?? f.name)} />}</span>
              <span className="grow">
                <h3 style={{ paddingRight: 36 }}>{f.name}</h3>
                {f.sub && <span className="meta" style={{ marginTop: 4 }}><span>{f.sub}</span></span>}
                <span className="meta" style={{ marginTop: 4 }}>
                  {f.price !== undefined && <span className="price" style={{ fontSize: 16 }}>{fcfa(f.price)}</span>}
                  {f.rating ? <span><Icon name="star" className="star" />{f.rating.toFixed(1)}</span> : null}
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
