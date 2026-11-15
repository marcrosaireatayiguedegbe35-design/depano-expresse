# Sécurité de Depanno Expresse

Mis à jour le 15/11/2026. Aucun système n'est inviolable. L'objectif est de rendre chaque attaque courante
inutile, de ralentir les autres, et de tout enregistrer.

## Le chemin d'une requête et ses protections

```
Visiteur ─▶ Cloudflare (HTTPS) ─▶ Pare-feu du site (functions/_middleware.js) ─▶ page statique
                                          │
                                          └─▶ /api/* ─▶ relais (functions/api) ── clé secrète ──▶ API Render
                                                                                                    │
                                                         pare-feu API ─▶ limite de débit ─▶ session ─▶ validation ─▶ MongoDB Atlas
```

### 1. Pare-feu en bordure (les trois sites, Cloudflare)
Fichier `apps/{web,pro,admin}/functions/_middleware.js`. Il bloque avant toute page ou tout appel à l'API :
- **les robots d'IA** : GPTBot/ChatGPT, ClaudeBot, Perplexity, Bytespider, CCBot, Meta, Apple, Amazon, Mistral, DeepSeek, Firecrawl… ;
- **les outils automatisés et d'attaque** : curl, python, navigateurs sans écran (Puppeteer, Playwright, Selenium), sqlmap, nikto, nmap, nuclei, wpscan… ;
- **tout robot déclaré**, sauf Google et Bing. Ceux-ci n'ont accès qu'aux pages publiques du site client, en lecture seule. L'espace pro et le back-office refusent tous les robots ;
- **les sondes** (`.env`, `.git`, WordPress, PHP, sauvegardes, `../`, `<script>`, `UNION SELECT`…), les méthodes HTTP inutiles et les adresses trop longues.

Chaque refus affiche un message ferme : tentative enregistrée avec l'adresse IP, l'heure et une référence. Il est
aussi écrit dans les journaux en temps réel du projet (Workers & Pages › projet › Fonctions).

Le pare-feu ajoute aussi à chaque page :
- une **politique de contenu (CSP)** : seuls le site lui-même, Google Fonts, Cloudinary et OpenStreetMap sont autorisés ;
- **HSTS**, l'interdiction d'afficher le site dans un cadre, et des permissions minimales (caméra, micro, position) ;
- le marquage `noai, noimageai`. L'espace pro et le back-office sont en plus marqués `noindex`.

`robots.txt` dit la même chose aux robots polis. Les autres sont bloqués par le pare-feu.
`_routes.json` sort les images et les scripts du pare-feu : ils sont statiques, sans risque, et cela économise
le quota gratuit des fonctions (100 000 appels par jour).

### 2. Relais signé vers l'API
Chaque relais `/api` envoie une **clé secrète** (`RELAY_SECRET`) et l'adresse réelle du visiteur. Une fois la clé
installée (voir plus bas) :
- l'API **refuse toute requête qui ne vient pas d'un des trois sites**. Un accès direct à `depanno-api.onrender.com`
  est refusé, sauf le point de santé ;
- limites de débit, verrouillages de connexion et journal d'audit visent **l'adresse réelle du visiteur**. Avant
  cela, ils voyaient celle de Cloudflare.

### 3. Pare-feu de l'API (seconde ligne)
Fichier `apps/backend/src/common/firewall.ts`, testé par `firewall.spec.ts`. Mêmes règles que le pare-feu en
bordure, appliquées une seconde fois au cas où quelqu'un le contournerait.

### 4. Protections déjà en place dans l'API (vérifiées)
- **Sessions** : jetons opaques en cookie `httpOnly` et `Secure`, `SameSite`, vérifiés en base à chaque requête.
- **Anti-CSRF** : en-tête `X-Requested-With` propre à chaque espace.
- **Validation stricte** de toutes les données reçues : champs inconnus refusés, recherches échappées, identifiants contrôlés.
- **Limitation de débit** : 120 requêtes par minute, beaucoup moins sur les connexions et les codes.
- **Back-office** : mot de passe, 2FA, verrouillage après 5 essais, sessions courtes, journal d'audit scellé (HMAC).
- **En-têtes** `helmet`, CORS limité aux trois sites, taille des requêtes limitée (200 ko).
- **Secrets** : uniquement dans Render et dans `apps/backend/.env` (jamais dans GitHub).

## À faire par vous (dans cet ordre)

### A. Installer la clé du relais
1. Générez une clé sur votre ordinateur : `openssl rand -hex 32`, puis copiez le résultat.
2. Dans Cloudflare, pour **chacun des trois projets** : Paramètres › Variables et secrets › Ajouter.
   Nom : `RELAY_SECRET`, type **Secret**, valeur : la clé. Ensuite, Déploiements › dernier déploiement › **Réessayer le déploiement**.
3. **Seulement après les trois redéploiements**, dans Render › depanno-api › Environment : ajoutez
   `RELAY_SECRET` avec la même valeur, puis enregistrez (l'API redémarre).

⚠️ L'ordre compte. Si Render reçoit la clé avant les sites, l'API refuse les trois sites jusqu'à ce qu'ils l'aient.
En cas de problème, supprimez `RELAY_SECRET` dans Render : tout refonctionne comme avant.

### B. Comptes
- Activez la **double authentification** sur GitHub, Cloudflare, Render, MongoDB Atlas, Cloudinary, Brevo et Namecheap.
- Back-office : exigez la 2FA pour **tous** les administrateurs.

### C. MongoDB Atlas
Network Access : remplacez `0.0.0.0/0` par les adresses sortantes de Render (Render › depanno-api › Connect › Outbound).

### D. GitHub (dépôt `depano-expresse`)
Settings › Code security : activez **Dependabot alerts**, **Secret scanning** et **Push protection**.
Settings › Branches : protégez `main` (pas de suppression, pas de réécriture forcée).

### E. Après l'achat du domaine (Cloudflare › votre domaine › Sécurité)
Ces réglages n'existent que sur un domaine à vous, pas sur `*.pages.dev` :
- **Bots** : *Bot Fight Mode*, *Block AI bots* (toutes les pages), *AI Labyrinth* (piège pour robots d'IA) ;
- **WAF** : règles gérées gratuites, plus une **règle de limitation de débit** sur `/api/auth/*` ;
- **SSL/TLS** : *Always Use HTTPS*, TLS 1.2 minimum, HSTS ; **DNSSEC** activé ;
- **Turnstile** (anti-robot invisible) : pourra être ajouté aux formulaires de connexion et d'inscription.

## Reste à surveiller
- **API** : 7 alertes de dépendances (déni de service, gravité moyenne à haute) dans NestJS 10. Leur correction impose
  le passage à NestJS 11 ou plus, une migration à faire et tester à part. La limite de taille des requêtes en
  atténue une partie.
- **Sites** : les alertes Next.js concernent le serveur Next.js, non utilisé ici (export statique). L'alerte PostCSS
  ne joue qu'à la construction.
