'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { WELCOME_KEY } from '@/lib/api';
import { IMAGES } from '@/lib/images';

const SLIDES = [
  { top: 'Vos clients', accent: 'Près de vous', text: 'Recevez en temps réel les demandes de dépannage de votre zone.', img: '/images/companies/rejoindre-professionnel.webp', alt: 'Professionnel Depanno Expresse' },
  { top: 'Vos factures', accent: 'En 2 minutes', text: 'Devis, photos du chantier et factures, directement depuis votre téléphone.', img: '/images/categories/mecanicien-illustration.webp', alt: 'Mécanicien au travail' },
  { top: 'Vos gains', accent: 'En toute sécurité', text: 'Paiement par Mobile Money et suivi clair de vos revenus, intervention après intervention.', img: '/images/categories/engrenage.webp', alt: 'Engrenage' },
];

/** Écran d'accueil de l'espace professionnels : trois écrans à faire défiler, puis connexion ou inscription. */
export default function WelcomePage() {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  useEffect(() => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} }, []);
  const last = i === SLIDES.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)));
  const s = SLIDES[i];

  return (
    <div
      className="ob"
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        startX.current = null;
      }}
    >
      <div className="ob-top">
        <span className="ob-count">{String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span>
        <div className="ob-bars" role="tablist" aria-label="Écrans de présentation">
          {SLIDES.map((x, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Écran ${n + 1}`} className={n <= i ? 'on' : ''} onClick={() => go(n)} />
          ))}
        </div>
        {!last ? <button type="button" className="ob-skip" onClick={() => go(SLIDES.length - 1)}>Passer</button> : <span className="ob-skip" aria-hidden />}
      </div>

      <img className="ob-logo" src={IMAGES.brand.full} alt="Depanno Expresse" />

      <div className="ob-body" key={i}>
        <h1 className="ob-title">{s.top}<span>{s.accent}</span></h1>
        <p className="ob-text">{s.text}</p>
        <div className="ob-art">
          <span className="ob-glow" aria-hidden />
          <img src={s.img} alt={s.alt} />
          <span className="ob-stand" aria-hidden />
        </div>
      </div>

      <div className="ob-actions">
        {last ? (
          <>
            <Link href="/connexion" className="ob-btn">Se connecter<Icon name="arrow" /></Link>
            <Link href="/inscription" className="ob-btn ghost"><Icon name="userPlusFill" />Devenir professionnel partenaire</Link>
          </>
        ) : (
          <button type="button" className="ob-btn" onClick={() => go(i + 1)}>Suivant<Icon name="arrow" /></button>
        )}
      </div>
    </div>
  );
}
