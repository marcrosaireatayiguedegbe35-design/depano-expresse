'use client';

import { ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { applySiteImages, LABEL_IMAGES, normLabel, TRADE_IMAGES } from '@/lib/images';
import { LogoLoading } from './brand-loader';

const CACHE_KEY = 'pa_catalog_v1';
type Catalog = { site: Record<string, string>; products: any[]; services: any[] };

/** Applique services, catégories et visuels choisis dans le back-office aux registres globaux. */
function apply(c: Catalog) {
  applySiteImages(c.site ?? {});
  c.products?.forEach((p) => { if (p.imageUrl) LABEL_IMAGES[normLabel(p.name)] = p.imageUrl; });
  if (c.services?.length) {
    const active = new Set(c.services.map((s) => s.trade));
    c.services.forEach((s) => {
      if (s.imageUrl) { TRADE_IMAGES[s.trade] = s.imageUrl; LABEL_IMAGES[normLabel(s.name)] = s.imageUrl; }
      s.problems?.forEach((p: any) => { if (p.imageUrl) LABEL_IMAGES[normLabel(p.label)] = p.imageUrl; });
      TRADES[s.trade] = { label: TRADES[s.trade]?.label ?? s.name, icon: s.icon || TRADES[s.trade]?.icon || '🔧', desc: s.description || TRADES[s.trade]?.desc || '' };
    });
    Object.keys(TRADES).forEach((k) => { if (!active.has(k)) delete TRADES[k]; });
  }
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Charge le catalogue (services, catégories, visuels) une seule fois et le garde en cache dans le navigateur :
 * les pages s'affichent tout de suite avec la dernière version connue, sans double chargement.
 * Les pages ne sont reconstruites que si le back-office a réellement changé quelque chose.
 */
export function TradesLoader({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  useIsoLayoutEffect(() => {
    let cached: string | null = null;
    try { cached = localStorage.getItem(CACHE_KEY); } catch {}
    if (cached) { try { apply(JSON.parse(cached)); } catch {} setReady(true); }
    const fallback = cached ? null : setTimeout(() => setReady(true), 1500);

    Promise.all([
      api<Record<string, string>>('/site-images').catch(() => ({})),
      api<any[]>('/product-categories').catch(() => []),
      api<any[]>('/service-categories').catch(() => []),
    ]).then(([site, products, services]) => {
      const fresh: Catalog = { site, products, services };
      const json = JSON.stringify(fresh);
      if (!services.length) { setReady(true); return; }
      try { localStorage.setItem(CACHE_KEY, json); } catch {}
      apply(fresh);
      if (fallback) clearTimeout(fallback);
      if (!cached) setReady(true);
      else if (cached !== json) setVersion((v) => v + 1); // le back-office a changé : on rafraîchit l'affichage
    });
    return () => { if (fallback) clearTimeout(fallback); };
  }, []);

  if (!ready) return <div className="screen"><LogoLoading logo="/images/brand/embleme-depanno.png" minHeight={360} /></div>;
  return <div key={version} style={{ display: 'contents' }}>{children}</div>;
}
