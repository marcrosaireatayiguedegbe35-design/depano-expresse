/**
 * Registre central des images de l'espace client.
 *
 * Pour remplacer une image : déposer le nouveau fichier dans `public/images/…` et changer
 * le chemin ici — aucune page n'a besoin d'être modifiée. Les emplacements à `null`
 * n'ont pas encore d'image fournie : un emplacement réservé propre est affiché à la place.
 * Les originaux reçus sont conservés dans `apps/web/assets-src/originaux/`.
 */
const DEFAULTS = {
  home: {
    /** Bannière d'accueil, écran Bienvenue, haut de la page Dépannage. */
    towTruck: '/images/home/depanneuse-route.jpg',
  },
  brand: {
    /** Emblème Depanno Expresse (pastille ronde des en-têtes). */
    logo: '/images/brand/embleme-depanno.png',
    /** Logo complet Depanno Expresse (emblème + nom) : écrans Bienvenue, Connexion, Inscription. */
    full: '/images/brand/logo-depanno-expresse.png',
  },
  breakdown: {
    accident: '/images/breakdown/accident.webp',
    mechanic: '/images/categories/engrenage.webp',
    tire: null,
    battery: null,
    fuel: null,
    totalBreakdown: null,
    key: null,
    other: null,
  },
  categories: {
    mechanic: '/images/categories/mecanicien-illustration.webp',
    parts: '/images/categories/engrenage.webp',
    tire: null,
    battery: null,
  },
  professionals: {
    /** Photo par défaut d'un professionnel sans photo (mécanique / général). */
    workshop: '/images/professionals/mecanicien-atelier.jpg',
    silhouette: '/images/professionals/silhouette-mecanicien.png',
  },
  advertisements: {
    /** Visuel des bannières « Publicité » quand l'annonceur n'a pas fourni d'image. */
    fallback: '/images/advertisements/homme-megaphone.webp',
  },
  companies: {
    /** Bandeau « Vous êtes une entreprise ? ». */
    join: '/images/companies/rejoindre-professionnel.webp',
    buildings: null,
  },
  profile: {
    /** Bandeaux « Besoin d'aide / d'assistance ? » et profil non connecté. */
    advisor: '/images/profile/conseillere.webp',
    /** Voiture de l'en-tête « Mon Profil » (maquette 17) — image non fournie. */
    car: null,
  },
};

/** Registre modifiable : les « Visuels du site » du back-office remplacent ces valeurs au chargement. */
export const IMAGES = DEFAULTS as typeof DEFAULTS & Record<string, Record<string, string | null>>;

/** Images choisies dans le back-office : services (par métier), problèmes et catégories (par libellé normalisé). */
export const TRADE_IMAGES: Record<string, string> = {};
export const LABEL_IMAGES: Record<string, string> = {};
export const normLabel = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
export const labelImage = (label?: string) => (label ? LABEL_IMAGES[normLabel(label)] ?? null : null);

/** Applique les « Visuels du site » définis par l'administration (clé « groupe.nom »). */
export function applySiteImages(values: Record<string, string>) {
  for (const [key, url] of Object.entries(values ?? {})) {
    const [g, n] = key.split('.');
    const slots = (IMAGES as Record<string, Record<string, string | null>>)[g];
    if (slots && n && typeof url === 'string' && url.startsWith('https://')) slots[n] = url;
  }
}

/** Visuel de couverture d'un professionnel sans photo, selon son métier. */
export function tradeCover(trade?: string): string | null {
  if (trade === 'remorqueur') return IMAGES.home.towTruck;
  if (trade === 'mecanicien' || trade === 'soudeur') return IMAGES.professionals.workshop;
  return null;
}

/** Illustration détourée d'un métier (cartes colorées). */
export function tradeArt(trade?: string): string | null {
  if (trade && TRADE_IMAGES[trade]) return TRADE_IMAGES[trade];
  if (trade === 'mecanicien') return IMAGES.categories.mechanic;
  if (trade === 'soudeur') return IMAGES.categories.parts;
  if (trade === 'remorqueur') return IMAGES.breakdown.accident;
  return null;
}
