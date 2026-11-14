export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; headers?: Record<string, string> };

/** Appel à l'API clients (proxy same-origin /api → backend /client). */
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'plateforme-client',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      const m = data.message;
      msg = Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const idempotencyKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');

/** N'accepte qu'un chemin interne pour la redirection après connexion (pas de redirection ouverte). */
export const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/compte');

/** Écran de bienvenue déjà vu (premier lancement). */
export const WELCOME_KEY = 'pa_welcome_seen';
