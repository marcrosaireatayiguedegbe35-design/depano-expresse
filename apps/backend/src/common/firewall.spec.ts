import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '@nestjs/common';
import { firewall } from './firewall';

Logger.overrideLogger(false); // pas de journal pendant les tests

const KEY = 'k'.repeat(48);
const BROWSER = 'Mozilla/5.0 (Linux; Android 13; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';

/** Exécute le pare-feu sur une fausse requête ; renvoie le statut (200 = laissée passer) et la requête modifiée. */
function run(opts: { method?: string; url?: string; ua?: string; key?: string; clientIp?: string }, secret = KEY) {
  const url = opts.url ?? '/client/products';
  const headers: Record<string, string> = { 'user-agent': opts.ua ?? BROWSER };
  if (opts.key !== undefined) headers['x-relay-key'] = opts.key;
  if (opts.clientIp) headers['x-client-ip'] = opts.clientIp;
  const req: any = { method: opts.method ?? 'GET', originalUrl: url, path: url.split('?')[0], headers, ip: '172.70.1.1' };
  let status = 200;
  const res: any = { setHeader() {}, status(s: number) { status = s; return res; }, set() { return res; }, json() { return res; } };
  let passed = false;
  firewall(secret)(req, res, () => { passed = true; });
  return { status: passed ? 200 : status, req };
}

test('Relais : la bonne clé passe et donne l\'adresse réelle du visiteur, sans fuite des en-têtes internes', () => {
  const { status, req } = run({ key: KEY, clientIp: '41.85.12.7' });
  assert.equal(status, 200);
  assert.equal(req.ip, '41.85.12.7');
  assert.deepEqual(req.ips, ['41.85.12.7']);
  assert.equal(req.headers['x-relay-key'], undefined);
});

test('Relais : accès direct ou mauvaise clé refusés, point de santé toujours ouvert', () => {
  assert.equal(run({}).status, 403);
  assert.equal(run({ key: 'x'.repeat(48) }).status, 403);
  assert.equal(run({ url: '/admin/health', ua: 'Render/1.0' }).status, 200);
});

test('Sans RELAY_SECRET, l\'adresse x-client-ip envoyée par un inconnu est ignorée', () => {
  const { status, req } = run({ key: 'n\'importe quoi', clientIp: '1.2.3.4' }, '');
  assert.equal(status, 200);
  assert.equal(req.ip, '172.70.1.1');
});

test('Robots d\'IA, outils d\'attaque et robots déclarés refusés', () => {
  for (const ua of ['Mozilla/5.0 (compatible; GPTBot/1.2)', 'ClaudeBot/1.0', 'PerplexityBot/1.0', 'sqlmap/1.7', 'curl/8.5', 'python-requests/2.31', 'Mozilla/5.0 (compatible; AhrefsBot/7.0)', '']) {
    assert.equal(run({ key: KEY, ua }).status, 403, ua);
  }
});

test('Moteurs de recherche : lecture du contenu client seulement', () => {
  const google = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  assert.equal(run({ key: KEY, ua: google }).status, 200);
  assert.equal(run({ key: KEY, ua: google, url: '/admin/admins' }).status, 403);
  assert.equal(run({ key: KEY, ua: google, method: 'POST' }).status, 403);
});

test('Sondes, injections et méthodes inutiles refusées ; recherche normale acceptée', () => {
  assert.equal(run({ key: KEY, url: '/client/.env' }).status, 403);
  assert.equal(run({ key: KEY, url: '/client/wp-login.php' }).status, 403);
  assert.equal(run({ key: KEY, url: '/client/products?q=1%20UNION%20SELECT%20x' }).status, 403);
  assert.equal(run({ key: KEY, method: 'TRACE' }).status, 405);
  assert.equal(run({ key: KEY, url: '/client/products?q=plaquettes%20de%20frein' }).status, 200);
});

test('Relais : espaces ou retour à la ligne autour de la clé (copier-coller) tolérés', () => {
  assert.equal(run({ key: ` ${KEY}\n` }, `${KEY}\n`).status, 200);
  assert.equal(run({ key: KEY }, `  ${KEY}  `).status, 200);
  assert.equal(run({ key: `${KEY}x` }).status, 403);
});
