'use client';

import { useEffect, useRef } from 'react';

/**
 * Écran de chargement de la marque (repris du chargeur de la carrière) : le logo se dessine trait par trait,
 * l'image apparaît, un reflet la traverse, la barre se remplit, puis l'écran s'efface (3 s minimum).
 * Le balisage est rendu côté serveur : il s'affiche dès l'ouverture, avant le chargement du JavaScript.
 */
export function BrandLoader({ logo, caption, label = 'Chargement de Depanno Expresse' }: { logo: string; caption: string; label?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = Math.max(0, (reduced ? 600 : 3000) - performance.now());
    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      node.classList.add('is-leaving');
      t2 = setTimeout(() => { node.style.display = 'none'; }, 480);
    }, wait);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="intro-loader" ref={el} role="status" aria-label={label}>
      <div className="intro-loader__content">
        <div className="intro-loader__mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={900} height={498} />
          <svg className="intro-loader__draw" viewBox="0 0 900 498" aria-hidden="true">
            <path className="draw-orange" pathLength={1} strokeWidth={12} d="M190 86h110M150 126h125M128 166h140M150 206h132M214 240h86" />
            <path className="draw-navy" pathLength={1} strokeWidth={14} d="M522 16A142 142 0 1 0 506 288" />
            <path className="draw-navy2" pathLength={1} strokeWidth={12} d="M458 74l-26 66 40 12 28-66M448 168l-26 84" />
            <path className="draw-gear" pathLength={1} strokeWidth={12} d="M482 18a128 128 0 0 1-8 252M600 40l22-20M650 120h24M640 210l20 18" />
            <path className="draw-text" pathLength={1} strokeWidth={9} d="M60 372h780M40 452h780" />
          </svg>
          <span className="intro-loader__shine" aria-hidden="true" />
        </div>
        <span className="intro-loader__caption">{caption}</span>
        <span className="intro-loader__track" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}
