'use client';

/* Panier enregistré sur le compte : le même sur le téléphone et l'ordinateur.
   - Visiteur non connecté : panier gardé dans le navigateur.
   - À la connexion : le panier du navigateur est fusionné avec celui du compte, puis vidé du navigateur.
   - Connecté : chaque changement est enregistré sur le compte ; le panier est relu en revenant sur l'onglet.
   - À la déconnexion : le panier affiché est vidé (il reste sur le compte). */

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface CartLine { productId: string; name: string; unitPrice: number; quantity: number; image?: string; stock: number }

const toBody = (items: CartLine[]) => ({ items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) });

export function useAccountCart(ownerId: string | null, ready: boolean, storageKey: string) {
  const [items, setItems] = useState<CartLine[]>([]);
  const owner = useRef<string | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const readLocal = (): CartLine[] => { try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]'); } catch { return []; } };
  const writeLocal = (v: CartLine[]) => { try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch {} };

  // Changement de compte (connexion, déconnexion, autre compte).
  useEffect(() => {
    if (!ready || owner.current === ownerId) return;
    const previous = owner.current;
    owner.current = ownerId;
    if (!ownerId) {
      if (previous) { setItems([]); writeLocal([]); } else setItems(readLocal());
      return;
    }
    const local = readLocal();
    (async () => {
      try {
        let next = await api<CartLine[]>('/cart');
        if (local.length) {
          const qty = new Map(next.map((i) => [i.productId, i.quantity]));
          local.forEach((i) => qty.set(i.productId, Math.max(qty.get(i.productId) ?? 0, i.quantity)));
          next = await api<CartLine[]>('/cart', { method: 'PUT', body: { items: [...qty].map(([productId, quantity]) => ({ productId, quantity })) } });
          writeLocal([]);
        }
        if (owner.current === ownerId) setItems(next);
      } catch {
        if (owner.current === ownerId) setItems(local);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, ready]);

  // Retour sur l'onglet : on relit le panier du compte (modifié depuis un autre appareil).
  useEffect(() => {
    if (!ownerId) return;
    const back = () => {
      if (document.visibilityState !== 'visible' || timer.current) return;
      api<CartLine[]>('/cart').then((v) => { if (owner.current === ownerId && !timer.current) setItems(v); }).catch(() => {});
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [ownerId]);

  const save = (next: CartLine[]) => {
    setItems(next);
    if (!owner.current) { writeLocal(next); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      api('/cart', { method: 'PUT', body: toBody(next) }).catch(() => {});
    }, 400);
  };

  return { items, save };
}
