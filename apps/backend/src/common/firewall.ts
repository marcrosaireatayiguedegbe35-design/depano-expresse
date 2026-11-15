import { Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { isIP } from 'net';

/**
 * Pare-feu de l'API (seconde ligne, derrière celui de Cloudflare Pages).
 *
 * 1. Relais : si RELAY_SECRET est défini, seules les requêtes portant la bonne clé (envoyée par les relais
 *    /api des trois sites) sont acceptées ; l'adresse réelle du visiteur (x-client-ip) remplace alors celle
 *    de Cloudflare, pour que limitation de débit, verrouillages et journal d'audit visent la bonne personne.
 *    Toute requête directe sur l'adresse Render est refusée (sauf le point de santé).
 * 2. Sondes, méthodes inutiles, robots d'IA, outils d'attaque et robots déclarés : refusés.
 */
const log = new Logger('Pare-feu');

const AI_BOTS = /GPTBot|ChatGPT|OAI-SearchBot|OpenAI|ClaudeBot|Claude-Web|Claude-User|Claude-SearchBot|anthropic|CCBot|Perplexity|Bytespider|TikTokSpider|Amazonbot|Applebot|meta-external|FacebookBot|Diffbot|cohere|YouBot|Omgili|ImagesiftBot|Timpibot|PetalBot|MistralAI|Google-CloudVertexBot|Gemini|DuckAssistBot|AI2Bot|Kangaroo|PanguBot|Sidetrade|iaskspider|Webzio|img2dataset|Firecrawl|Crawl4AI|Jina|Novellum|Brightbot|ICC-Crawler|Scrapy|DeepSeek|Grok/i;
const TOOLS = /curl|wget|python-requests|python-urllib|aiohttp|httpx|Go-http-client|node-fetch|axios|undici|okhttp|libwww|lwp-|Java\/|Apache-HttpClient|HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|webdriver|sqlmap|nikto|nmap|masscan|zgrab|nuclei|wpscan|dirbuster|gobuster|ffuf|feroxbuster|acunetix|nessus|openvas|w3af|hydra|httrack|Wfuzz|Arachni|Netsparker|Burp|ZmEu|censys|Shodan/i;
const GENERIC_BOT = /bot\b|bot\/|crawl|spider|scrap|slurp|archiver|harvest|extract|fetcher|indexer/i;
const PHONE_BRANDS = /cubot|robotron/gi;
const SEARCH_ENGINES = /\b(Googlebot|Googlebot-Image|Bingbot|BingPreview|AdIdxBot)\b/i;
const PROBES = /\/\.(env|git|svn|aws|ssh|docker|htaccess|htpasswd)|\.(php\d?|asp|aspx|jsp|cgi|bak|sql|sqlite|env|ini|pem|key)$|\/(wp-|xmlrpc|phpmyadmin|cgi-bin|server-status|actuator|etc\/passwd|proc\/self)|\.\.\/|%2e%2e|<script|union(\s|\+)+select/i;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const HEALTH = /^\/admin\/health\/?$/;

const MESSAGE = 'Accès refusé. Cette tentative a été enregistrée avec votre adresse IP, l\'heure et la requête. '
  + 'Les attaques, l\'aspiration automatisée et la collecte par des robots ou des intelligences artificielles sont interdites '
  + 'sur Depanno Expresse et peuvent être signalées aux autorités compétentes.';

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function deny(req: Request, res: Response, status: number, reason: string) {
  log.warn(JSON.stringify({ blocked: reason, status, ip: req.ip, method: req.method, path: req.originalUrl.slice(0, 300), ua: String(req.headers['user-agent'] ?? '').slice(0, 300) }));
  res.status(status).set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noai, noimageai' })
    .json({ statusCode: status, error: 'Accès refusé', message: MESSAGE, ip: req.ip, date: new Date().toISOString() });
}

export function firewall(relaySecret = process.env.RELAY_SECRET ?? '') {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Relais Cloudflare : clé vérifiée en temps constant, puis adresse réelle du visiteur.
    const key = req.headers['x-relay-key'];
    const fromRelay = !!relaySecret && typeof key === 'string' && sameSecret(key, relaySecret);
    const clientIp = req.headers['x-client-ip'];
    if (fromRelay && typeof clientIp === 'string' && isIP(clientIp)) {
      Object.defineProperty(req, 'ip', { value: clientIp, configurable: true });
      Object.defineProperty(req, 'ips', { value: [clientIp], configurable: true });
    }
    delete req.headers['x-relay-key'];
    delete req.headers['x-client-ip'];

    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noai, noimageai');
    const path = req.path;
    if (HEALTH.test(path) && (req.method === 'GET' || req.method === 'HEAD')) return next();

    if (relaySecret && !fromRelay) return deny(req, res, 403, 'direct-access');
    if (req.originalUrl.length > 4096) return deny(req, res, 414, 'url-too-long');
    let raw = req.originalUrl;
    try { raw += ' ' + decodeURIComponent(raw); } catch { /* adresse mal encodée : testée telle quelle */ }
    if (PROBES.test(raw)) return deny(req, res, 403, 'probe');
    if (!ALLOWED_METHODS.has(req.method)) return deny(req, res, 405, 'method');

    const ua = String(req.headers['user-agent'] ?? '');
    if (ua.length < 8 || ua.length > 1000) return deny(req, res, 403, 'no-user-agent');
    if (AI_BOTS.test(ua)) return deny(req, res, 403, 'ai-bot');
    if (TOOLS.test(ua)) return deny(req, res, 403, 'tool');
    const searchEngine = SEARCH_ENGINES.test(ua);
    // Moteurs de recherche : lecture seule du contenu public du site client.
    if (searchEngine && !(req.method === 'GET' && path.startsWith('/client/'))) return deny(req, res, 403, 'search-engine-private');
    if (!searchEngine && GENERIC_BOT.test(ua.replace(PHONE_BRANDS, ''))) return deny(req, res, 403, 'bot');
    next();
  };
}
