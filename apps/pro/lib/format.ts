export const fcfa = (n?: number | null) =>
  n === undefined || n === null ? '—' : `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;

export const date = (d?: string | Date | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(d)) : '—';

export const dateTime = (d?: string | Date | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d)) : '—';

export const proName = (p?: any) =>
  !p ? '—' : p.businessName || [p.firstName, p.lastName].filter(Boolean).join(' ') || '—';

export const TRADES: Record<string, { label: string; icon: string; desc: string }> = {
  mecanicien: { label: 'Mécanicien', icon: '🔧', desc: 'Moteur, freins, embrayage, entretien' },
  vulcanisateur: { label: 'Vulcanisateur', icon: '🛞', desc: 'Pneus, chambres à air, valves' },
  electricien: { label: 'Électricien auto', icon: '🔋', desc: 'Batterie, démarreur, alternateur' },
  remorqueur: { label: 'Remorqueur', icon: '🚛', desc: 'Véhicule immobilisé, accident' },
  soudeur: { label: 'Soudeur auto', icon: '🔥', desc: 'Soudure, supports, pièces métalliques' },
};

export const COMMUNES: { name: string; lat: number; lng: number }[] = [
  { name: 'Cotonou', lat: 6.3703, lng: 2.3912 },
  { name: 'Abomey-Calavi', lat: 6.4485, lng: 2.3557 },
  { name: 'Porto-Novo', lat: 6.4969, lng: 2.6289 },
  { name: 'Sèmè-Kpodji', lat: 6.3667, lng: 2.6167 },
  { name: 'Ouidah', lat: 6.3631, lng: 2.0851 },
  { name: 'Allada', lat: 6.665, lng: 2.151 },
  { name: 'Bohicon', lat: 7.1782, lng: 2.0667 },
  { name: 'Abomey', lat: 7.1829, lng: 1.9912 },
  { name: 'Lokossa', lat: 6.6386, lng: 1.7167 },
  { name: 'Parakou', lat: 9.3372, lng: 2.6303 },
  { name: 'Djougou', lat: 9.7085, lng: 1.6660 },
  { name: 'Natitingou', lat: 10.3042, lng: 1.3796 },
  { name: 'Kandi', lat: 11.1342, lng: 2.9386 },
];

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export const STATUS: Record<string, [string, Tone]> = {
  sent: ['Envoyée', 'info'],
  pending: ['En attente', 'warning'],
  response_received: ['Réponse reçue', 'info'],
  pro_selected: ['Professionnel choisi', 'success'],
  accepted: ['Acceptée', 'info'],
  en_route: ['En route', 'info'],
  on_site: ['Arrivé sur place', 'info'],
  in_progress: ['En cours', 'info'],
  completed: ['Terminée', 'success'],
  cancelled: ['Annulée', 'neutral'],
  contested: ['Contestée', 'danger'],
  expired: ['Expirée', 'neutral'],
  submitted: ['À valider', 'warning'],
  approved: ['Confirmée – à payer', 'info'],
  superseded: ['Remplacée', 'neutral'],
  paid: ['Payée', 'success'],
  partially_refunded: ['Remboursée en partie', 'warning'],
  refunded: ['Remboursée', 'neutral'],
  succeeded: ['Réussi', 'success'],
  failed: ['Échec', 'danger'],
  proposed: ['Proposition reçue', 'success'],
  declined: ['A décliné', 'neutral'],
  info_requested: ['Demande des précisions', 'warning'],
  selected: ['Choisi', 'success'],
  closed: ['Clôturée', 'neutral'],
  confirmed: ['Confirmée', 'info'],
  preparing: ['En préparation', 'info'],
  shipped: ['Expédiée', 'info'],
  delivered: ['Livrée', 'success'],
  rejected: ['Refusé', 'neutral'],
  available: ['Disponible', 'success'],
  busy: ['Occupé', 'warning'],
  unavailable: ['Indisponible', 'neutral'],
};

export const LINE_TYPES: Record<string, string> = {
  labor: "Main-d'œuvre",
  diagnostic: 'Diagnostic',
  travel: 'Déplacement',
  service: 'Prestation',
  parts: 'Pièces détachées',
  external: 'Frais externes',
};

/** Quartier, arrondissement, commune et département du client, déduits de sa position. */
export function areaLine(a?: { quartier?: string; arrondissement?: string; commune?: string; departement?: string }): string {
  if (!a?.commune) return '';
  return [a.quartier, a.arrondissement, a.commune, a.departement].filter(Boolean).join(', ');
}

/** « 3,4 km » ou « 650 m ». */
export function kmLabel(km?: number): string {
  if (km === undefined || km === null) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${String(km).replace('.', ',')} km`;
}
