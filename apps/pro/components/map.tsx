'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { proName, TRADES } from '@/lib/format';

export interface MapProps {
  center: { lat: number; lng: number };
  pros?: any[];
  /** Si fourni, le marqueur du client est déplaçable. */
  onMove?: (pos: { lat: number; lng: number }) => void;
  height?: number;
  /** Position suivie en direct (ex. professionnel en route) : la carte cadre le client et cette position. */
  follow?: { lat: number; lng: number; label?: string } | null;
  /** Libellé du point central (par défaut « Votre position »). */
  centerLabel?: string;
  /** Zoom initial (13 = quartier, 16 = rue). */
  zoom?: number;
}

/* Fond de carte : OpenStreetMap par défaut (sans clé, noms de rues en français). Pour une carte haute définition,
   définir NEXT_PUBLIC_MAP_TILES (adresse de tuiles avec {z}/{x}/{y}, par ex. MapTiler avec votre clé) et
   NEXT_PUBLIC_MAP_ATTRIBUTION au moment de la construction. */
const TILES = process.env.NEXT_PUBLIC_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const PIN_HOME = '<span class="pin-drop"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 3 10.2V21h6.5v-6h5v6H21V10.2z"/></svg></span>';
const PIN_TRUCK = '<span class="pin-live"><i></i><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h9A1.5 1.5 0 0 1 15 6.5V8h2.6a1.5 1.5 0 0 1 1.2.6l2 2.7c.13.17.2.38.2.6V16a1 1 0 0 1-1 1h-1.05a2.5 2.5 0 0 1-4.9 0h-4.1a2.5 2.5 0 0 1-4.9 0H4a1 1 0 0 1-1-1zM7.5 18.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6m9 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6M15 10v3h4.6l-1.9-3z"/></svg></span>';

/** Carte (Leaflet) chargée uniquement côté navigateur. */
export default function Map({ center, pros = [], onMove, height = 380, follow, centerLabel = 'Votre position', zoom = 13 }: MapProps) {
  const live = useRef<Leaflet.Marker | null>(null);
  const line = useRef<Leaflet.Polyline | null>(null);
  const [ready, setReady] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const me = useRef<Leaflet.Marker | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const L = useRef<typeof Leaflet | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled || !el.current || map.current) return;
      const lf = (mod as any).default ?? mod;
      L.current = lf;
      map.current = lf.map(el.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: false }).setView([center.lat, center.lng], zoom);
      lf.control.zoom({ position: 'bottomright', zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' }).addTo(map.current);
      lf.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map.current);
      lf.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION, className: 'map-tiles' }).addTo(map.current);
      me.current = lf.marker([center.lat, center.lng], {
        draggable: !!onMove,
        icon: lf.divIcon({ className: 'map-pin', html: PIN_HOME, iconSize: [40, 48], iconAnchor: [20, 46] }),
        title: centerLabel,
        zIndexOffset: 500,
      }).addTo(map.current);
      me.current!.on('dragend', () => {
        const p = me.current!.getLatLng();
        onMove?.({ lat: p.lat, lng: p.lng });
      });
      layer.current = lf.layerGroup().addTo(map.current);
      draw();
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      live.current = null;
      line.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !me.current) return;
    me.current.setLatLng([center.lat, center.lng]);
    if (!follow) map.current.setView([center.lat, center.lng], map.current.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  const draw = () => {
    const lf = L.current;
    if (!lf || !layer.current) return;
    layer.current.clearLayers();
    for (const p of pros) {
      const c = p.location?.coordinates;
      if (!c) continue;
      const icon = lf.divIcon({ className: `map-pro ${p.availability}`, html: `<span>${TRADES[p.trade]?.icon ?? '🔧'}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
      const div = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = proName(p);
      const info = document.createElement('div');
      info.textContent = `${TRADES[p.trade]?.label ?? ''}${p.distanceKm !== undefined ? ` · ${p.distanceKm} km` : ''}`;
      const link = document.createElement('a');
      link.href = `/professionnels/${p._id}`;
      link.textContent = 'Voir le profil';
      div.append(strong, info, link);
      lf.marker([c[1], c[0]], { icon }).bindPopup(div).addTo(layer.current);
    }
  };

  useEffect(draw, [pros]);

  // Position suivie en direct : marqueur animé, trait pointillé jusqu'au client et cadrage sur les deux points.
  useEffect(() => {
    const lf = L.current;
    if (!lf || !map.current) return;
    if (!follow) {
      live.current?.remove(); live.current = null;
      line.current?.remove(); line.current = null;
      return;
    }
    const pts: [number, number][] = [[follow.lat, follow.lng], [center.lat, center.lng]];
    if (!live.current) {
      live.current = lf.marker(pts[0], {
        icon: lf.divIcon({ className: 'map-pin', html: PIN_TRUCK, iconSize: [52, 52], iconAnchor: [26, 26] }),
        title: follow.label ?? 'Professionnel',
        zIndexOffset: 1000,
      }).addTo(map.current);
      line.current = lf.polyline(pts, { color: '#ff5a0a', weight: 4, opacity: .85, dashArray: '2 10', lineCap: 'round' }).addTo(map.current);
    } else {
      live.current.setLatLng(pts[0]);
      line.current?.setLatLngs(pts);
    }
    map.current.fitBounds(lf.latLngBounds(pts), { padding: [56, 56], maxZoom: 17, animate: true });
  }, [ready, follow?.lat, follow?.lng, center.lat, center.lng]);

  return <div ref={el} className="map" style={{ height }} role="application" aria-label="Carte" />;
}
