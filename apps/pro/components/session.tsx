'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { forgetPushDevice, PushPrompt } from './push';

export interface Pro {
  _id: string;
  area?: { departement?: string; commune?: string; arrondissement?: string; quartier?: string };
  firstName: string;
  lastName: string;
  businessName?: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  coverUrl?: string;
  trade: string;
  commune?: string;
  quartier?: string;
  address?: string;
  location?: { coordinates: [number, number] };
  description?: string;
  services?: string[];
  zoneRadiusKm?: number;
  hours?: string;
  indicativeRates?: string;
  availability: 'available' | 'busy' | 'unavailable';
  verificationStatus: 'pending' | 'in_review' | 'validated' | 'rejected' | 'suspended';
  rating?: number;
  reviewsCount?: number;
  payoutAccount?: { operator?: string; msisdn?: string; holderName?: string };
  /** Contrat de partenariat signé dans sa version en vigueur. */
  contractSigned?: boolean;
  identity?: { kind?: string; number?: string };
  contract?: { version?: string; signedAt?: string };
}

interface SessionValue {
  pro: Pro | null;
  loading: boolean;
  unread: number;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setPro: (p: Pro) => void;
}

const SessionCtx = createContext<SessionValue>({ pro: null, loading: true, unread: 0, refresh: async () => {}, logout: async () => {}, setPro: () => {} });
export const useSession = () => useContext(SessionCtx);

/** Session du professionnel + suivi des notifications (nouvelle demande, choix du client, paiement…). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [pro, setPro] = useState<Pro | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const r = await api('/auth/me');
      setPro(r.authenticated ? r.pro : null);
    } catch {
      setPro(null);
    } finally {
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    await forgetPushDevice();
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setPro(null);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!pro) return;
    let lastId: string | null = null;
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await api('/notifications?limit=1');
        setUnread(r.unread ?? 0);
        const top = r.items?.[0];
        if (top && lastId !== null && top._id !== lastId) window.dispatchEvent(new CustomEvent('pa:live', { detail: top }));
        lastId = top?._id ?? '';
      } catch {}
    };
    check();
    const t = setInterval(check, 15_000);
    return () => clearInterval(t);
  }, [pro]);

  // Position réelle du professionnel disponible (GPS déjà autorisé) : distances justes pour les clients.
  const available = pro?.availability === 'available';
  useEffect(() => {
    if (!available || !navigator.geolocation) return;
    let last: [number, number] | null = null;
    const update = async () => {
      if (document.hidden) return;
      try { if ((await navigator.permissions.query({ name: 'geolocation' as PermissionName })).state !== 'granted') return; } catch { return; }
      navigator.geolocation.getCurrentPosition((p) => {
        const here: [number, number] = [p.coords.latitude, p.coords.longitude];
        // Envoi seulement après un déplacement d'environ 150 m.
        if (last && Math.abs(last[0] - here[0]) + Math.abs(last[1] - here[1]) < 0.0014) return;
        last = here;
        api('/auth/me', { method: 'PATCH', body: { lat: here[0], lng: here[1] } }).catch(() => {});
      }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 120_000 });
    };
    update();
    const t = setInterval(update, 10 * 60_000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', update); };
  }, [available]);

  return <SessionCtx.Provider value={{ pro, loading, unread, refresh, logout, setPro }}>{children}</SessionCtx.Provider>;
}

/** Demande d'autorisation des notifications sur le téléphone, une fois connecté. */
export function SessionPush() {
  const { pro } = useSession();
  return <PushPrompt ownerId={pro?._id ?? null} />;
}
