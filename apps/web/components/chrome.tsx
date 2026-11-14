'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { Icon } from './icons';
import { Modal } from './ui';
import { BackButton } from './ds';
import { useCart, useFavs, usePlace } from './session';
import { fcfa } from '@/lib/format';
import { COMMUNES } from '@/lib/format';

const TABS = [
  { href: '/', label: 'Découvrir', icon: 'home', iconOn: 'homeFill' },
  { href: '/marketplace', label: 'Boutique', icon: 'shop', iconOn: 'cartFill' },
  { href: '/recherche', label: 'Recherche', icon: 'search', iconOn: 'search' },
  { href: '/favoris', label: 'Favoris', icon: 'heart', iconOn: 'heartFill' },
  { href: '/compte', label: 'Profil', icon: 'user', iconOn: 'userFill' },
];

const AUTH = ['/connexion', '/inscription', '/mot-de-passe-oublie', '/compte', '/entreprises', '/actualites', '/aide', '/a-propos', '/confidentialite'];
const SHOP = ['/marketplace', '/catalogue', '/panier'];
/** Pages ouvertes depuis Découvrir (services, professionnels, dépannage). */
const DISCOVER = ['/services', '/professionnels', '/depannage'];

/** Barre de navigation inférieure (5 rubriques, onglet actif orange souligné). */
export function TabBar() {
  const pathname = usePathname();
  const favs = useFavs();
  if (pathname.startsWith('/bienvenue')) return null;
  const active = (href: string) => {
    if (href === '/') return pathname === '/' || DISCOVER.some((p) => pathname.startsWith(p));
    if (href === '/marketplace') return SHOP.some((p) => pathname.startsWith(p));
    if (href === '/compte') return AUTH.some((p) => pathname.startsWith(p));
    return pathname.startsWith(href);
  };
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((t) => {
        const on = active(t.href);
        return (
          <Link key={t.href} href={t.href} className={`tab${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon name={on ? t.iconOn : t.icon} />
            <span>{t.label}</span>
            {t.href === '/favoris' && favs.list.length > 0 && !on && <span className="b">{favs.list.length}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Choix de la position : GPS (avec autorisation) ou commune. */
export function PlacePicker() {
  const { picking, setPicking, setPlace } = usePlace();
  const [msg, setMsg] = useState<string | null>(null);
  if (!picking) return null;
  const gps = () => {
    if (!navigator.geolocation) return setMsg('La géolocalisation n’est pas disponible sur cet appareil.');
    setMsg('Autorisez la localisation dans la fenêtre de votre navigateur…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPlace({ label: 'Ma position', detail: 'Position GPS', lat: p.coords.latitude, lng: p.coords.longitude }); setMsg(null); setPicking(false); },
      () => setMsg('Position refusée ou indisponible : choisissez votre commune ci-dessous.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <Modal title="Où êtes-vous ?" onClose={() => setPicking(false)}>
      <button className="btn btn-primary btn-block" onClick={gps}><Icon name="gps" />Utiliser ma position GPS</button>
      {msg && <p className="small text-2 center mt-s">{msg}</p>}
      <p style={{ margin: '20px 0 10px', fontWeight: 600, color: 'var(--navy)' }}>Ou choisissez votre commune</p>
      <div className="tags">
        {COMMUNES.map((c) => (
          <button key={c.name} className="opt" onClick={() => { setPlace({ label: c.name, detail: 'Bénin', lat: c.lat, lng: c.lng }); setPicking(false); }}>{c.name}</button>
        ))}
      </div>
    </Modal>
  );
}

/** Titre de page avec retour (pages secondaires) — compatibilité. */
export function PageTitle({ title, back, children }: { title: string; back?: string | true; children?: ReactNode }) {
  return (
    <div className="page-head">
      {back && <BackButton href={typeof back === 'string' ? back : undefined} />}
      <h1 className="grow">{title}</h1>
      {children}
    </div>
  );
}

/** Panier toujours visible dans la boutique (bouton flottant au-dessus de la barre du bas). */
export function FloatingCart() {
  const pathname = usePathname();
  const { count, total } = useCart();
  if (!SHOP.some((p) => pathname.startsWith(p)) || pathname.startsWith('/panier')) return null;
  return (
    <Link href="/panier" className={`float-cart${count ? '' : ' empty'}`} aria-label={`Mon panier, ${count} article(s)`}>
      <span className="ic"><Icon name="cartFill" />{count > 0 && <span className="n">{count > 99 ? '99+' : count}</span>}</span>
      <span className="txt"><b>Mon panier</b><small>{count ? fcfa(total) : 'vide'}</small></span>
    </Link>
  );
}
