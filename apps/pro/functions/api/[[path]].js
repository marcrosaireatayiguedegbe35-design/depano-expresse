// Cloudflare Pages Function : relaie /api/* vers l'API Render (espace « pro »).
// Le navigateur ne parle qu'à ce domaine : les cookies de session httpOnly et l'en-tête anti-CSRF fonctionnent
// exactement comme avant (aucune configuration CORS côté navigateur).
const SPACE = 'pro';

export async function onRequest({ request, env, params }) {
  const backend = (env.BACKEND_URL || 'https://depanno-api.onrender.com').replace(/\/$/, '');
  const url = new URL(request.url);
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip);
  const init = { method: request.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
  const res = await fetch(`${backend}/${SPACE}/${path}${url.search}`, init);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
