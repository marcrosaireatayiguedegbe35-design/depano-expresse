'use client';

import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { applySiteImages, LABEL_IMAGES, normLabel, TRADE_IMAGES } from '@/lib/images';

/** Complète la liste des métiers avec les services actifs et charge les images choisies dans le back-office. */
export function TradesLoader({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const site = api<Record<string, string>>('/site-images').then(applySiteImages).catch(() => {});
    const products = api<any[]>('/product-categories').then((pc) => pc.forEach((c) => { if (c.imageUrl) LABEL_IMAGES[normLabel(c.name)] = c.imageUrl; })).catch(() => {});
    const services = api<any[]>('/service-categories')
      .then((cats) => {
        cats.forEach((c) => {
          if (c.imageUrl) { TRADE_IMAGES[c.trade] = c.imageUrl; LABEL_IMAGES[normLabel(c.name)] = c.imageUrl; }
          c.problems?.forEach((p: any) => { if (p.imageUrl) LABEL_IMAGES[normLabel(p.label)] = p.imageUrl; });
        });
        const active = new Set(cats.map((c) => c.trade));
        cats.forEach((c) => { TRADES[c.trade] = { label: TRADES[c.trade]?.label ?? c.name, icon: c.icon || TRADES[c.trade]?.icon || '🔧', desc: c.description || TRADES[c.trade]?.desc || '' }; });
        // Les services désactivés disparaissent du site.
        Object.keys(TRADES).forEach((k) => { if (!active.has(k)) delete TRADES[k]; });
      })
      .catch(() => {});
    Promise.all([site, products, services]).then(() => setVersion((v) => v + 1));
  }, []);
  // La clé force le rafraîchissement des libellés une fois la liste chargée (une seule fois).
  return <div key={version} style={{ display: "contents" }}>{children}</div>;
}
