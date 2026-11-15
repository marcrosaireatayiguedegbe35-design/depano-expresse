# Déploiement des trois sites sur Netlify

Les trois sites (client, espace pro, back-office) sont déployés sur Netlify depuis le même dépôt GitHub.
L'API reste sur Vercel (projet `depano-expresse-aq3o`, région Paris, proche de la base de données).
Chaque dossier contient déjà un `netlify.toml` : commande `npm run build`, dossier publié `.next`, Node 20,
et reconstruction seulement si le dossier a changé. Sur Netlify, les sites appellent automatiquement
l'API de production (`https://depano-expresse-aq3o.vercel.app`) : aucune variable d'environnement n'est nécessaire.

## Créer un site (à faire 3 fois)

1. Sur app.netlify.com : **Add new project › Import an existing project** (ou « Import a Git repository »).
2. Cliquez sur **GitHub** et laissez la petite fenêtre d'autorisation se fermer.
3. Choisissez le dépôt **`depano-expresse-`**.
4. Remplissez le formulaire **sans ouvrir « Add environment variables »** :

| Site | Project name (suggestion) | Base directory | Build command | Publish directory |
|---|---|---|---|---|
| Site client | `depanno-expresse` | `apps/web` | `npm run build` | `.next` |
| Espace pro | `depanno-expresse-pro` | `apps/pro` | `npm run build` | `.next` |
| Back-office | `depanno-expresse-admin` | `apps/admin` | `npm run build` | `.next` |

   Laissez « Functions directory » vide. Netlify détecte Next.js tout seul.
5. Cliquez sur **Deploy …**. La première construction prend 2 à 4 minutes.
6. Quand le statut passe à **Published**, ouvrez l'adresse `https://<nom>.netlify.app`.

## Vérifier

- Site client : la page Découvrir s'affiche, la boutique montre les produits.
- Espace pro et back-office : la page de connexion s'affiche, puis la connexion fonctionne.
- Si une construction échoue : ouvrez le déploiement › **Deploy log**, copiez les dernières lignes rouges.

## Arrêter les anciens sites sur Vercel

Sinon, chaque envoi sur GitHub continue de consommer la limite quotidienne de Vercel.
Pour les projets `depano-expresse-iihn` (client), `depano-expresse-71k7` (pro) et `depano-expresse` (back-office),
**pas l'API `depano-expresse-aq3o`** :

1. Vercel › ouvrez le projet › **Settings › Git**.
2. Cliquez sur **Disconnect** (déconnecter le dépôt GitHub).

Les anciennes adresses `*.vercel.app` restent en ligne avec leur dernière version, mais ne se mettent plus à jour.

## Côté API (Vercel)

L'API doit connaître les nouvelles adresses pour l'envoi d'e-mails et les liens. Dans Vercel ›
`depano-expresse-aq3o` › **Settings › Environment Variables**, mettez à jour :
`CLIENT_ORIGIN`, `PRO_ORIGIN` et `ADMIN_ORIGIN` avec les adresses `https://…netlify.app`,
puis **Redeploy**.
