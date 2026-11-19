'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '@/components/icons';
import { Swoosh } from '@/components/ds';
import { WELCOME_KEY } from '@/lib/api';
import { IMAGES } from '@/lib/images';

/** Écran d'accueil de l'espace professionnels (même composition que l'écran Bienvenue client). */
export default function WelcomePage() {
  useEffect(() => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} }, []);
  return (
    <div className="screen no-nav welcome-pro">
      <div className="welcome-hero" style={{ backgroundImage: `url(${IMAGES.professionals.workshop})` }} role="img" aria-label="Mécanicien au travail" />
      <img className="welcome-logo" src={IMAGES.brand.full} alt="Depanno Expresse" />
      <h1 className="welcome-title">Espace<span>Professionnels</span></h1>
      <Swoosh width={230} />
      <p className="welcome-lead">Recevez des demandes de dépannage près de vous, établissez vos factures et suivez vos gains.</p>
      <div className="welcome-actions">
        <Link href="/connexion" className="btn btn-primary btn-block">Se connecter<Icon name="chevR" className="chev" /></Link>
        <Link href="/inscription" className="btn btn-outline btn-block"><Icon name="userPlusFill" />Devenir professionnel partenaire</Link>
      </div>
    </div>
  );
}
