'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAccountCart } from './cart-sync';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  commune?: string;
  quartier?: string;
}

interface SessionValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionCtx = createContext<SessionValue>({ user: null, loading: true, refresh: async () => {}, logout: async () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const r = await api('/auth/me');
      setUser(r.authenticated ? r.user : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Suivi en direct des notifications du client connecté (toutes les 15 s, onglet visible uniquement).
  useEffect(() => {
    if (!user) return;
    let lastId: string | null = null;
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await api('/notifications?limit=1');
        const top = r.items?.[0];
        if (top && lastId !== null && top._id !== lastId) window.dispatchEvent(new CustomEvent('pa:live', { detail: top }));
        lastId = top?._id ?? '';
      } catch {}
    };
    check();
    const t = setInterval(check, 15_000);
    return () => clearInterval(t);
  }, [user]);

  return <SessionCtx.Provider value={{ user, loading, refresh, logout }}>{children}</SessionCtx.Provider>;
}

/* ---------- Panier (stocké dans le navigateur) ---------- */

export interface CartItem { productId: string; name: string; unitPrice: number; quantity: number; image?: string; stock: number }

interface CartValue {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: number;
  total: number;
}

const CartCtx = createContext<CartValue>(null!);
export const useCart = () => useContext(CartCtx);
const CART_KEY = 'pa_cart_v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  // Panier enregistré sur le compte une fois connecté (même panier sur tous les appareils).
  const { items, save } = useAccountCart(user?._id ?? null, !loading, CART_KEY);
  const value: CartValue = {
    items,
    add: (item, qty = 1) => {
      const existing = items.find((i) => i.productId === item.productId);
      save(existing
        ? items.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.min(i.quantity + qty, item.stock) } : i))
        : [...items, { ...item, quantity: Math.min(qty, item.stock) }]);
    },
    setQty: (id, qty) => save(items.map((i) => (i.productId === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.stock)) } : i))),
    remove: (id) => save(items.filter((i) => i.productId !== id)),
    clear: () => save([]),
    count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
  };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

/* ---------- Favoris (cœur) : stockés dans le navigateur ---------- */

export interface Fav { kind: 'pro' | 'product'; id: string; name: string; sub?: string; icon?: string; image?: string; price?: number; rating?: number }

interface FavValue { list: Fav[]; has: (kind: Fav['kind'], id: string) => boolean; toggle: (f: Fav) => void }
const FavCtx = createContext<FavValue>(null!);
export const useFavs = () => useContext(FavCtx);
const FAV_KEY = 'pa_favs_v1';

export function FavProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Fav[]>([]);
  useEffect(() => { try { setList(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]')); } catch {} }, []);
  const save = (next: Fav[]) => { setList(next); try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {} };
  const has = (kind: Fav['kind'], id: string) => list.some((f) => f.kind === kind && f.id === id);
  const toggle = (f: Fav) => save(has(f.kind, f.id) ? list.filter((x) => !(x.kind === f.kind && x.id === f.id)) : [f, ...list]);
  return <FavCtx.Provider value={{ list, has, toggle }}>{children}</FavCtx.Provider>;
}

/* ---------- Position du client (« Domicile, quartier ») ---------- */

export interface Place { label: string; detail: string; lat: number; lng: number }
interface PlaceValue { place: Place; setPlace: (p: Place) => void; picking: boolean; setPicking: (v: boolean) => void }
const PlaceCtx = createContext<PlaceValue>(null!);
export const usePlace = () => useContext(PlaceCtx);
const PLACE_KEY = 'pa_place_v1';
const DEFAULT_PLACE: Place = { label: 'Cotonou', detail: 'Choisir ma position', lat: 6.3703, lng: 2.3912 };

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [place, setPlaceState] = useState<Place>(DEFAULT_PLACE);
  const [picking, setPicking] = useState(false);
  useEffect(() => { try { const p = localStorage.getItem(PLACE_KEY); if (p) setPlaceState(JSON.parse(p)); } catch {} }, []);
  const setPlace = (p: Place) => { setPlaceState(p); try { localStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch {} };
  return <PlaceCtx.Provider value={{ place, setPlace, picking, setPicking }}>{children}</PlaceCtx.Provider>;
}
