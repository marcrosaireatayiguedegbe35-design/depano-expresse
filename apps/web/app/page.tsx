'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { qs, WELCOME_KEY } from '@/lib/api';
import { fcfa, TRADES } from '@/lib/format';
import { IMAGES, tradeArt } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { AdBanner, TRADE_ICON } from '@/components/ds';
import { useCart, usePlace, useSession } from '@/components/session';
import { Loading, useFetch, useToast } from '@/components/ui';
import { Art } from '@/components/art';

/** Accueil « Découvrir » : salutation, bannière, position, services, offre, professionnels disponibles. */
export default function DiscoverPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const { place, setPicking } = usePlace();
  const products = useFetch<any>('/products?limit=8&sort=newest');
  const ads = useFetch<any[]>('/ads?placement=home&limit=4');
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  const cart = useCart();
  const toast = useToast();
  const addToCart = (e: React.MouseEvent, p: any) => {
    e.preventDefault();
    e.stopPropagation();
    const inCart = cart.items.find((i) => i.productId === p._id)?.quantity ?? 0;
    if (inCart >= p.stock) { toast('Stock maximum atteint pour ce produit'); return; }
    cart.add({ productId: p._id, name: p.name, unitPrice: p.promoPrice ?? p.price, image: p.images?.[0], stock: p.stock }, 1);
    toast(`${p.name} ajouté au panier`);
  };

  // Premier lancement sans compte : écran de bienvenue.
  useEffect(() => {
    if (loading || user) return;
    try { if (!localStorage.getItem(WELCOME_KEY)) router.replace('/bienvenue'); } catch {}
  }, [loading, user, router]);

  const trades = Object.keys(TRADES).slice(0, 4);
  const unread = notifs.data?.unread ?? 0;

  return (
    <div className="screen dc fit-screen">
      <header className="dc-head">
        <Link href="/compte" className="dc-menu" aria-label="Mon profil"><Icon name="filters" /></Link>
        <div className="grow">
          <h1>Bonjour{user ? `, ${user.firstName}` : ''} <span aria-hidden>👋</span></h1>
          <p>Un professionnel vérifié pour votre véhicule</p>
        </div>
        <Link href="/panier" className="dc-bell" aria-label={`Mon panier${cart.count ? `, ${cart.count} article(s)` : ', vide'}`}>
          <Icon name="cart" />{cart.count > 0 && <span className="count">{cart.count > 9 ? '9+' : cart.count}</span>}
        </Link>
        <Link href={user ? '/compte/notifications' : '/connexion?next=/compte/notifications'} className="dc-bell" aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
          <Icon name="bell" />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
        </Link>
      </header>

      <Link href="/services" className="dc-hero" style={{ backgroundImage: `url(${IMAGES.home.towTruck})` }}>
        <span className="dc-hero-copy">
          <small>Assistance 24h/24</small>
          <strong>Une panne ?<br />On arrive vite</strong>
          <em>Un pro vérifié près de vous</em>
          <span className="dk-only dc-hero-cta">Décrire ma panne<Icon name="arrow" /></span>
        </span>
      </Link>

      <button className="dc-loc" onClick={() => setPicking(true)} aria-label="Changer ma position">
        <Icon name="pinFill" className="pin" />
        <span className="grow"><b>{place.label}</b>{place.detail && place.detail !== 'Choisir ma position' && <small>{place.detail}</small>}</span>
        <Icon name="settings" className="gear" />
      </button>

      <ul className="dk-only dk-trust" aria-label="Nos garanties">
        <li><Icon name="shieldFill" /><span><b>Professionnels vérifiés</b><small>Identité et documents contrôlés</small></span></li>
        <li><Icon name="truckFast" /><span><b>Intervention rapide</b><small>Dépannage 24h/24, 7j/7</small></span></li>
        <li><Icon name="cardFill" /><span><b>Paiement sécurisé</b><small>Mobile Money ou espèces</small></span></li>
        <li><Icon name="pinFill" /><span><b>Suivi en temps réel</b><small>Voyez votre pro arriver</small></span></li>
      </ul>

      <section className="section">
        <div className="dc-sec"><h2>Nos services</h2><Link href="/services">Voir tout</Link></div>
        <div className="dc-services">
          {trades.map((k) => {
            const art = tradeArt(k);
            return (
              <Link key={k} href={`/service?trade=${k}`} className="dc-service">
                <span className="ic">{art ? <Art src={art} size={240} /> : <Icon name={TRADE_ICON[k] ?? iconFor(TRADES[k].label)} />}</span>
                <span>{TRADES[k].label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="dk-only dk-how" aria-label="Comment ça marche">
        <h2>Comment ça marche</h2>
        <ol>
          <li><span>1</span><b>Décrivez votre panne</b><small>Choisissez le service et cochez vos problèmes en quelques secondes.</small></li>
          <li><span>2</span><b>Un pro proche accepte</b><small>Seuls les professionnels vérifiés de votre zone reçoivent la demande.</small></li>
          <li><span>3</span><b>Suivez et payez en sécurité</b><small>Suivi en direct, devis validé par vous, paiement Mobile Money ou espèces.</small></li>
        </ol>
      </section>

      {(ads.data?.length ?? 0) > 0 && <section className="section dc-promo-wrap"><AdBanner placement="home" /></section>}


      <section className="section">
        <div className="dc-sec"><h2>Boutique</h2><Link href="/marketplace">Voir plus</Link></div>
        {!products.data ? <Loading rows={1} height={150} /> : products.data.items.length === 0
          ? <p className="text-2 small">La boutique sera bientôt garnie.</p>
          : (
            <div className="dc-shop">
              {products.data.items.map((p: any) => (
                <Link key={p._id} href={`/produit?id=${p._id}`} className="dc-prod">
                  <span className="pic">{p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <Icon name="cartFill" />}{p.promoPrice ? <i className="promo">Promo</i> : null}</span>
                  <b>{p.name}</b>
                  <span className="price">{fcfa(p.promoPrice ?? p.price)}</span>
                  {p.promoPrice ? <s>{fcfa(p.price)}</s> : <small>{p.brand ?? p.categoryId?.name ?? ''}</small>}
                  {p.stock > 0
                    ? <button type="button" className="add" onClick={(e) => addToCart(e, p)} aria-label={`Ajouter ${p.name} au panier`}><Icon name="plus" /></button>
                    : <em className="out">Épuisé</em>}
                </Link>
              ))}
              <Link href="/marketplace" className="dc-prod more"><span className="pic"><Icon name="arrow" /></span><b>Voir plus</b><small>Toute la boutique</small></Link>
            </div>
          )}
      </section>

    </div>
  );
}
