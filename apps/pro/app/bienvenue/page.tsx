'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '@/components/icons';
import { Skyline, Swoosh } from '@/components/ds';
import { WELCOME_KEY } from '@/lib/api';
import { IMAGES } from '@/lib/images';

/** Écran d'accueil de l'espace professionnels (même composition que l'écran Bienvenue client). */
export default function WelcomePage() {
  useEffect(() => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} }, []);
  return (
    <div className="screen no-nav">
      <div className="welcome-hero" style={{ backgroundImage: `url(${IMAGES.professionals.workshop})` }} role="img" aria-label="Mécanicien au travail" />
      <img className="welcome-logo" src={IMAGES.brand.full} alt="Depanno Expresse" />
      <h1 className="welcome-title">Espace<span>Professionnels</span></h1>
      <Swoosh width={230} />
      <p className="center" style={{ marginTop: 16, fontSize: 16, color: 'var(--navy)', lineHeight: 1.45 }}>
        Recevez des demandes de dépannage près de vous, envoyez vos devis et factures, et suivez vos gains.
      </p>
      <div className="feat">
        <div><Icon name="bolt" />Demandes<br />à proximité</div>
        <div><Icon name="docFill" />Devis et<br />factures</div>
        <div><Icon name="cardFill" />Paiement<br />sécurisé</div>
      </div>
      <div className="stack">
        <Link href="/connexion" className="btn btn-primary btn-block">Se connecter<Icon name="chevR" className="chev" /></Link>
        <Link href="/inscription" className="btn btn-outline btn-block"><Icon name="userPlusFill" />Devenir professionnel partenaire</Link>
      </div>
      <Skyline />
    </div>
  );
}
