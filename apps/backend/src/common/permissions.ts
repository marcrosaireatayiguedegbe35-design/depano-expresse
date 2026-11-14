/**
 * Catalogue des permissions et des rôles du back-office (CDC §16.2).
 * Source de vérité unique : les contrôles se font côté serveur à partir de ce fichier.
 */

export const PERMISSIONS = {
  'dashboard.read': 'Voir le tableau de bord',
  'admins.read': 'Voir les administrateurs',
  'admins.write': 'Gérer les administrateurs',
  'users.read': 'Voir les clients',
  'users.write': 'Suspendre / réactiver les clients',
  'pros.read': 'Voir les professionnels',
  'pros.verify': 'Vérifier les professionnels',
  'catalog.write': 'Gérer les catégories de services',
  'interventions.read': 'Voir les interventions, devis et factures',
  'disputes.read': 'Voir les litiges',
  'disputes.resolve': 'Traiter les litiges',
  'finance.read': 'Voir les données financières',
  'finance.refund': 'Effectuer des remboursements',
  'finance.payout': 'Gérer les reversements',
  'finance.export': 'Exporter les rapports financiers',
  'settings.read': 'Voir les paramètres',
  'settings.commission.write': 'Modifier le taux de commission',
  'products.read': 'Voir la marketplace',
  'products.write': 'Gérer les produits',
  'orders.read': 'Voir les commandes',
  'orders.write': 'Traiter les commandes',
  'companies.read': "Voir l'annuaire",
  'companies.write': "Gérer l'annuaire",
  'ads.read': 'Voir les publicités',
  'ads.write': 'Gérer les publicités',
  'moderation.read': 'Voir les signalements et avis',
  'moderation.write': 'Modérer',
  'audit.read': "Consulter le journal d'activité",
  'operations.read': 'Consulter et exporter le journal des opérations',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLES = {
  super_admin: {
    label: 'Super administrateur',
    permissions: Object.keys(PERMISSIONS) as Permission[],
  },
  admin_general: {
    label: 'Administrateur général',
    // Tout sauf la modification du taux de commission (réservée au super admin, CDC §16.5).
    permissions: (Object.keys(PERMISSIONS) as Permission[]).filter((p) => p !== 'settings.commission.write'),
  },
  pro_manager: {
    label: 'Gestionnaire des professionnels',
    permissions: ['dashboard.read', 'pros.read', 'pros.verify', 'catalog.write', 'users.read', 'interventions.read', 'moderation.read', 'operations.read'],
  },
  marketplace_manager: {
    label: 'Gestionnaire marketplace',
    permissions: ['dashboard.read', 'products.read', 'products.write', 'orders.read', 'orders.write'],
  },
  ads_manager: {
    label: 'Gestionnaire publicitaire',
    permissions: ['dashboard.read', 'ads.read', 'ads.write', 'companies.read', 'companies.write'],
  },
  finance_manager: {
    label: 'Gestionnaire financier',
    permissions: [
      'dashboard.read', 'finance.read', 'finance.refund', 'finance.payout', 'finance.export',
      'interventions.read', 'disputes.read', 'disputes.resolve', 'settings.read', 'pros.read', 'operations.read',
    ],
  },
  moderator: {
    label: 'Modérateur',
    permissions: ['dashboard.read', 'users.read', 'users.write', 'pros.read', 'moderation.read', 'moderation.write', 'disputes.read'],
  },
} satisfies Record<string, { label: string; permissions: Permission[] }>;

export type RoleKey = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

export function permissionsOf(role: string): Permission[] {
  return (ROLES as Record<string, { permissions: Permission[] }>)[role]?.permissions ?? [];
}
