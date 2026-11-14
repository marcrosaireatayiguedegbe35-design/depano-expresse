import { BadRequestException, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import type { Request } from 'express';
import type { Permission } from './permissions';

/* ---------- Métadonnées de routes ---------- */

export const PUBLIC_KEY = 'route:public';
export const PERMS_KEY = 'route:perms';
export const AUDIT_KEY = 'route:audit';
export const ALLOW_PENDING_PASSWORD_KEY = 'route:allowPendingPassword';

/** Route accessible sans session (connexion uniquement). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Permissions requises (toutes). Une route sans @Perm ni @AuthOnly est refusée. */
export const Perm = (...perms: Permission[]) => SetMetadata(PERMS_KEY, perms);
/** Route nécessitant seulement une session valide. */
export const AuthOnly = () => SetMetadata(PERMS_KEY, []);
/** Nom d'action explicite pour le journal d'audit. */
export const Audit = (action: string) => SetMetadata(AUDIT_KEY, action);
/** Route utilisable même si l'admin doit changer son mot de passe. */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);

/* ---------- Contexte admin ---------- */

export interface AdminContext {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Permission[];
  sessionId: string;
  mustChangePassword: boolean;
}

export type AdminRequest = Request & { admin?: AdminContext };

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AdminRequest>().admin;
});

export interface ClientInfo {
  ip: string;
  userAgent: string;
}

export const Client = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip ?? '', userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) };
});

/* ---------- Utilitaires ---------- */

export function oid(id: string, what = 'Identifiant'): Types.ObjectId {
  if (!isValidObjectId(id)) throw new BadRequestException(`${what} invalide`);
  return new Types.ObjectId(id);
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Filtre « recherche texte » sûr sur plusieurs champs. */
export function searchFilter(q: unknown, fields: string[]) {
  if (typeof q !== 'string' || !q.trim()) return {};
  const rx = new RegExp(escapeRegex(q.trim().slice(0, 100)), 'i');
  return { $or: fields.map((f) => ({ [f]: rx })) };
}

/** N'accepte qu'une valeur texte appartenant à une liste fermée. */
export function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function dateRange(from?: unknown, to?: unknown) {
  const range: Record<string, Date> = {};
  if (typeof from === 'string' && !isNaN(Date.parse(from))) range.$gte = new Date(from);
  if (typeof to === 'string' && !isNaN(Date.parse(to))) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }
  return Object.keys(range).length ? range : undefined;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function pageParams(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export async function paginate<T>(
  model: { find: Function; countDocuments: Function },
  filter: Record<string, unknown>,
  query: Record<string, unknown>,
  opts: { sort?: Record<string, 1 | -1>; select?: string; populate?: any } = {},
): Promise<Page<T>> {
  const { page, limit, skip } = pageParams(query);
  let q = model.find(filter).sort(opts.sort ?? { createdAt: -1 }).skip(skip).limit(limit);
  if (opts.select) q = q.select(opts.select);
  if (opts.populate) q = q.populate(opts.populate);
  const [items, total] = await Promise.all([q.lean(), model.countDocuments(filter)]);
  return { items, total, page, limit };
}

/** Exige un en-tête Idempotency-Key pour les opérations financières. */
export const IdempotencyKey = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(key)) {
    throw new BadRequestException('En-tête Idempotency-Key requis (16 à 100 caractères alphanumériques)');
  }
  return key;
});

/** Neutralise l'injection de formules dans les exports CSV. */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = columns.map((c) => cell(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(';'));
  return '﻿' + [header, ...body].join('\r\n');
}

/** Clé de métier (service) valide, ou undefined. Les métiers sont administrables. */
export function tradeKey(v: unknown): string | undefined {
  return typeof v === 'string' && /^[a-z0-9_]{2,40}$/.test(v) ? v : undefined;
}
