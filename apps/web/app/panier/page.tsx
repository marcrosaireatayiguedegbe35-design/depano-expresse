'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES, fcfa } from '@/lib/format';
import { useCart, useSession } from '@/components/session';
import { Blob, PageHead, ProductCard } from '@/components/ds';
import { Icon } from '@/components/icons';
import { Empty, ErrorBox, Modal, useFetch, useToast } from '@/components/ui';

/** Panier (maquette « Your order » : articles, quantités, total, recommandations, Commander). */
export default function CartPage() {
  const cart = useCart();
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const recos = useFetch<any>('/products?limit=8&inStock=true&sort=price_asc');
  const [checkout, setCheckout] = useState(false);
  const [f, setF] = useState({ address: '', commune: user?.commune ?? 'Cotonou', phone: user?.phone ?? '+229', note: '', paymentMethod: 'cash_on_delivery' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recommendations = (recos.data?.items ?? []).filter((p: any) => !cart.items.some((i) => i.productId === p._id)).slice(0, 6);

  const order = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const o = await api('/orders', {
        method: 'POST',
        body: {
          items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          delivery: { address: f.address, commune: f.commune, phone: f.phone.replace(/\s/g, ''), ...(f.note ? { note: f.note } : {}) },
          paymentMethod: f.paymentMethod,
        },
      });
      cart.clear();
      toast(`Commande ${o.number} enregistrée`);
      router.push('/compte/commandes');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <Blob soft />
      <PageHead title="Mon panier" />
      {cart.items.length === 0 ? (
        <Empty icon="cart" title="Votre panier est vide"><Link href="/marketplace" className="btn btn-primary btn-md" style={{ marginTop: 14 }}>Découvrir la marketplace</Link></Empty>
      ) : (
        <>
          <div className="stack" style={{ gap: 12 }}>
          {cart.items.map((i) => (
            <div key={i.productId} className="row-card">
              <Link href={`/marketplace/${i.productId}`} className="list-thumb">{i.image ? <img src={i.image} alt="" /> : <Icon name="cart" />}</Link>
              <div className="grow">
                <h3>{i.name}</h3>
                <span className="price" style={{ fontSize: 17 }}>{fcfa(i.unitPrice * i.quantity)}</span>
              </div>
              <div className="qty sm">
                <button className="minus" onClick={() => (i.quantity <= 1 ? cart.remove(i.productId) : cart.setQty(i.productId, i.quantity - 1))} aria-label={`Retirer un ${i.name}`}>−</button>
                <span>{i.quantity}</span>
                <button className="plus" onClick={() => cart.setQty(i.productId, i.quantity + 1)} disabled={i.quantity >= i.stock} aria-label={`Ajouter un ${i.name}`}>+</button>
              </div>
            </div>
          ))}
          </div>
          <div className="card peach total-line" style={{ marginTop: 16 }}><span>Total</span><span className="price">{fcfa(cart.total)}</span></div>
          <p className="xs text-2" style={{ marginTop: 8 }}>Prix et stock vérifiés au moment de la commande.</p>
        </>
      )}

      {recommendations.length > 0 && (
        <section className="section">
          <div className="sec-head"><h2>Recommandations</h2></div>
          <div className="stack" style={{ gap: 12 }}>{recommendations.slice(0, 3).map((p: any) => <ProductCard key={p._id} p={p} />)}</div>
        </section>
      )}

      {cart.items.length > 0 && (
        <div className="sticky-actions single">
          <button className="btn btn-primary" onClick={() => (user ? setCheckout(true) : router.push('/connexion?next=/panier'))}>
            {user ? 'Passer la commande' : 'Se connecter pour commander'}&nbsp;· {fcfa(cart.total)}
          </button>
        </div>
      )}

      {checkout && (
        <Modal title="Livraison & paiement" onClose={() => setCheckout(false)}>
          <form onSubmit={order}>
            <div className="field"><label htmlFor="ad">Adresse de livraison</label><input id="ad" required minLength={3} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Quartier, rue, repère" /></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="co">Commune</label><select id="co" value={f.commune} onChange={(e) => setF({ ...f, commune: e.target.value })}>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
              <div className="field"><label htmlFor="ph">Téléphone</label><input id="ph" type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            </div>
            <div className="field"><label htmlFor="no">Instructions (facultatif)</label><input id="no" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
            <p style={{ fontWeight: 600, margin: "8px 0 4px", color: "var(--navy)" }}>Paiement</p>
            <label className="radio-row"><input type="radio" name="pay" checked={f.paymentMethod === 'cash_on_delivery'} onChange={() => setF({ ...f, paymentMethod: 'cash_on_delivery' })} /><span className="grow">Paiement à la livraison</span></label>
            <label className="radio-row"><input type="radio" name="pay" checked={f.paymentMethod === 'mobile_money'} onChange={() => setF({ ...f, paymentMethod: 'mobile_money' })} /><span className="grow">Mobile Money</span></label>
            <ErrorBox error={error} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Commande…' : `Confirmer · ${fcfa(cart.total)}`}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
