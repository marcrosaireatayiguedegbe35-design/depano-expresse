'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES, fcfa } from '@/lib/format';
import { useCart, useSession } from '@/components/session';
import { BackButton } from '@/components/ds';
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

  const count = cart.items.reduce((n, i) => n + i.quantity, 0);
  const addReco = (p: any) => {
    cart.add({ productId: p._id, name: p.name, unitPrice: p.promoPrice ?? p.price, image: p.images?.[0], stock: p.stock }, 1);
    toast(`${p.name} ajouté au panier`);
  };
  const go = () => (user ? setCheckout(true) : router.push('/connexion?next=/panier'));

  return (
    <div className="screen ct">
      <header className="dc-head">
        <BackButton href="/marketplace" />
        <div className="grow"><h1>Mon panier</h1><p>{count ? `${count} article${count > 1 ? 's' : ''}` : 'Aucun article pour le moment'}</p></div>
        {cart.items.length > 0 && <button className="ct-clear" onClick={() => { if (confirm('Vider le panier ?')) cart.clear(); }}>Vider</button>}
      </header>

      {cart.items.length === 0 ? (
        <div className="ct-empty">
          <span className="ct-empty-ic"><Icon name="cartFill" /></span>
          <h2>Votre panier est vide</h2>
          <p>Ajoutez des pièces et accessoires depuis la boutique.</p>
          <Link href="/marketplace" className="pd-add ct-cta"><span>Voir la boutique</span><i><Icon name="arrow" /></i></Link>
        </div>
      ) : (
        <>
          <div className="ct-list">
            {cart.items.map((i) => (
              <div key={i.productId} className="ct-item">
                <Link href={`/marketplace/${i.productId}`} className="ct-pic">{i.image ? <img src={i.image} alt="" /> : <Icon name="cartFill" />}</Link>
                <div className="grow">
                  <Link href={`/marketplace/${i.productId}`} className="ct-name">{i.name}</Link>
                  <small>{fcfa(i.unitPrice)} l’unité</small>
                  <div className="ct-row">
                    <b>{fcfa(i.unitPrice * i.quantity)}</b>
                    <span className="ct-qty">
                      <button onClick={() => (i.quantity <= 1 ? cart.remove(i.productId) : cart.setQty(i.productId, i.quantity - 1))} aria-label={`Retirer un ${i.name}`}>{i.quantity <= 1 ? <Icon name="trash" /> : '−'}</button>
                      <span>{i.quantity}</span>
                      <button onClick={() => cart.setQty(i.productId, i.quantity + 1)} disabled={i.quantity >= i.stock} aria-label={`Ajouter un ${i.name}`}>+</button>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="ct-sum">
            <div className="ct-line"><span>Sous-total ({count} article{count > 1 ? 's' : ''})</span><b>{fcfa(cart.total)}</b></div>
            <div className="ct-line"><span>Livraison</span><b>Confirmée à la commande</b></div>
            <div className="ct-total"><span>Total</span><b>{fcfa(cart.total)}</b></div>
            <p className="ct-note"><Icon name="shield" />Paiement à la livraison ou Mobile Money · prix et stock vérifiés à la commande.</p>
            <button className="pd-add ct-cta" onClick={go}><span>{user ? 'Passer la commande' : 'Se connecter pour commander'}</span><i><Icon name="arrow" /></i></button>
          </section>
        </>
      )}

      {recommendations.length > 0 && (
        <section className="section">
          <div className="dc-sec"><h2>Vous aimerez aussi</h2><Link href="/marketplace">Voir plus</Link></div>
          <div className="dc-shop">
            {recommendations.map((p: any) => (
              <Link key={p._id} href={`/marketplace/${p._id}`} className="dc-prod">
                <span className="pic">{p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <Icon name="cartFill" />}{p.promoPrice ? <i className="promo">Promo</i> : null}</span>
                <b>{p.name}</b>
                <span className="price">{fcfa(p.promoPrice ?? p.price)}</span>
                {p.promoPrice ? <s>{fcfa(p.price)}</s> : <small>{p.brand ?? ''}</small>}
                <button type="button" className="add" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addReco(p); }} aria-label={`Ajouter ${p.name} au panier`}><Icon name="plus" /></button>
              </Link>
            ))}
          </div>
        </section>
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
