'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { fcfa } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { labelImage } from '@/lib/images';
import { BackButton, HeartButton, productFav } from '@/components/ds';
import { useCart } from '@/components/session';
import { ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

/** Fiche produit (maquette 10). */
export default function ProductPage({ params }: { params: { id: string } }) {
  const { data: p, error } = useFetch<any>(`/products/${params.id}`);
  const cart = useCart();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const goTo = (i: number) => { setImg(i); track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' }); };
  // Plusieurs photos : elles défilent toutes seules (pause dès que le client touche l'image).
  const [paused, setPaused] = useState(false);
  const count = p?.images?.length ?? 0;
  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
      setImg(next);
    }, 3500);
    return () => clearInterval(t);
  }, [count, paused]);
  useEffect(() => { if (!paused) return; const t = setTimeout(() => setPaused(false), 8000); return () => clearTimeout(t); }, [paused]);
  if (error) return <div className="screen"><div className="page-head"><BackButton href="/marketplace" /></div><ErrorBox error={error} /></div>;
  if (!p) return <div className="screen"><Loading rows={3} height={200} /></div>;
  const price = p.promoPrice ?? p.price;
  const images: string[] = p.images ?? [];

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: p.name, url: location.href });
      else { await navigator.clipboard.writeText(location.href); toast('Lien copié'); }
    } catch {}
  };

  const add = () => {
    cart.add({ productId: p._id, name: p.name, unitPrice: price, image: images[0], stock: p.stock }, qty);
    toast(`${qty} × ${p.name} ajouté au panier`);
  };

  return (
    <div className="pd-full">

      <div className="pd-top">
        <BackButton href="/marketplace" />
        <button className="pd-round" onClick={share} aria-label="Partager"><Icon name="share" /></button>
      </div>

      <div className="pd-media free">
        {images.length > 0 ? (
          <div className="pd-track" ref={track} onPointerDown={() => setPaused(true)} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== img) setImg(i); }}>
            {images.map((u, i) => <div key={u + i} className="pd-slide"><img src={u} alt={i === 0 ? p.name : ''} loading={i === 0 ? 'eager' : 'lazy'} /></div>)}
          </div>
        ) : (
          <div className="pd-track"><div className="pd-slide empty">{labelImage(p.categoryId?.name) ? <img src={labelImage(p.categoryId?.name)!} alt={p.name} /> : <Icon name={iconFor(p.categoryId?.name ?? p.name)} />}</div></div>
        )}
        {p.promoPrice && <span className="pd-promo">-{Math.round((1 - p.promoPrice / p.price) * 100)} %</span>}
      </div>
      <div className="pd-shade" aria-hidden />
      <div className="pd-spacer" />
      {images.length > 1 && <div className="pd-dots">{images.map((u, i) => <button key={u + i} className={i === img ? 'on' : ''} onClick={() => goTo(i)} aria-label={`Image ${i + 1}`} />)}</div>}

      <div className="pd-info">
        <div className="pd-head">
          <h1>{p.name}</h1>
          {(p.brand || p.categoryId?.name) && <span>{p.brand ?? p.categoryId?.name}</span>}
        </div>
        <p className="pd-desc">{p.description || `${p.categoryId?.name ?? 'Produit'} disponible dans la boutique Depanno Expresse.`}</p>
        <p className="pd-tags">
          <span>{p.stock > 0 ? (p.stock <= 5 ? `Plus que ${p.stock} en stock` : 'En stock') : 'Épuisé'}</span>
          {p.reference && <span>Réf. {p.reference}</span>}
          {p.warranty && <span>Garantie {p.warranty}</span>}
        </p>

        <div className="pd-price">
          <span className="grow"><b>{fcfa(price)}</b>{p.promoPrice && <s>{fcfa(p.price)}</s>}</span>
          {p.stock > 0 && (
            <span className="pd-qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Diminuer la quantité">−</button>
              <span aria-live="polite">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(p.stock, q + 1))} disabled={qty >= p.stock} aria-label="Augmenter la quantité">+</button>
            </span>
          )}
        </div>

        <div className="pd-bottom">
          <HeartButton fav={productFav(p)} className="pd-round pd-heart" />
          {p.stock > 0
            ? <button className="pd-add" onClick={add}><span>Ajouter au panier</span><i><Icon name="cart" /></i></button>
            : <Link href="/marketplace" className="pd-add"><span>Voir d’autres produits</span><i><Icon name="arrow" /></i></Link>}
        </div>
      </div>
    </div>
  );
}
