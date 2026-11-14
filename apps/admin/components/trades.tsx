'use client';

import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TRADES } from '@/lib/format';

/** Complète la liste des métiers avec les services créés par l'administration. */
export function TradesLoader({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    api<any[]>('/service-categories')
      .then((cats) => { cats.forEach((c) => { TRADES[c.trade] = c.name; }); setVersion((v) => v + 1); })
      .catch(() => {});
  }, []);
  // La clé force le rafraîchissement des libellés une fois la liste chargée (une seule fois).
  return <div key={version} style={{ display: "contents" }}>{children}</div>;
}
