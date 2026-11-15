'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import './brand-loader.css';

/** Anneau + emblème Depanno, partagé par l'écran d'ouverture, le chargement entre les pages et celui des données. */
export function Mark({ logo }: { logo: string }) {
  const id = `bl-grad${useId().replace(/:/g, '')}`;
  return (
    <span className="bl-mark" aria-hidden="true">
      <svg className="bl-ring" viewBox="0 0 120 120">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb13b" />
            <stop offset="1" stopColor="#ff5a0a" />
          </linearGradient>
        </defs>
        <circle className="bl-track" cx="60" cy="60" r="54" />
        <circle className="bl-arc" cx="60" cy="60" r="54" stroke={`url(#${id})`} />
      </svg>
      <span className="bl-speed"><i /><i /><i /></span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="bl-emblem" src={logo} alt="" width={400} height={225} />
    </span>
  );
}

/**
 * Écran d'ouverture de la marque, à chaque chargement complet d'une page :
 * l'emblème glisse dans l'anneau qui tourne, le nom apparaît, la barre progresse, puis tout s'efface en douceur.
 * Animation complète (1,2 s) à la première ouverture de la visite, version courte ensuite.
 * Le balisage est rendu côté serveur : il couvre la page dès l'ouverture, avant le JavaScript.
 */
export function BrandLoader({ logo, caption, label = 'Chargement de Depanno Expresse' }: { logo: string; caption: string; label?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let seen = false;
    try { seen = sessionStorage.getItem('brand_loader_seen') === '1'; sessionStorage.setItem('brand_loader_seen', '1'); } catch {}
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const min = reduced ? 300 : seen ? 550 : 1200;
    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      node.classList.add('is-leaving');
      t2 = setTimeout(() => { node.style.display = 'none'; }, 450);
    }, Math.max(0, min - performance.now()));
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="bl-screen" ref={el} role="status" aria-label={label}>
      <div className="bl-content">
        <Mark logo={logo} />
        <span className="bl-name"><b>DEPANNO</b> <em>EXPRESSE</em></span>
        <span className="bl-caption">{caption}</span>
        <span className="bl-bar" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}

/**
 * Chargement entre les pages, dans tous les espaces : dès qu'un lien interne est suivi,
 * l'emblème et son anneau apparaissent (si la page met plus de 150 ms à venir) avec une barre en haut,
 * puis disparaissent à l'arrivée sur la nouvelle page.
 */
export function RouteLoader({ logo }: { logo: string }) {
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'bar' | 'full'>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      clear();
      setState('bar');
      timers.current.push(setTimeout(() => setState('full'), 150));
      timers.current.push(setTimeout(() => setState('idle'), 10000)); // filet de sécurité
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Arrivée sur la nouvelle page.
  useEffect(() => { clear(); setState('idle'); }, [pathname]);

  return (
    <>
      <span className={`bl-top${state !== 'idle' ? ' on' : ''}`} aria-hidden="true" />
      <div className={`bl-route${state === 'full' ? ' on' : ''}`} role="status" aria-live="polite" aria-label={state === 'full' ? 'Chargement de la page' : undefined}>
        <Mark logo={logo} />
      </div>
    </>
  );
}

/* Un seul logo de chargement visible à la fois : le premier chargement monté l'affiche,
   les suivants gardent seulement leur place (sans logo) jusqu'à ce que leurs données arrivent. */
let active: number[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const firstActive = () => active[0] ?? -1;

/**
 * Chargement des données dans une page : l'emblème qui tourne dans son anneau, au centre de la zone,
 * à la place des blocs gris clignotants. `minHeight` réserve la place pour éviter que la page ne saute.
 */
export function LogoLoading({ logo, label = 'Chargement', minHeight = 180, compact }: { logo: string; label?: string; minHeight?: number; compact?: boolean }) {
  const [id] = useState(() => ++seq);
  useEffect(() => {
    active = [...active, id];
    emit();
    return () => { active = active.filter((x) => x !== id); emit(); };
  }, [id]);
  const first = useSyncExternalStore(subscribe, firstActive, () => -1);
  const shown = first === id;
  return (
    <div className={`bl-inline${compact ? ' compact' : ''}${shown ? ' shown' : ''}`} style={{ minHeight }} role="status" aria-live="polite" aria-label={label}>
      {shown && <Mark logo={logo} />}
      {shown && !compact && <span className="bl-inline-txt">{label}…</span>}
    </div>
  );
}
