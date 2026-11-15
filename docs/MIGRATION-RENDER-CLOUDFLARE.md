# Migration GitHub → Render + Cloudflare Pages + Namecheap — rapport d'analyse (étape 1)

Analyse faite le 15/11/2026 sur le dépôt actuel (`marcrosaire2-hue/depano-expresse-`, branche `main`).
Aucune modification d'hébergement, de données ni de DNS n'a encore été faite.

## 1. Ce que contient le projet

| Élément | Technologie | Dossier | Scripts |
|---|---|---|---|
| API (backend) | NestJS 10, Express, Mongoose 8, TypeScript | `apps/backend` | `build` = `tsc -p tsconfig.build.json`, `start` = `node dist/main.js` |
| Site client | Next.js 14.2.35, React 18, Leaflet | `apps/web` | `build` = `next build` |
| Espace pro | Next.js 14.2.35, React 18, Leaflet | `apps/pro` | `build` = `next build` |
| Back-office | Next.js 14.2.35, React 18 | `apps/admin` | `build` = `next build` |

- Pas d'espace de travail npm commun : chaque dossier a son `package.json` et son `package-lock.json`.
- Base de données : **MongoDB Atlas** (région Paris, eu-west-3), base `plateforme_auto`.
- Fichiers d'images : **Cloudinary** (envoi signé côté API).
- E-mails / SMS : **Brevo** (facultatif).
- Appels dans le site : WebRTC, serveur TURN facultatif.

### Routes de l'API
Toutes les routes sont préfixées par espace : `/admin/*` (back-office), `/client/*` (site client), `/pro/*` (espace pro).
Point de santé existant : **`GET /admin/health`** → `{"status":"ok","database":"connected"}` (vérifié en production).

### Comment les sites parlent à l'API
Chaque site appelle `/api/...` sur **sa propre adresse**. Next.js relaie ces appels vers l'API (`rewrites` dans
`next.config.mjs`), ce qui garde les cookies de session (`cli_sid`, `pro_sid`, `adm_sid`, httpOnly, SameSite=Lax)
sur la même origine, sans CORS côté navigateur. Les requêtes qui modifient des données exigent l'en-tête
`X-Requested-With` propre à chaque espace (protection CSRF).

## 2. Variables d'environnement

### API (à saisir dans Render — jamais dans GitHub)
Obligatoires : `MONGODB_URI`, `AUDIT_HMAC_KEY` (64 caractères hexadécimaux), `TOTP_ENCRYPTION_KEY` (64 caractères hex),
`NODE_ENV=production`.
Adresses des sites (CORS et liens) : `CLIENT_ORIGIN`, `PRO_ORIGIN`, `ADMIN_ORIGIN`.
Services : `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Facultatives : `MONGODB_DB` (défaut `plateforme_auto`), `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`,
`BREVO_SMS_SENDER`, `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`, `ADMIN_SESSION_IDLE_MIN`, `ADMIN_SESSION_MAX_HOURS`.
`PORT` est fourni par Render et déjà lu par l'API (`config.port`).

⚠️ `AUDIT_HMAC_KEY` et `TOTP_ENCRYPTION_KEY` doivent être **reprises à l'identique** des valeurs actuelles :
sinon le journal d'audit ne se vérifie plus et les codes 2FA des administrateurs deviennent illisibles.

### Sites (aucun secret)
`BACKEND_URL` (adresse de l'API, lue à la construction) et `NEXT_PUBLIC_SUPPORT_PHONE` (facultatif).

## 3. Sécurité — constats

- ✅ Aucun fichier `.env` n'a jamais été versionné (historique Git vérifié) ; seul `apps/backend/.env.example` (valeurs vides) l'est.
- ✅ Aucun secret dans les sites : tout passe par l'API.
- ✅ Admin : mot de passe + 2FA possible, verrouillage après 5 essais, sessions courtes, journal d'audit scellé.
- ✅ CORS limité aux trois adresses des sites ; `helmet`, `trust proxy`, limitation de débit en place.
- ⚠️ MongoDB Atlas autorise actuellement **toutes les adresses IP** (`0.0.0.0/0`, nécessaire pour Vercel).
  Sur Render, on peut restreindre l'accès aux adresses sortantes fixes de Render.
- ⚠️ Fichiers d'outils locaux versionnés (`.enola/`, ~5 Mo) : inutiles, à exclure du nouveau dépôt.

## 4. Blocages identifiés

### Render (API) — aucun blocage
- Démarrage classique `node dist/main.js` (le code Vercel `api/index.js` / `serverless.ts` reste inoffensif).
- Port lu depuis `PORT` ✅, point de santé `/admin/health` ✅.
- Choisir la région **Frankfurt** (la plus proche de la base à Paris) pour garder des temps de réponse courts.
- Avantage : serveur permanent → les alertes en direct du back-office (SSE) ne sont plus coupées toutes les 60 s.
- Formule **Starter (7 $/mois)** suffisante (512 Mo RAM ; l'API consomme peu). L'offre gratuite s'endort après 15 min.

### Cloudflare Pages (trois sites) — blocage principal
1. **Next.js 14 n'est plus pris en charge par l'adaptateur officiel Cloudflare** (OpenNext), et l'ancien outil
   `next-on-pages` est abandonné. Passer à Next.js 15/16 imposerait aussi React 19 : migration risquée.
2. Les `rewrites` (relais `/api` → API) et `headers` de `next.config.mjs` **ne fonctionnent pas** sur Pages.
3. Les pages à adresse variable (`/marketplace/[id]`, `/professionnels/[id]`, `/compte/interventions/[id]`… : 9 côté client,
   3 côté pro, 2 côté back-office) ne peuvent pas être pré-générées telles quelles.

**Solution proposée (sans changer de version de Next.js)** : les trois sites sont déjà entièrement « côté navigateur »
(aucun middleware, aucune route serveur). On peut donc les **exporter en fichiers statiques** (`output: 'export'`),
hébergés gratuitement sur Pages :
- relais `/api/*` vers Render par une petite **Pages Function** (même origine conservée → cookies et protection CSRF inchangés) ;
- en-têtes de sécurité dans un fichier `_headers` ;
- pages à adresse variable : une page « coquille » par route + règle `_redirects`, l'identifiant étant lu dans l'adresse.
Travail estimé : modéré, sans perte de fonctionnalité, à tester page par page.

### Domaine unique avec chemins (`monsite.com/admin`, …) — déconseillé
Ce sont trois applications distinctes. Les servir sous un seul domaine par chemins impose de réécrire leurs liens
(`basePath`) et d'ajouter un routeur devant elles. **Sous-domaines recommandés**, plus simples et plus sûrs
(cookies séparés par espace) :
- `monsite.com` (et `www`) → site client
- `pro.monsite.com` → espace pro
- `admin.monsite.com` → back-office
- `api.monsite.com` → API sur Render

DNS : domaine acheté chez Namecheap, **serveurs DNS confiés à Cloudflare** (gratuit), indispensable pour relier
le domaine principal à Pages. HTTPS automatique sur Pages et sur Render.

### Nouveau dépôt GitHub
`marcrosaireatayiguedegbe35-design/depano-expresse` existe et est **vide**. Le compte actuellement connecté sur ce
poste (`marcrosaire2-hue`) n'a pas forcément le droit d'y écrire : il faudra soit l'ajouter comme collaborateur,
soit pousser depuis le nouveau compte.

## 5. Plan proposé (chaque étape validée avant la suivante)

1. **Nouveau dépôt** : copie propre du code (sans `.enola/`, sans fichiers locaux), README et guide de déploiement à jour.
2. **API sur Render** : Web Service, dossier `apps/backend`, build `npm ci && npm run build`, start `npm start`,
   santé `/admin/health`, région Frankfurt ; variables saisies par vous dans Render. Test : `/admin/health`.
3. **Sites en export statique** + Pages Function + `_headers`/`_redirects`, testés en local puis sur Pages (adresses `*.pages.dev`).
4. **Domaine** : achat chez Namecheap (par vous), DNS chez Cloudflare, sous-domaines, HTTPS.
5. **Bascule** : mise à jour de `CLIENT_ORIGIN`/`PRO_ORIGIN`/`ADMIN_ORIGIN`, restriction IP MongoDB Atlas, tests complets
   (connexion, inscription, demandes, interventions, boutique, messagerie, back-office, mobile et ordinateur).
6. Arrêt des anciens projets Vercel une fois tout vérifié.

## Coûts
- Render Starter : 7 $/mois. Cloudflare Pages et DNS : gratuits. Domaine `.com` chez Namecheap : environ 10 à 15 $/an.
- MongoDB Atlas, Cloudinary : inchangés.
