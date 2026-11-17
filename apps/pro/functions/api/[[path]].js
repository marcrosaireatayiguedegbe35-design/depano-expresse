// Cloudflare Pages Function : relaie /api/* vers l'API Render (espace « pro »).
// Le navigateur ne parle qu'à ce domaine : les cookies de session httpOnly et l'en-tête anti-CSRF fonctionnent
// exactement comme avant (aucune configuration CORS côté navigateur).
const SPACE = 'pro';

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
  const relayKey = (env.RELAY_SECRET || '').trim(); // espaces et retours à la ligne ignorés
  if (relayKey) {
    headers.set('x-relay-key', relayKey);
    if (ip) headers.set('x-client-ip', ip);
  }
  const init = { method: request.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;
  const target = `${backend}/${SPACE}/${path}${url.search}`;
  // L'API Render s'endort après un moment sans visite : à son réveil (30 à 50 s) elle répond d'abord
  // 502/503/504. Les lectures (GET/HEAD) sont alors retentées au lieu d'afficher une erreur.
  const retry = init.method === 'GET' || init.method === 'HEAD';
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(target, init);
      if (!retry || ![502, 503, 504].includes(res.status) || attempt >= 8) break;
    } catch (err) {
      if (!retry || attempt >= 8) throw err;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
