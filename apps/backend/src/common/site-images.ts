/** Emplacements d'images du site client modifiables par l'administration (clé = chemin dans le registre IMAGES du site). */
export const SITE_IMAGE_SLOTS: { key: string; label: string; group: string }[] = [
  { key: 'brand.logo', label: 'Emblème (pastille ronde des en-têtes)', group: 'Marque' },
  { key: 'brand.full', label: 'Logo complet (Bienvenue, À propos)', group: 'Marque' },
  { key: 'home.towTruck', label: 'Photo dépanneuse (accueil, Bienvenue, Dépannage)', group: 'Accueil' },
  { key: 'advertisements.fallback', label: 'Visuel des publicités sans image', group: 'Accueil' },
  { key: 'breakdown.mechanic', label: 'Dépannage – Mécanique', group: 'Tuiles Dépannage' },
  { key: 'breakdown.tire', label: 'Dépannage – Pneu (crevaison)', group: 'Tuiles Dépannage' },
  { key: 'breakdown.battery', label: 'Dépannage – Batterie', group: 'Tuiles Dépannage' },
  { key: 'breakdown.fuel', label: 'Dépannage – Carburant', group: 'Tuiles Dépannage' },
  { key: 'breakdown.accident', label: 'Dépannage – Accident', group: 'Tuiles Dépannage' },
  { key: 'breakdown.totalBreakdown', label: 'Dépannage – Panne totale', group: 'Tuiles Dépannage' },
  { key: 'breakdown.key', label: 'Dépannage – Clé perdue ou bloquée', group: 'Tuiles Dépannage' },
  { key: 'breakdown.other', label: 'Dépannage – Autre problème', group: 'Tuiles Dépannage' },
  { key: 'professionals.workshop', label: 'Photo par défaut d’un professionnel sans photo', group: 'Professionnels' },
  { key: 'companies.buildings', label: 'En-tête de l’annuaire des entreprises', group: 'Entreprises' },
  { key: 'companies.join', label: 'Bandeau « Vous êtes une entreprise ? »', group: 'Entreprises' },
  { key: 'profile.advisor', label: 'Conseillère (bandeaux d’aide, profil)', group: 'Profil' },
  { key: 'profile.car', label: 'Voiture de l’en-tête « Mon Profil »', group: 'Profil' },
];
export const SITE_IMAGE_KEYS = new Set(SITE_IMAGE_SLOTS.map((s) => s.key));
