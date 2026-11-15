'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { fcfa } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { labelImage } from '@/lib/images';
import { BackButton, HeartButton, Perks, productFav, StockPill } from '@/components/ds';
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

  return (
    <div className="screen">
      <div className="pg">
        <div className="pg-tools">
          <BackButton href="/marketplace" />
          <div className="r">
            <HeartButton fav={productFav(p)} className="back-btn heart-inline" />
            <button className="back-btn" onClick={share} aria-label="Partager"><Icon name="share" /></button>
          </div>
        </div>
        {images.length > 0 ? (
          <div className="pg-track" ref={track} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== img) setImg(i); }}>
            {images.map((u, i) => <div key={u + i} className="pg-slide"><img src={u} alt={i === 0 ? p.name : ''} loading={i === 0 ? 'eager' : 'lazy'} /></div>)}
          </div>
        ) : (
          <div className="pg-track"><div className="pg-slide empty">{labelImage(p.categoryId?.name) ? <img src={labelImage(p.categoryId?.name)!} alt={p.name} /> : <Icon name={iconFor(p.categoryId?.name ?? p.name)} />}</div></div>
        )}
        {p.promoPrice && <span className="pg-promo">-{Math.round((1 - p.promoPrice / p.price) * 100)} %</span>}
        {images.length > 1 && <span className="pg-count">{img + 1} / {images.length}</span>}
      </div>
      {images.length > 1 && (
        <div className="pg-thumbs">
          {images.map((u, i) => <button key={u + i} className={i === img ? 'on' : ''} onClick={() => goTo(i)} aria-label={`Image ${i + 1}`}><img src={u} alt="" /></button>)}
        </div>
      )}

      <div className="sheet">
        <h1 className="prod-title">{p.name}</h1>
        {(p.brand || p.categoryId?.name) && <p className="brandline"><Icon name={iconFor(p.categoryId?.name ?? '')} />{p.brand ?? p.categoryId?.name}</p>}
        <p className="price-xl" style={{ marginTop: 10 }}>{fcfa(price)}{p.promoPrice && <span className="old-price">{fcfa(p.price)}</span>}</p>
        <div className="meta" style={{ marginTop: 10 }}>
          <StockPill stock={p.stock} />
          {p.reference && <><i className="sep" /><span>Réf. {p.reference}</span></>}
          {p.warranty && <><i className="sep" /><span><Icon name="shield" />Garantie {p.warranty}</span></>}
        </div>

        {p.stock > 0 ? (
          <div className="hstack" style={{ marginTop: 18, gap: 12 }}>
            <div className="qty">
              <button className="minus" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Diminuer la quantité">−</button>
              <span aria-live="polite">{qty}</span>
              <button className="plus" onClick={() => setQty((q) => Math.min(p.stock, q + 1))} disabled={qty >= p.stock} aria-label="Augmenter la quantité">+</button>
            </div>
            <button className="btn btn-primary grow" onClick={() => {
              cart.add({ productId: p._id, name: p.name, unitPrice: price, image: images[0], stock: p.stock }, qty);
              toast(`${qty} × ${p.name} ajouté au panier`);
            }}><Icon name="cart" />Ajouter au panier</button>
          </div>
        ) : <Link href="/marketplace" className="btn btn-outline btn-block" style={{ marginTop: 18 }}>Voir d’autres produits</Link>}

        <div className="section"><Perks items={[{ icon: 'shieldFill', label: <>Paiement<br />sécurisé</> }, { icon: 'truckFast', label: <>Livraison<br />rapide</> }, { icon: 'headsetFill', label: <>Assistance<br />24/7</> }]} /></div>

        <details className="desc-card section" open>
          <summary><span className="i">i</span>Description<Icon name="chevR" className="chev" /></summary>
          <div className="body">
            {p.description ? <p style={{ whiteSpace: 'pre-line' }}>{p.description}</p> : <p>Aucune description fournie par le vendeur.</p>}
            {p.compatibility?.length > 0 && <><p style={{ marginTop: 12, fontWeight: 600, color: 'var(--navy)' }}>Compatible avec</p><div className="tags" style={{ marginTop: 6 }}>{p.compatibility.map((c: string) => <span key={c} className="opt sm">{c}</span>)}</div></>}
            {p.specs?.length > 0 && <div style={{ marginTop: 12 }}>{p.specs.map((s: any) => <div key={s.name} className="kv"><span>{s.name}</span><b>{s.value}</b></div>)}</div>}
          </div>
        </details>
        {p.categoryId?._id && <Link className="btn btn-light btn-block section" href={`/catalogue/${p.categoryId._id}`}>Comparer les offres « {p.categoryId.name} »<Icon name="chevR" className="chev" /></Link>}
      </div>
    </div>
  );
}
