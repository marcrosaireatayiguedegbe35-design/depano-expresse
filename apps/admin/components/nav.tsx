'use client';

import { createContext, useContext } from 'react';

export type NavItem = { href: string; label: string; perm: string; icon: string };
export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Accueil',
    items: [
      { href: '/', label: 'Tableau de bord', perm: 'dashboard.read', icon: 'home' },
      { href: '/operations', label: 'Opérations', perm: 'operations.read', icon: 'clock' },
    ],
  },
  {
    group: 'Services',
    items: [
      { href: '/professionnels', label: 'Professionnels', perm: 'pros.read', icon: 'wrench' },
      { href: '/clients', label: 'Clients', perm: 'users.read', icon: 'users' },
      { href: '/interventions', label: 'Interventions', perm: 'interventions.read', icon: 'truck' },
      { href: '/litiges', label: 'Litiges', perm: 'disputes.read', icon: 'alert' },
      { href: '/categories', label: 'Catégories', perm: 'catalog.write', icon: 'layers' },
      { href: '/visuels', label: 'Visuels du site', perm: 'catalog.write', icon: 'image' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { href: '/finance', label: 'Finance', perm: 'finance.read', icon: 'coins' },
      { href: '/comptabilite', label: 'Comptabilité', perm: 'finance.read', icon: 'doc' },
      { href: '/parametres', label: 'Commission', perm: 'settings.read', icon: 'percent' },
    ],
  },
  {
    group: 'Commerce',
    items: [
      { href: '/produits', label: 'Produits', perm: 'products.read', icon: 'tag' },
      { href: '/commandes', label: 'Commandes', perm: 'orders.read', icon: 'cart' },
      { href: '/entreprises', label: 'Entreprises', perm: 'companies.read', icon: 'building' },
      { href: '/publicites', label: 'Publicités', perm: 'ads.read', icon: 'megaphone' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { href: '/moderation', label: 'Modération', perm: 'moderation.read', icon: 'flag' },
      { href: '/administrateurs', label: 'Administrateurs', perm: 'admins.read', icon: 'shield' },
      { href: '/journal', label: 'Journal', perm: 'audit.read', icon: 'list' },
      { href: '/compte', label: 'Mon compte', perm: '', icon: 'lock' },
    ],
  },
];

/** Groupe de navigation de la page courante (affiché en surtitre de l'en-tête). */
export const SectionCtx = createContext<string>('ADMINISTRATION');
export const useSection = () => useContext(SectionCtx);

