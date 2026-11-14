export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; headers?: Record<string, string> };

/** Appel à l'API du back-office (proxy same-origin /api → backend /admin). */
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'plateforme-admin',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    let code: string | undefined;
    try {
      const data = await res.json();
      const m = data.message;
      msg = Array.isArray(m) ? m.join(' · ') : typeof m === 'string' ? m : typeof m === 'object' && m?.message ? m.message : msg;
      code = data.code ?? (typeof m === 'object' ? m?.code : undefined);
    } catch {}
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
      window.location.href = '/login';
    }
    throw new ApiError(res.status, msg, code);
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

export const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const idempotencyKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Envoi d'une image vers Cloudinary avec une signature fournie par le backend. */
export async function uploadImage(file: File, folder: 'products' | 'companies' | 'advertisements' | 'categories' | 'site'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Seules les images sont acceptées');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image trop lourde (5 Mo maximum)');
  const sig = await api('/uploads/signature', { method: 'POST', body: { folder } });
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', sig.timestamp);
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);
  const res = await fetch(sig.uploadUrl, { method: 'POST', body: form });
  if (!res.ok) throw new Error("Échec de l'envoi de l'image");
  return (await res.json()).secure_url;
}
