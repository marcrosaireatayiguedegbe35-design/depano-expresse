# Depanno Expresse – Espace client (site mobile-first)

Application client reproduisant les 17 maquettes (`Téléchargements/maquette auto/`), avec les images personnelles
fournies (`Téléchargements/image a utilise/`) et le logo Depanno Expresse.

## Lancer

```bash
npm run install:all                 # une seule fois
npm run dev:backend                 # API NestJS, port 4000
npm --prefix apps/web run dev       # site client, http://localhost:3000
```

Variables facultatives du site (`apps/web/.env.local`) :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPPORT_PHONE` | Numéro de l'assistance. S'il est absent, les boutons « Appeler / Contacter » ouvrent la page Aide au lieu d'appeler. |

## Pages ↔ maquettes

| Maquette | Page | Route |
|---|---|---|
| 06 | Bienvenue (premier lancement) | `/bienvenue` |
| 05 | Découvrir (accueil) | `/` |
| 02 | Recherche | `/recherche` |
| 12 | Professionnels | `/professionnels` |
| 13 | Fiche professionnel | `/professionnels/[id]` |
| 03 / 04 | Dépannage + pros à proximité (liste/carte, GPS ou commune) + demande | `/depannage` |
| 08 | Marketplace | `/marketplace` |
| 10 | Détail produit | `/marketplace/[id]` |
| 07 | Catalogue d'une catégorie (meilleure offre, pros proches) | `/catalogue/[id]` |
| 09 | Favoris | `/favoris` |
| 11 / 17 | Profil non connecté / connecté | `/compte` |
| 15 | Connexion | `/connexion` |
| 16 | Inscription | `/inscription` |
| 01 | Annuaire des entreprises (+ fiche, + inscription entreprise) | `/entreprises` |
| 14 | Publicités & actualités (+ détail) | `/actualites` |
| — | Panier, Mes demandes, Interventions & factures, Commandes, Véhicules, Notifications, Sécurité, Aide, À propos, Confidentialité | `/panier`, `/compte/*`, `/aide`, `/a-propos`, `/confidentialite` |

Barre de navigation : **Découvrir · Professionnels · Recherche · Favoris · Profil** (onglet actif orange souligné).

Captures de comparaison maquette ↔ rendu : `docs/captures/` (393 px de large, plus `tailles-ecran.jpg` : 360 px, 430 px et grand écran).

## Organisation technique

- `apps/web/app/globals.css` : système graphique (couleurs, Poppins, rayons, ombres, composants), ajusté à l'échelle des maquettes.
- `apps/web/components/ds.tsx` : composants réutilisables (en-têtes, recherche, bascule, cartes métier / pro / produit / entreprise, bannière publicité, menus, bandeau assistance…).
- `apps/web/components/ui.tsx` : chargement des données (`useFetch`, rafraîchi en temps réel), toasts, modales, étoiles, champs.
- `apps/web/components/icons.tsx` : icônes SVG.
- `apps/web/lib/images.ts` : **registre unique des images**. Pour remplacer une image : déposer le fichier dans `apps/web/public/images/<dossier>/` et changer le chemin dans ce fichier. Les entrées à `null` affichent un emplacement réservé propre (hachuré orange).
- Originaux conservés intacts dans `apps/web/assets-src/originaux/`.
- Toutes les données affichées viennent de l'API (`/client/...`) ; aucune note, avis ou statut n'est inventé (un statut « Ouvert/Fermé » n'apparaît que si les horaires sont lisibles, les produits n'affichent pas d'étoiles puisqu'il n'existe pas d'avis produits).

## Images manquantes (emplacements réservés)

| Emplacement | Clé dans `lib/images.ts` |
|---|---|
| Tuiles Dépannage : Pneu, Batterie, Carburant, Panne totale, Clé perdue, Autre problème | `breakdown.tire / battery / fuel / totalBreakdown / key / other` |
| Visuels de catégories pneu / batterie | `categories.tire / battery` |
| Bâtiments de l'en-tête « Entreprises » | `companies.buildings` |
| Voiture de l'en-tête « Mon Profil » | `profile.car` |
| Photos produits, logos d'entreprises, visuels de publicités | à envoyer depuis le back-office (Cloudinary) |

L'image n° 4 (ouvrier casqué) porte un filigrane Vecteezy : elle n'est pas utilisée (licence à acquérir ou image à remplacer).

## Reste à faire / points à décider

- Connexion Google : retirée de l'écran Bienvenue à votre demande (non implémentée).
- « Mes moyens de paiement » (maquette 17) : non affiché, aucun moyen de paiement enregistrable n'existe encore (paiement à la livraison / Mobile Money au moment de la commande).
- Numéro de l'assistance (`NEXT_PUBLIC_SUPPORT_PHONE`) à fournir.
- Avis sur les produits et les entreprises : aucune donnée côté API, donc pas d'étoiles sur ces cartes.
- Espace professionnels (mis en pause), messagerie et appels intégrés, application mobile native.
