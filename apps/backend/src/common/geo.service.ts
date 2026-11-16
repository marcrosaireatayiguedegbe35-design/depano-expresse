import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectM } from '../database.module';

/** Découpage administratif retrouvé à partir d'une position GPS (Bénin). */
export interface Area {
  departement?: string;
  commune?: string;
  arrondissement?: string;
  quartier?: string;
  updatedAt?: Date;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const UA = 'DepannoExpresse/1.0 (plateforme de depannage automobile, Benin)';

/**
 * Géocodage inverse (OpenStreetMap / Nominatim) : département, commune, arrondissement et quartier
 * d'un professionnel, déduits automatiquement de la position qu'il partage.
 * Respecte la règle d'usage de Nominatim : une requête par seconde au plus, avec cache.
 */
@Injectable()
export class GeoService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Geo');
  private queue: Promise<unknown> = Promise.resolve();
  private readonly cache = new Map<string, Area | null>();

  constructor(
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('ServiceRequest') private readonly requests: Model<any>,
  ) {}

  /** Au démarrage : complète les professionnels qui ont une position mais pas encore de zone. */
  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(async () => {
      try {
        const missing = await this.pros.find({ 'location.coordinates.1': { $exists: true }, 'area.updatedAt': null }).select('_id location').limit(300).lean<any[]>();
        for (const p of missing) await this.refreshPro(String(p._id), p.location.coordinates[1], p.location.coordinates[0]);
        if (missing.length) this.logger.log(`Zones retrouvées pour ${missing.length} professionnel(s)`);
        const reqs = await this.requests.find({ 'location.coordinates.1': { $exists: true }, 'area.updatedAt': null }).sort({ createdAt: -1 }).select('_id location').limit(100).lean<any[]>();
        for (const r of reqs) await this.refreshRequest(String(r._id), r.location.coordinates[1], r.location.coordinates[0]);
        if (reqs.length) this.logger.log(`Zones retrouvées pour ${reqs.length} demande(s)`);
      } catch (err) {
        this.logger.warn(`Rattrapage des zones interrompu : ${(err as Error).message}`);
      }
    }, 15_000);
  }

  /** Département, commune, arrondissement, quartier d'une position (null si introuvable). */
  reverse(lat: number, lng: number): Promise<Area | null> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key)!);
    const job = this.queue.then(async () => {
      const area = await this.fetchArea(lat, lng);
      if (this.cache.size > 2000) this.cache.clear();
      this.cache.set(key, area);
      await new Promise((r) => setTimeout(r, 1100));
      return area;
    });
    this.queue = job.catch(() => null);
    return job;
  }

  /** Met à jour la zone d'un professionnel après un changement de position (n'échoue jamais). */
  async refreshPro(id: string, lat: number, lng: number) {
    try {
      const area = await this.reverse(lat, lng);
      if (area) await this.pros.updateOne({ _id: id }, { $set: { area: { ...area, updatedAt: new Date() } } });
    } catch (err) {
      this.logger.warn(`Zone non retrouvée : ${(err as Error).message}`);
    }
  }

  /** Zone du client d'une demande (lieu de l'intervention), pour le professionnel. */
  async refreshRequest(id: string, lat: number, lng: number) {
    try {
      const area = await this.reverse(lat, lng);
      if (area) await this.requests.updateOne({ _id: id }, { $set: { area: { ...area, updatedAt: new Date() } } });
    } catch (err) {
      this.logger.warn(`Zone du client non retrouvée : ${(err as Error).message}`);
    }
  }

  private async fetchArea(lat: number, lng: number): Promise<Area | null> {
    const url = `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=fr`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const a = ((await res.json()) as any)?.address;
    if (!a) return null;
    return toArea(a);
  }
}

/** Correspondance des champs OpenStreetMap avec le découpage du Bénin. */
export function toArea(a: Record<string, string>): Area {
  const commune = clean(a.county || a.city || a.town || a.municipality || a.village);
  const district = clean(a.city_district || a.district);
  const arrondissement = district && /arrondissement/i.test(district) ? district : district || (a.town && a.town !== commune ? clean(a.town) : undefined);
  const quartier = clean(a.quarter || a.suburb || a.neighbourhood || a.hamlet || (a.village !== commune ? a.village : undefined));
  return { departement: clean(a.state), commune, arrondissement, quartier: quartier !== commune ? quartier : undefined };
}

const clean = (v?: string) => (v && v.trim() ? v.trim().replace(/^Commune (de |d’|d')/i, '') : undefined);
