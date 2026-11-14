export const fcfa = (n?: number | null) =>
  n === undefined || n === null ? '—' : `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;

export const num = (n?: number | null) => (n === undefined || n === null ? '—' : new Intl.NumberFormat('fr-FR').format(n));

export const date = (d?: string | Date | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(d)) : '—';

export const dateTime = (d?: string | Date | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d)) : '—';

export const personName = (p?: any) =>
  !p ? '—' : p.businessName || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || '—';

export const TRADES: Record<string, string> = {
  mecanicien: 'Mécanicien',
  vulcanisateur: 'Vulcanisateur',
  electricien: 'Électricien auto',
  remorqueur: 'Remorqueur',
  soudeur: 'Soudeur auto',
};

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export const STATUS: Record<string, [string, Tone]> = {
  // vérification
  pending: ['En attente', 'warning'],
  in_review: ['En vérification', 'info'],
  validated: ['Validé', 'success'],
  rejected: ['Refusé', 'danger'],
  suspended: ['Suspendu', 'danger'],
  active: ['Actif', 'success'],
  // interventions
  draft: ['Brouillon', 'neutral'],
  sent: ['Envoyée', 'info'],
  response_received: ['Réponse reçue', 'info'],
  pro_selected: ['Pro sélectionné', 'info'],
  accepted: ['Acceptée', 'info'],
  en_route: ['En route', 'info'],
  on_site: ['Sur place', 'info'],
  in_progress: ['En cours', 'info'],
  completed: ['Terminée', 'success'],
  cancelled: ['Annulée', 'neutral'],
  contested: ['Contestée', 'danger'],
  expired: ['Expirée', 'neutral'],
  // factures & paiements
  submitted: ['À valider (client)', 'warning'],
  approved: ['Validée – à payer', 'info'],
  superseded: ['Remplacée', 'neutral'],
  paid: ['Payée', 'success'],
  partially_refunded: ['Remb. partiel', 'warning'],
  refunded: ['Remboursée', 'neutral'],
  succeeded: ['Réussi', 'success'],
  failed: ['Échec', 'danger'],
  processing: ['En cours', 'info'],
  // litiges / signalements
  open: ['Ouvert', 'danger'],
  resolved: ['Résolu', 'success'],
  dismissed: ['Classé', 'neutral'],
  // commandes
  confirmed: ['Confirmée', 'info'],
  preparing: ['En préparation', 'info'],
  shipped: ['Expédiée', 'info'],
  delivered: ['Livrée', 'success'],
  // produits / pubs
  published: ['Publié', 'success'],
  archived: ['Archivé', 'neutral'],
  paused: ['En pause', 'warning'],
  ended: ['Terminée', 'neutral'],
  // disponibilité
  available: ['Disponible', 'success'],
  busy: ['Occupé', 'warning'],
  unavailable: ['Indisponible', 'neutral'],
};

export const statusLabel = (s?: string) => (s ? STATUS[s]?.[0] ?? s : '—');

export const LINE_TYPES: Record<string, string> = {
  labor: "Main-d'œuvre",
  diagnostic: 'Diagnostic',
  travel: 'Déplacement',
  service: 'Autre prestation',
  parts: 'Pièces détachées',
  external: 'Dépense externe',
};

export const DISPUTE_DECISIONS: Record<string, string> = {
  request_new_version: 'Demander une facture corrigée',
  dismiss: 'Classer la contestation (le client revalide)',
  cancel_intervention: "Annuler l'intervention",
};
