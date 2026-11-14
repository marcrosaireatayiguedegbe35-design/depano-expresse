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
}

/** Carte OpenStreetMap (Leaflet) chargée uniquement côté navigateur. */
export default function Map({ center, pros = [], onMove, height = 380, follow }: MapProps) {
  const live = useRef<Leaflet.Marker | null>(null);
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
      map.current = lf.map(el.current, { scrollWheelZoom: false }).setView([center.lat, center.lng], 13);
      lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; contributeurs OpenStreetMap',
      }).addTo(map.current);
      me.current = lf.marker([center.lat, center.lng], {
        draggable: !!onMove,
        icon: lf.divIcon({ className: 'map-me', html: '<span>📍</span>', iconSize: [30, 30], iconAnchor: [15, 28] }),
        title: 'Votre position',
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !me.current) return;
    me.current.setLatLng([center.lat, center.lng]);
    map.current.setView([center.lat, center.lng], map.current.getZoom());
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

  // Marqueur en direct + cadrage sur le client et la position suivie.
  useEffect(() => {
    const lf = L.current;
    if (!lf || !map.current) return;
    if (!follow) { live.current?.remove(); live.current = null; return; }
    if (!live.current) {
      live.current = lf.marker([follow.lat, follow.lng], {
        icon: lf.divIcon({ className: 'map-live', html: '<span>🛻</span>', iconSize: [40, 40], iconAnchor: [20, 20] }),
        title: follow.label ?? 'Professionnel',
        zIndexOffset: 1000,
      }).addTo(map.current);
    } else live.current.setLatLng([follow.lat, follow.lng]);
    map.current.fitBounds(lf.latLngBounds([[center.lat, center.lng], [follow.lat, follow.lng]]), { padding: [40, 40], maxZoom: 16 });
  }, [ready, follow?.lat, follow?.lng, center.lat, center.lng]);

  return <div ref={el} className="map" style={{ height }} role="application" aria-label="Carte des professionnels" />;
}
