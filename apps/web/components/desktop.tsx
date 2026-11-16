'use client';

/* En-tête et pied de page des grands écrans (ordinateur, tablette en paysage).
   Masqués sur téléphone par le CSS : la version mobile garde sa barre du bas. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';
import { useCart, useFavs, usePlace, useSession } from './session';
import { useFetch } from './ui';
import { TRADES } from '@/lib/format';

const PRO_SITE = 'https://depanno-expresse-professionnel.pages.dev';

const NAV = [
  { href: '/', label: 'Accueil', match: (p: string) => p === '/' },
  { href: '/services', label: 'Dépannage', match: (p: string) => ['/services', '/service', '/depannage'].some((x) => p.startsWith(x)) },
  { href: '/professionnels', label: 'Professionnels', match: (p: string) => p.startsWith('/professionnel') || p.startsWith('/recherche') },
  { href: '/marketplace', label: 'Boutique', match: (p: string) => ['/marketplace', '/produit', '/categorie', '/catalogue', '/panier'].some((x) => p.startsWith(x)) },
  { href: '/entreprises', label: 'Entreprises', match: (p: string) => p.startsWith('/entreprise') },
  { href: '/actualites', label: 'Actualités', match: (p: string) => p.startsWith('/actualite') },
];

export function DesktopHeader() {
  const pathname = usePathname();
  const { user } = useSession();
  const { place, setPicking } = usePlace();
  const cart = useCart();
  const favs = useFavs();
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  if (pathname.startsWith('/bienvenue')) return null;
  const unread = notifs.data?.unread ?? 0;
  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : '';

  return (
    <header className="dk-head">
      <div className="dk-head-in">
        <Link href="/" className="dk-logo" aria-label="Depanno Expresse, accueil"><img src="/images/brand/logo-depanno-expresse.png" alt="Depanno Expresse" /></Link>
        <nav className="dk-nav" aria-label="Navigation principale">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={n.match(pathname) ? 'on' : ''} aria-current={n.match(pathname) ? 'page' : undefined}>{n.label}</Link>)}
        </nav>
        <div className="dk-tools">
          <button type="button" className="dk-place" onClick={() => setPicking(true)} aria-label="Changer ma position">
            <Icon name="pinFill" /><span>{place.label}</span><Icon name="chevD" />
          </button>
          <Link href="/recherche" className="dk-ic" aria-label="Rechercher"><Icon name="search" /></Link>
          <Link href="/favoris" className="dk-ic" aria-label="Mes favoris"><Icon name="heart" />{favs.list.length > 0 && <i>{favs.list.length}</i>}</Link>
          <Link href="/panier" className="dk-ic" aria-label={`Mon panier, ${cart.count} article(s)`}><Icon name="cart" />{cart.count > 0 && <i>{cart.count > 9 ? '9+' : cart.count}</i>}</Link>
          {user ? (
            <>
              <Link href="/compte/notifications" className="dk-ic" aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}><Icon name="bell" />{unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}</Link>
              <Link href="/compte" className="dk-me" aria-label="Mon compte"><span>{initials || <Icon name="userFill" />}</span><b>{user.firstName}</b></Link>
            </>
          ) : (
            <Link href="/connexion" className="dk-login"><Icon name="user" />Se connecter</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function DesktopFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/bienvenue')) return null;
  return (
    <footer className="dk-foot">
      <div className="dk-foot-in">
        <div className="dk-foot-brand">
          <img src="/images/brand/logo-depanno-expresse.png" alt="Depanno Expresse" />
          <p>Des professionnels vérifiés près de chez vous pour le dépannage, l’entretien et les pièces de votre véhicule, partout au Bénin.</p>
          <span className="dk-badges"><span><Icon name="shieldFill" />Pros vérifiés</span><span><Icon name="clock" />24h/24</span></span>
        </div>
        <div>
          <h4>Dépannage</h4>
          {Object.entries(TRADES).slice(0, 5).map(([k, t]) => <Link key={k} href={`/service?trade=${k}`}>{t.label}</Link>)}
        </div>
        <div>
          <h4>Plateforme</h4>
          <Link href="/marketplace">Boutique</Link>
          <Link href="/professionnels">Professionnels</Link>
          <Link href="/entreprises">Annuaire des entreprises</Link>
          <Link href="/actualites">Actualités</Link>
        </div>
        <div>
          <h4>Aide</h4>
          <Link href="/aide">Aide &amp; FAQ</Link>
          <Link href="/a-propos">À propos</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <a href={PRO_SITE}>Espace professionnels</a>
        </div>
      </div>
      <div className="dk-foot-bottom">© {new Date().getFullYear()} Depanno Expresse · Dépannage · Mécanique · Assistance 24/7</div>
    </footer>
  );
}
