'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '@/components/icons';
import { Swoosh } from '@/components/ds';
import { WELCOME_KEY } from '@/lib/api';
import { IMAGES } from '@/lib/images';

/** Écran « Bienvenue sur Depanno Expresse » (maquette 6). */
export default function WelcomePage() {
  useEffect(() => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} }, []);
  return (
    <div className="screen no-nav fit-welcome">
      <div className="welcome-hero" style={{ backgroundImage: `url(${IMAGES.home.towTruck})` }} role="img" aria-label="Dépanneuse transportant une voiture" />
      <Link href="/" className="skip">Passer <Icon name="chevR" /></Link>

      <img className="welcome-logo" src={IMAGES.brand.full} alt="Depanno Expresse" />
      <h1 className="welcome-title">Bienvenue sur<span>Depanno Expresse</span></h1>
      <Swoosh width={230} />
      <p className="center" style={{ marginTop: 16, fontSize: 17, color: 'var(--navy)', lineHeight: 1.45 }}>
        Un professionnel, une entreprise, ou un particulier pour tous vos besoins automobiles.
      </p>

      <div className="feat">
        <div><Icon name="shieldFill" />Sécurité<br />garantie</div>
        <div><Icon name="bolt" />Rapidité<br />d’accès</div>
        <div><Icon name="handshake" />Confiance<br />et proximité</div>
      </div>

      <div className="stack">
        <Link href="/connexion" className="btn btn-primary btn-block">Commencer avec mon e-mail<Icon name="chevR" className="chev" /></Link>
        <Link href="/inscription" className="btn btn-outline btn-block"><Icon name="userPlusFill" />Créer un compte</Link>
      </div>

    </div>
  );
}
