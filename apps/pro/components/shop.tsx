'use client';

/* Boutique de l'espace professionnel : mêmes composants et même design que la marketplace client
   (carte produit, badge de stock, bannière publicitaire, panier flottant), panier propre au pro. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fcfa } from '@/lib/format';
import { IMAGES, labelImage } from '@/lib/images';
import { Icon } from './icons';
import { useFetch, useToast } from './ui';
import { useSession } from './session';
import { useAccountCart } from './cart-sync';

/* ---------- Panier (stocké dans le navigateur, séparé de celui du client) ---------- */

export interface CartItem { productId: string; name: string; unitPrice: number; quantity: number; image?: string; stock: number }

interface CartValue {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  total: number;
}

const CartCtx = createContext<CartValue>(null!);
export const useCart = () => useContext(CartCtx);
const CART_KEY = 'pa_pro_cart_v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const { pro, loading } = useSession();
  // Panier enregistré sur le compte du professionnel (même panier sur tous les appareils).
  const { items, save } = useAccountCart(pro?._id ?? null, !loading, CART_KEY);
  const value: CartValue = {
    items,
    add: (item, qty = 1) => {
      const existing = items.find((i) => i.productId === item.productId);
      save(existing
        ? items.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.min(i.quantity + qty, item.stock) } : i))
        : [...items, { ...item, quantity: Math.min(qty, item.stock) }]);
    },
    setQty: (id, qty) => save(items.map((i) => (i.productId === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.stock)) } : i))),
    remove: (id) => save(items.filter((i) => i.productId !== id)),
    clear: () => save([]),
    count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
  };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

/* ---------- Carte produit ---------- */

export function StockPill({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="stock out">Rupture</span>;
  if (stock <= 5) return <span className="stock low"><Icon name="checkCircle" />Plus que {stock}</span>;
  return <span className="stock"><Icon name="checkCircle" />En stock</span>;
}

export function ProductCard({ p }: { p: any }) {
  const cart = useCart();
  const toast = useToast();
  const price = p.promoPrice ?? p.price;
  const ribbon = p.topSeller ? { icon: 'fire', label: 'Top vente' } : p.isNew ? { icon: 'star', label: 'Nouveau' } : p.promoPrice ? { icon: 'tag', label: 'Promo' } : null;
  return (
    <article className="prod-card">
      <Link href={`/produit?id=${p._id}`} className="pic" aria-label={`Voir ${p.name}`}>
        {ribbon && <span className="ribbon"><Icon name={ribbon.icon} />{ribbon.label}</span>}
        {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : labelImage(p.categoryId?.name) ? <img src={labelImage(p.categoryId?.name)!} alt="" loading="lazy" /> : <Icon name="cart" className="ph" />}
      </Link>
      <div>
        <Link href={`/produit?id=${p._id}`}><h3>{p.name}</h3></Link>
        <p className="brand">{p.brand ?? p.categoryId?.name}</p>
        <p className="price">{fcfa(price)}{p.promoPrice && <span className="old-price">{fcfa(p.price)}</span>}</p>
        <div className="foot">
          <StockPill stock={p.stock} />
          <button className="btn btn-primary btn-sm" disabled={p.stock <= 0} onClick={() => {
            cart.add({ productId: p._id, name: p.name, unitPrice: price, image: p.images?.[0], stock: p.stock }, 1);
            toast('Ajouté au panier');
          }}><Icon name="cart" />Ajouter</button>
        </div>
      </div>
    </article>
  );
}

/* ---------- Bannière publicitaire ---------- */

export function AdBanner({ placement, limit = 3 }: { placement: string; limit?: number }) {
  const { data } = useFetch<any[]>(`/ads?placement=${placement}&limit=${limit}`);
  const [i, setI] = useState(0);
  const ads = data ?? [];
  const a = ads[i % Math.max(ads.length, 1)];
  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % ads.length), 6000);
    return () => clearInterval(t);
  }, [ads.length]);
  useEffect(() => { if (a?._id) api(`/ads/${a._id}/impression`, { method: 'POST' }).catch(() => {}); }, [a?._id]);
  if (!a) return null;
  const href = a.link || a.website || a.companyId?.website;
  const click = () => api(`/ads/${a._id}/click`, { method: 'POST' }).catch(() => {});
  const cta = <>{a.ctaLabel || 'Profiter maintenant'}<Icon name="chevR" /></>;
  return (
    <>
      <section key={a._id} className="banner short" aria-roledescription="publicité">
        <div className="copy">
          <span className="tagpill yellow">{(a.sponsoredLabel || 'Publicité').toUpperCase()}</span>
          <h2>{a.title}{a.companyId?.name && <><br /><span className="tail" style={{ fontWeight: 500 }}>{a.companyId.name}</span></>}</h2>
          {href ? <a className="cta plain" href={href} target="_blank" rel="sponsored noopener noreferrer" onClick={click}>{cta}</a> : <span className="cta plain">{cta}</span>}
        </div>
        {a.imageUrl ? <div className="art"><img src={a.imageUrl} alt="" /></div> : <div className="art person"><img src={IMAGES.advertisements.fallback} alt="" /></div>}
      </section>
      {ads.length > 1 && <div className="dots">{ads.map((x, k) => <button key={x._id} className={k === i % ads.length ? 'on' : ''} onClick={() => setI(k)} aria-label={`Publicité ${k + 1}`} />)}</div>}
    </>
  );
}

/* ---------- Panier flottant ---------- */

const SHOP = ['/boutique', '/produit', '/panier'];

/** Panier toujours visible dans la boutique (bouton flottant au-dessus de la barre du bas). */
export function FloatingCart() {
  const pathname = usePathname();
  const { count, total } = useCart();
  if (!SHOP.some((p) => pathname.startsWith(p)) || pathname.startsWith('/panier') || pathname.startsWith('/produit')) return null;
  return (
    <Link href="/panier" className={`float-cart${count ? '' : ' empty'}`} aria-label={`Mon panier, ${count} article(s)`}>
      <span className="ic"><Icon name="cartFill" />{count > 0 && <span className="n">{count > 99 ? '99+' : count}</span>}</span>
      <span className="txt"><b>Mon panier</b><small>{count ? fcfa(total) : 'vide'}</small></span>
    </Link>
  );
}
