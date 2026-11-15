/**
 * Pare-feu en bordure (Cloudflare Pages) — s'exécute avant chaque page et chaque appel /api.
 *
 * Bloque, avant même que la requête n'atteigne le site ou l'API :
 *  - les robots d'IA (entraînement, recherche, assistants) et les aspirateurs de sites ;
 *  - les outils automatisés et d'attaque (scanners, injecteurs, navigateurs sans écran) ;
 *  - les sondes classiques (fichiers .env, .git, WordPress, PHP, sauvegardes…) ;
 *  - les méthodes HTTP inutiles et les adresses anormalement longues.
 * Ajoute ensuite les en-têtes de sécurité (CSP, HSTS…) à chaque réponse.
 *
 * Les fichiers statiques (_next/static, images, robots.txt) ne passent pas ici : voir public/_routes.json.
 * Ce fichier existe dans les trois sites ; seule la constante SITE change.
 */
const SITE = 'client'; // 'client' | 'pro' | 'admin'

// Moteurs de recherche autorisés (site client seulement, pages publiques, lecture seule).
const SEARCH_ENGINES = /\b(Googlebot|Googlebot-Image|Bingbot|BingPreview|AdIdxBot)\b/i;

// Robots d'IA et collecteurs de données pour l'entraînement de modèles.
const AI_BOTS = new RegExp([
  'GPTBot', 'ChatGPT', 'OAI-SearchBot', 'OpenAI', 'ClaudeBot', 'Claude-Web', 'Claude-User', 'Claude-SearchBot', 'anthropic',
  'CCBot', 'PerplexityBot', 'Perplexity', 'Bytespider', 'TikTokSpider', 'Amazonbot', 'Applebot', 'meta-externalagent',
  'meta-externalfetcher', 'FacebookBot', 'Diffbot', 'cohere', 'YouBot', 'Omgili', 'ImagesiftBot', 'Timpibot', 'PetalBot',
  'MistralAI', 'Google-CloudVertexBot', 'Gemini', 'DuckAssistBot', 'AI2Bot', 'Ai2Bot', 'Kangaroo', 'PanguBot', 'Sidetrade',
  'iaskspider', 'Webzio', 'img2dataset', 'Firecrawl', 'Crawl4AI', 'Jina', 'Novellum', 'VelenPublicWebCrawler', 'Brightbot',
  'ICC-Crawler', 'Scrapy', 'DeepSeek', 'Grok', 'QualifiedBot', 'AwarioBot', 'Manus', 'Devin', 'Operator',
].join('|'), 'i');

// Outils automatisés, bibliothèques HTTP et outils d'attaque.
const TOOLS = new RegExp([
  'curl', 'wget', 'python-requests', 'python-urllib', 'aiohttp', 'httpx', 'Go-http-client', 'node-fetch', 'axios', 'undici',
  'okhttp', 'libwww', 'lwp-', 'Java/', 'Apache-HttpClient', 'HeadlessChrome', 'PhantomJS', 'Puppeteer', 'Playwright',
  'Selenium', 'webdriver', 'sqlmap', 'nikto', 'nmap', 'masscan', 'zgrab', 'nuclei', 'wpscan', 'dirbuster', 'gobuster', 'ffuf',
  'feroxbuster', 'acunetix', 'nessus', 'openvas', 'w3af', 'hydra', 'httrack', 'WebCopier', 'WebZIP', 'Nutch', 'Xenu',
  'Wfuzz', 'Arachni', 'Netsparker', 'Burp', 'ZmEu', 'Morfeus', 'jorgee', 'censys', 'Expanse', 'Shodan', 'Hello, world',
].join('|'), 'i');

// Tout autre robot déclaré. Les noms de téléphones finissant par « bot » (ex. Cubot) sont retirés avant le test.
const PHONE_BRANDS = /cubot|robotron/gi;
const GENERIC_BOT = /bot\b|bot\/|crawl|spider|scrap|slurp|archiver|harvest|extract|fetcher|monitor|checker|indexer/i;

// Sondes : fichiers et chemins qui n'existent pas ici et que seuls les attaquants demandent.
const PROBES = new RegExp([
  '\\/\\.(env|git|svn|hg|aws|ssh|docker|npmrc|htaccess|htpasswd|DS_Store|vscode|idea)',
  '\\.(php\\d?|asp|aspx|jsp|cgi|pl|py|sh|bak|old|orig|sql|sqlite|db|tar|gz|tgz|zip|rar|7z|log|ini|conf|yml|yaml|pem|key)$',
  '\\/(wp-|wordpress|xmlrpc|phpmyadmin|pma|adminer|cgi-bin|server-status|server-info|actuator|vendor\\/|node_modules|backup|dump|\\.well-known\\/security\\.txt\\.bak)',
  '\\/(etc\\/passwd|proc\\/self|boaform|HNAP1|owa\\/|autodiscover|telescope|solr|jenkins|manager\\/html|console\\/|_ignition|debug\\/)',
  '\\.\\.\\/|%2e%2e|%252e|<script|%3cscript|union(\\s|%20|\\+)+select|\\bselect(\\s|%20|\\+).+from\\b|\\$where|\\$ne\\b|sleep\\(|benchmark\\(',
].join('|'), 'i');

// Anciennes adresses à paramètre → nouvelles pages (copie de public/_redirects, appliquée ici car les
// règles _redirects peuvent être ignorées sur les routes servies par une fonction).
const REDIRECTS = {
  client: [['marketplace', '/produit', 'id'], ['professionnels', '/professionnel', 'id'], ['compte/messages', '/compte/message', 'id'],
    ['compte/demandes', '/compte/demande', 'id'], ['compte/interventions', '/compte/intervention', 'id'], ['actualites', '/actualite', 'id'],
    ['catalogue', '/categorie', 'id'], ['entreprises', '/entreprise', 'id'], ['services', '/service', 'trade']],
  pro: [['messages', '/message', 'id'], ['demandes', '/demande', 'id'], ['interventions', '/intervention', 'id']],
  admin: [['professionnels', '/professionnel', 'id'], ['interventions', '/intervention', 'id']],
}[SITE];

const API_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const PAGE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSP = {
  client: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  pro: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://api.cloudinary.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  admin: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://api.cloudinary.com; media-src 'self' blob:; worker-src 'self' blob:; frame-src https://www.openstreetmap.org; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
}[SITE];

const PERMISSIONS = {
  client: 'camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), hid=(), interest-cohort=(), browsing-topics=()',
  pro: 'camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), hid=(), interest-cohort=(), browsing-topics=()',
  admin: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), interest-cohort=(), browsing-topics=()',
}[SITE];

const ROBOTS_TAG = SITE === 'client' ? 'noai, noimageai' : 'noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai';

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': SITE === 'admin' ? 'same-origin' : 'strict-origin-when-cross-origin',
  'Permissions-Policy': PERMISSIONS,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-DNS-Prefetch-Control': 'off',
  'X-Robots-Tag': ROBOTS_TAG,
};

/** Réponse de refus : ferme, dissuasive, sans aucun détail technique sur le site. */
function deny(request, status, reason) {
  const ip = request.headers.get('cf-connecting-ip') || 'inconnue';
  const ray = request.headers.get('cf-ray') || '-';
  const when = new Date().toISOString();
  const url = new URL(request.url);
  // Journal visible dans Cloudflare (Workers & Pages › projet › Fonctions › Journaux en temps réel).
  console.warn(JSON.stringify({ blocked: reason, status, ip, ray, method: request.method, path: url.pathname, ua: request.headers.get('user-agent') || '' }));
  const message = 'Accès refusé. Cette tentative a été enregistrée avec votre adresse IP, l\'heure et la requête. '
    + 'Les attaques, l\'aspiration automatisée et la collecte par des robots ou des intelligences artificielles sont interdites '
    + 'sur Depanno Expresse et peuvent être signalées aux autorités compétentes.';
  const headers = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noai, noimageai',
    'X-Content-Type-Options': 'nosniff',
  };
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ statusCode: status, error: 'Accès refusé', message, ip, reference: ray, date: when }), {
      status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Accès refusé</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:16px/1.5 system-ui,sans-serif;padding:16px}
main{max-width:520px;background:#111827;border:1px solid #dc2626;border-radius:16px;padding:28px}h1{margin:0 0 12px;color:#f87171;font-size:22px}
p{margin:0 0 12px}dl{margin:16px 0 0;font-size:13px;color:#94a3b8}dt{float:left;width:110px}dd{margin:0 0 4px 110px;word-break:break-all}</style></head>
<body><main><h1>⛔ Accès refusé</h1><p>${esc(message)}</p>
<dl><dt>Adresse IP</dt><dd>${esc(ip)}</dd><dt>Date</dt><dd>${esc(when)}</dd><dt>Référence</dt><dd>${esc(ray)}</dd></dl></main></body></html>`;
  return new Response(html, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isApi = path.startsWith('/api/');
  const ua = request.headers.get('user-agent') || '';
  let raw = path + url.search;
  try { raw += ' ' + decodeURIComponent(raw); } catch { raw += ' %malformed'; }

  if (request.url.length > 4096 || url.search.length > 2048) return deny(request, 414, 'url-too-long');
  if (PROBES.test(raw)) return deny(request, 403, 'probe');
  if (!(isApi ? API_METHODS : PAGE_METHODS).has(request.method)) return deny(request, 405, 'method');
  if (ua.length < 8 || ua.length > 1000) return deny(request, 403, 'no-user-agent');
  if (AI_BOTS.test(ua)) return deny(request, 403, 'ai-bot');
  if (TOOLS.test(ua)) return deny(request, 403, 'tool');
  const searchEngine = SEARCH_ENGINES.test(ua);
  if (searchEngine && !(SITE === 'client' && (request.method === 'GET' || request.method === 'HEAD'))) return deny(request, 403, 'search-engine-private');
  if (!searchEngine && GENERIC_BOT.test(ua.replace(PHONE_BRANDS, ''))) return deny(request, 403, 'bot');

  if (!isApi) {
    for (const [from, to, param] of REDIRECTS) {
      const m = path.match(new RegExp(`^/${from}/([^/]+)/?$`));
      if (m) return new Response(null, { status: 301, headers: { Location: `${to}?${param}=${m[1]}`, 'Cache-Control': 'no-store' } });
    }
  }

  const res = await next();
  // Les réponses de l'API gardent leurs propres en-têtes (posés par l'API) ; on ajoute seulement le marquage anti-IA.
  const out = new Response(res.body, res);
  if (isApi) {
    out.headers.set('X-Robots-Tag', 'noindex, nofollow, noai, noimageai');
    return out;
  }
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  return out;
}
