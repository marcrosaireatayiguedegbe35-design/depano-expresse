# Plateforme Auto – Back-office administrateur

Première brique du projet (CDC v3.0) : le **backend central** (NestJS + MongoDB) et le **back-office administrateur** (Next.js).
Les sites clients/professionnels et l'application mobile viendront se brancher sur le même backend.

```
apps/
  backend/   API NestJS – /admin (back-office) et /client (site + appli clients), port 4000
  admin/     Back-office Next.js (port 3001), proxy /api → backend /admin – design Canaan Mining
  web/       Site clients Next.js (port 3000), proxy /api → backend /client
```

Déploiement : [docs/DEPLOIEMENT-VERCEL.md](docs/DEPLOIEMENT-VERCEL.md) · Espace pro : `npm run dev:pro` (port 3002).

Lancer le site clients (Depanno Expresse) : `npm --prefix apps/web run dev` — documentation complète : [docs/ESPACE-CLIENT.md](docs/ESPACE-CLIENT.md).

**Codes à 6 chiffres** (inscription client, mot de passe oublié, connexion admin) envoyés par **Brevo** (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`). En développement, les adresses de domaines réservés (`.test`, `.local`, `example.com`) ne sont jamais envoyées : le code s'affiche dans la console du backend.

**Temps réel** : chaque opération (demande, devis, facture, paiement, commande, inscription) est enregistrée dans le journal des opérations et poussée au back-office (flux SSE) : alarme sonore forte, compteur sur la cloche, rechargement automatique des pages.

**Pages ajoutées** : Journal des opérations (filtres + export CSV), Comptabilité (journal en partie double, balance, export CSV), Services créables par l'administration, export du journal d'activité admin.

`PAYMENT_SIMULATION=true` (développement uniquement) simule le paiement Mobile Money tant qu'aucun prestataire n'est branché.

## Démarrage

```bash
npm run install:all
npm run dev:backend      # terminal 1
npm run dev:admin        # terminal 2
```

Ouvrir http://localhost:3001. Première connexion : mot de passe temporaire affiché par le seed → configuration de la 2FA (QR code) → nouveau mot de passe obligatoire.

- `npm --prefix apps/backend run seed` : super admin (depuis `SEED_ADMIN_EMAIL`), catégories, commission 20 %.
- `npm --prefix apps/backend run seed:demo` : idem + données de démonstration (si aucun client).
- `npm test` : tests des règles de commission (scénario 7 du CDC : 50 000 → 10 000 / 40 000).

Secrets dans `apps/backend/.env` (non versionné) ; modèle dans `.env.example`.

## Sécurité du back-office (CDC §16.1, §20)

| Exigence | Mise en œuvre |
|---|---|
| Indépendance | Collection `administrators` séparée ; aucun compte client/pro ne peut ouvrir de session admin |
| Double authentification | TOTP obligatoire (enrôlement forcé à la 1re connexion), secret chiffré AES-256-GCM, anti-rejeu |
| Sessions | Cookie httpOnly / SameSite=Strict, opaque, vérifié en base à chaque requête ; inactivité 30 min, max 8 h ; révocables |
| Tentatives | Verrouillage 15 min après 5 échecs + limitation de débit (5/min sur l'auth) |
| Permissions | 7 rôles, 28 permissions, contrôle serveur, **refus par défaut** sur toute route non déclarée |
| CSRF / injections | En-tête personnalisé obligatoire, DTO en liste blanche, filtres fermés, regex échappées, export CSV anti-formules |
| Journal | Chaque action modifiante journalisée ; entrées numérotées et scellées HMAC, vérification d'intégrité intégrée |
| Taux de commission | Super admin uniquement, justification obligatoire, historique, jamais rétroactif (taux figé sur la facture) |
| Finance | Montants entiers FCFA, transactions MongoDB, `Idempotency-Key` obligatoire (remboursements, reversements) |

## Modules

Tableau de bord · Professionnels (vérification, documents) · Clients · Demandes & interventions (devis, factures versionnées, validations, paiements) · Litiges · Catégories de services · Finance (synthèse, factures, paiements, commissions, reversements, remboursements, exports CSV) · Taux de commission · Produits & catégories · Commandes · Annuaire entreprises · Publicités & actualités · Signalements & avis · Administrateurs · Journal d'activité · Mon compte.

Images (produits, entreprises, publicités) : envoi direct vers Cloudinary avec signature serveur.

## Reste à faire

- Passkeys (WebAuthn) en complément du code e-mail.
- Intégration réelle d'un prestataire Mobile Money (les reversements sont aujourd'hui confirmés manuellement avec la référence de transaction).
- Alertes de sécurité (e-mail/SMS) sur verrouillage et connexions inhabituelles.
- Espace professionnels (prochaine étape), messagerie, appels WebRTC, application mobile.
