# Déploiement sur Vercel

Le dépôt contient **4 applications**, chacune déployée comme **un projet Vercel distinct** à partir du même dépôt GitHub
(`marcrosaire2-hue/depano-expresse-`), en changeant le **Root Directory** :

| Projet Vercel (suggestion) | Root Directory | Framework | Rôle |
|---|---|---|---|
| `depanno-api` | `apps/backend` | Other (lit `vercel.json`) | API NestJS : `/admin`, `/client`, `/pro` |
| `depanno-client` | `apps/web` | Next.js | Site clients |
| `depanno-pro` | `apps/pro` | Next.js | Espace professionnels |
| `depanno-admin` | `apps/admin` | Next.js | Back-office administrateur |

Déployez **l'API en premier** : son adresse (ex. `https://depanno-api.vercel.app`) sert aux trois sites.

## 1. MongoDB Atlas

Vercel n'a pas d'adresse IP fixe : dans Atlas › *Network Access*, autorisez `0.0.0.0/0`
(l'accès reste protégé par l'utilisateur et le mot de passe de la base).

## 2. Projet `depanno-api` (Root Directory `apps/backend`)

Variables d'environnement (Settings › Environment Variables) — reprendre les valeurs de `apps/backend/.env` :

| Variable | Valeur |
|---|---|
| `MONGODB_URI`, `MONGODB_DB` | identiques au fichier `.env` |
| `AUDIT_HMAC_KEY`, `TOTP_ENCRYPTION_KEY` | **identiques** au `.env` (sinon le journal d'audit et la 2FA existants deviennent illisibles) |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | identiques au `.env` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | identiques au `.env` |
| `ADMIN_ORIGIN`, `CLIENT_ORIGIN`, `PRO_ORIGIN` | adresses finales des 3 sites (à compléter après leur déploiement) |
| `ADMIN_SESSION_IDLE_MIN`, `ADMIN_SESSION_MAX_HOURS` | facultatif (30 / 8 par défaut) |

Ne mettez **pas** `PAYMENT_SIMULATION` : en production le paiement simulé est désactivé d'office.

## 3. Projets Next.js (`apps/web`, `apps/pro`, `apps/admin`)

Une seule variable, pour chacun : `BACKEND_URL` = adresse de l'API (ex. `https://depanno-api.vercel.app`).
Facultatif pour le site client : `NEXT_PUBLIC_SUPPORT_PHONE` (numéro de l'assistance, ex. `+2290100000000`).

Les sites appellent l'API via leur propre adresse (`/api/...` réécrit vers l'API) : les cookies de session restent
sur le domaine du site, sans configuration CORS.

## 4. Après le déploiement

1. Renseignez `ADMIN_ORIGIN`, `CLIENT_ORIGIN`, `PRO_ORIGIN` dans le projet API, puis *Redeploy*.
2. Brevo : l'expéditeur `BREVO_SENDER_EMAIL` doit rester vérifié ; pour les SMS, configurez `BREVO_SMS_SENDER`.
3. Testez : connexion admin (code 6 chiffres par e-mail), inscription client, inscription pro.

## Limites connues sur Vercel

- **Nombre de déploiements par jour** (offre gratuite) : au-delà, Vercel refuse les déploiements pendant 24 h
  (« Deployment rate limited »). Pour l'économiser, chaque application a un `vercel.json` avec `ignoreCommand` :
  un projet n'est reconstruit que si son dossier (`apps/<application>`) a changé depuis son dernier déploiement.
  Une fois la limite levée, poussez un nouveau commit ou cliquez « Redeploy » sur le dernier déploiement de chaque projet.
- **Alertes en direct du back-office** (flux SSE) : une fonction Vercel est coupée au bout de 60 s ; le navigateur
  se reconnecte automatiquement, les alertes restent reçues mais avec de courtes coupures. Pour un temps réel
  continu, l'API peut être hébergée sur un service à serveur permanent (Render, Railway, VPS) sans changer le code.
- **Paiement Mobile Money** : aucun prestataire n'est encore branché ; en production le bouton de paiement est
  désactivé tant qu'une intégration (Kkiapay, FedaPay, MTN MoMo…) n'est pas ajoutée.

## Appels dans le site (facultatif : serveur TURN)

Les appels audio passent directement entre les navigateurs (WebRTC). Des serveurs STUN publics sont utilisés par défaut ;
sur certains réseaux mobiles, la connexion directe est impossible et un **serveur TURN** est nécessaire. Pour en ajouter un
(par exemple Metered, Twilio ou Cloudflare), renseignez dans le projet API : `TURN_URL` (une ou plusieurs adresses séparées
par des virgules, ex. `turn:global.relay.metered.ca:80,turns:global.relay.metered.ca:443`), `TURN_USERNAME`, `TURN_CREDENTIAL`.
