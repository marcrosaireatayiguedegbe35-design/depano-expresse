// Cloudflare Pages Function : relaie /api/* vers l'API Render (espace « client »).
// Le navigateur ne parle qu'à ce domaine : les cookies de session httpOnly et l'en-tête anti-CSRF fonctionnent
// exactement comme avant (aucune configuration CORS côté navigateur).
const SPACE = 'client';

export async function onRequest({ request, env, params }) {
  const backend = (env.BACKEND_URL || 'https://depanno-api.onrender.com').replace(/\/$/, '');
  const url = new URL(request.url);
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
  // Seuls les en-têtes utiles sont transmis : Render choisit le service d'après l'hôte (ne pas envoyer
  // x-forwarded-host), et les en-têtes internes de Cloudflare (cf-*) ne doivent pas être relayés.
  const headers = new Headers();
  for (const [k, v] of request.headers) {
    const key = k.toLowerCase();
    if (key === 'host' || key.startsWith('cf-') || key.startsWith('x-forwarded-') || key === 'x-real-ip'
      || key === 'x-relay-key' || key === 'x-client-ip') continue; // jamais repris du navigateur
    headers.set(k, v);
  }
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip);
  // Clé secrète partagée avec l'API (variable RELAY_SECRET, identique dans Cloudflare et Render) :
  // prouve que la requête vient bien de ce site et transmet l'adresse réelle du visiteur.
  if (env.RELAY_SECRET) {
    headers.set('x-relay-key', env.RELAY_SECRET);
    if (ip) headers.set('x-client-ip', ip);
  }
  const init = { method: request.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
  const res = await fetch(`${backend}/${SPACE}/${path}${url.search}`, init);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
