'use client';

import { useSearchParams } from 'next/navigation';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { fcfa } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { labelImage } from '@/lib/images';
import { BackButton, HeartButton, Perks, productFav } from '@/components/ds';
import { useCart } from '@/components/session';
import { ErrorBox, Loading, Modal, useFetch, useToast } from '@/components/ui';

/** Photo en fond plein écran : Cloudinary la prépare au format portrait du téléphone (sujet gardé au centre),
 *  agrandie et renforcée en netteté, pour limiter le flou des photos de petite taille. */
const CLD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/;
const fullScreen = (u: string) => u.replace(CLD, '$1c_fill,g_auto,w_1000,h_2000,e_sharpen:120,q_auto,f_auto/');
/** Petite photo (moins de 1200 px) : elle ne remplit que le haut de l'écran, moins agrandie donc plus nette. */
const halfScreen = (u: string) => u.replace(CLD, '$1c_fill,g_auto,w_1000,h_1250,e_sharpen:120,q_auto,f_auto/');
const SMALL = 1200;

/** Fiche produit (maquette 10). */
function ProductPage({ params }: { params: { id: string } }) {
  const { data: p, error } = useFetch<any>(`/products/${params.id}`);
  const cart = useCart();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [details, setDetails] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const goTo = (i: number) => { setImg(i); track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' }); };
  // Taille réelle de chaque photo publiée : décide plein écran ou moitié haute.
  const [sizes, setSizes] = useState<Record<string, number>>({});
  useEffect(() => {
    (p?.images ?? []).forEach((u: string) => {
      const im = new Image();
      im.onload = () => setSizes((s) => ({ ...s, [u]: Math.max(im.naturalWidth, im.naturalHeight) }));
      im.src = u;
    });
  }, [p?.images]);
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
            {images.map((u, i) => {
              const half = sizes[u] !== undefined && sizes[u] < SMALL;
              return <div key={u + i} className={`pd-slide${half ? ' half' : ''}`}>{sizes[u] !== undefined && <img src={half ? halfScreen(u) : fullScreen(u)} alt={i === 0 ? p.name : ''} />}</div>;
            })}
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
        <button type="button" className="pd-more" onClick={() => setDetails(true)}><Icon name="info" />Détails du produit<Icon name="chevR" /></button>
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

      {details && (
        <Modal title={p.name} onClose={() => setDetails(false)}>
          <div className="pdd">
            <div className="pdd-price"><b>{fcfa(price)}</b>{p.promoPrice && <s>{fcfa(p.price)}</s>}{p.promoPrice && <span>-{Math.round((1 - p.promoPrice / p.price) * 100)} %</span>}</div>
            <div className="pdd-grid">
              {p.brand && <div><small>Marque</small><b>{p.brand}</b></div>}
              {p.categoryId?.name && <div><small>Catégorie</small><b>{p.categoryId.name}</b></div>}
              {p.reference && <div><small>Référence</small><b>{p.reference}</b></div>}
              <div><small>Disponibilité</small><b>{p.stock > 0 ? `${p.stock} en stock` : 'Épuisé'}</b></div>
              {p.warranty && <div><small>Garantie</small><b>{p.warranty}</b></div>}
            </div>
            <h3>Description</h3>
            <p className="pdd-text">{p.description || 'Aucune description fournie par le vendeur.'}</p>
            {p.compatibility?.length > 0 && <><h3>Compatible avec</h3><div className="tags">{p.compatibility.map((c: string) => <span key={c} className="opt sm">{c}</span>)}</div></>}
            {p.specs?.length > 0 && <><h3>Caractéristiques</h3><div>{p.specs.map((sp: any) => <div key={sp.name} className="kv"><span>{sp.name}</span><b>{sp.value}</b></div>)}</div></>}
            <h3>Nos garanties</h3>
            <Perks items={[{ icon: 'shieldFill', label: <>Paiement<br />sécurisé</> }, { icon: 'truckFast', label: <>Livraison<br />rapide</> }, { icon: 'headsetFill', label: <>Assistance<br />24/7</> }]} />
            {p.categoryId?._id && <Link className="btn btn-light btn-block" style={{ marginTop: 14 }} href={`/categorie?id=${p.categoryId._id}`}>Comparer les offres « {p.categoryId.name} »<Icon name="chevR" className="chev" /></Link>}
            {p.stock > 0 && <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => { add(); setDetails(false); }}><Icon name="cart" />Ajouter au panier · {qty} × {fcfa(price)}</button>}
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Adresse statique (hébergement Cloudflare Pages) : l'identifiant arrive dans l'adresse sous la forme ?id=… */
function FromQuery() {
  const id = useSearchParams().get('id') ?? '';
  return <ProductPage key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense><FromQuery /></Suspense>;
}
