/**
 * Pièces justificatives exigées des professionnels.
 * - « all » : obligatoire pour tous ;
 * - « business » : obligatoire si le pro déclare un atelier / une entreprise (nom d'atelier renseigné) ;
 * - « tow » : obligatoire pour les remorqueurs (véhicule de dépannage) ;
 * - « optional » : facultatif (donne le badge « Qualifié » pour les diplômes et l'assurance RC).
 */
export type DocCondition = 'all' | 'business' | 'tow' | 'optional';

export interface DocType {
  key: string;
  label: string;
  hint: string;
  when: DocCondition;
  /** Numéro du document à saisir (pièce, RCCM, IFU, permis…). */
  number?: string;
  /** Date d'expiration à saisir (pièce, permis, assurance, visite technique). */
  expiry?: boolean;
  /** Date de délivrance à saisir, avec une ancienneté maximale en jours (casier judiciaire). */
  issuedMaxDays?: number;
}

export const DOC_TYPES: DocType[] = [
  { key: 'id_card', label: 'Pièce d’identité (recto)', hint: 'CIP, carte d’identité biométrique ou passeport, face avec la photo, bien lisible.', when: 'all', number: 'Numéro de la pièce', expiry: true },
  { key: 'id_card_back', label: 'Pièce d’identité (verso)', hint: 'L’autre face de la même pièce (pour un passeport : la page des signatures).', when: 'all' },
  { key: 'selfie_id', label: 'Selfie avec votre pièce', hint: 'Une photo de vous tenant la pièce d’identité à côté de votre visage.', when: 'all' },
  { key: 'criminal_record', label: 'Casier judiciaire', hint: 'Extrait de casier judiciaire (bulletin n° 3) de moins de 3 mois.', when: 'all', issuedMaxDays: 92 },
  { key: 'proof_of_address', label: 'Justificatif de domicile', hint: 'Certificat de résidence (mairie / arrondissement) ou facture SBEE ou SONEB de moins de 3 mois.', when: 'all' },
  { key: 'workshop_photo', label: 'Photo de l’atelier ou du matériel', hint: 'L’enseigne et le local, ou votre caisse à outils et votre matériel si vous vous déplacez.', when: 'all' },
  { key: 'business_registration', label: 'Registre du commerce (RCCM)', hint: 'Extrait RCCM de votre atelier ou entreprise.', when: 'business', number: 'Numéro RCCM' },
  { key: 'ifu', label: 'Attestation IFU', hint: 'Attestation d’Identifiant Fiscal Unique délivrée par la DGI.', when: 'business', number: 'Numéro IFU (13 chiffres)' },
  { key: 'driving_license', label: 'Permis de conduire', hint: 'Permis de la catégorie adaptée à votre dépanneuse, recto et verso sur la même photo si possible.', when: 'tow', number: 'Numéro du permis', expiry: true },
  { key: 'vehicle_registration', label: 'Carte grise de la dépanneuse', hint: 'Certificat d’immatriculation du véhicule de dépannage.', when: 'tow', number: 'Immatriculation' },
  { key: 'vehicle_insurance', label: 'Assurance de la dépanneuse', hint: 'Attestation d’assurance en cours de validité.', when: 'tow', expiry: true },
  { key: 'technical_inspection', label: 'Visite technique', hint: 'Certificat de visite technique en cours de validité.', when: 'tow', expiry: true },
  { key: 'certificate', label: 'Diplôme ou attestation', hint: 'CAP, CQP, CQM, attestation de fin d’apprentissage… (facultatif, donne le badge « Qualifié »).', when: 'optional' },
  { key: 'liability_insurance', label: 'Assurance responsabilité civile pro', hint: 'Attestation d’assurance RC professionnelle (facultatif, donne le badge « Qualifié »).', when: 'optional', expiry: true },
  { key: 'other', label: 'Autre document', hint: 'Tout autre justificatif utile.', when: 'optional' },
];

export const DOC_KEYS = DOC_TYPES.map((d) => d.key);
export const docType = (key: string) => DOC_TYPES.find((d) => d.key === key);

/** Pièces obligatoires pour ce professionnel (selon son métier et l'existence d'un atelier déclaré). */
export function isRequired(t: DocType, pro: { trade?: string; businessName?: string }) {
  if (t.when === 'all') return true;
  if (t.when === 'business') return !!pro.businessName?.trim();
  if (t.when === 'tow') return pro.trade === 'remorqueur';
  return false;
}

export type ItemStatus = 'missing' | 'pending' | 'accepted' | 'rejected' | 'expired';

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  status: ItemStatus;
  /** Lien de la page du site pro où compléter l'élément (photo, Mobile Money, contrat). */
  href?: string;
  number?: string;
  expiry?: boolean;
  issuedMaxDays?: number;
  doc?: any;
}

/** Dernier document déposé pour chaque type (les dépôts plus anciens sont remplacés). */
export function latestByType(docs: any[]) {
  const map = new Map<string, any>();
  for (const d of [...docs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))) if (!map.has(d.type)) map.set(d.type, d);
  return map;
}

function docStatus(d: any, now: Date): ItemStatus {
  if (!d) return 'missing';
  if (d.expiresAt && new Date(d.expiresAt) < now) return 'expired';
  return d.status === 'accepted' ? 'accepted' : d.status === 'rejected' ? 'rejected' : 'pending';
}

/**
 * Liste de contrôle complète : pièces + photo de profil + compte Mobile Money + contrat signé.
 * `missing` = éléments obligatoires non acceptés (bloquent la validation du compte).
 */
export function checklist(pro: any, docs: any[], contractOk: boolean, now = new Date()) {
  const latest = latestByType(docs);
  const items: ChecklistItem[] = [
    { key: 'contract', label: 'Contrat de partenariat signé', hint: 'Lisez et signez votre contrat avec le doigt.', required: true, status: contractOk ? 'accepted' : 'missing', href: '/contrat' },
    { key: 'photo', label: 'Photo de profil', hint: 'Une photo nette de votre visage, visible par les clients.', required: true, status: pro.photoUrl ? 'accepted' : 'missing', href: '/profil/infos' },
    { key: 'payout', label: 'Compte Mobile Money à votre nom', hint: 'Pour recevoir le paiement de vos prestations.', required: true, status: pro.payoutAccount?.msisdn ? 'accepted' : 'missing', href: '/profil/reversement' },
  ];
  for (const t of DOC_TYPES) {
    if (t.key === 'other') continue;
    const d = latest.get(t.key);
    items.push({ key: t.key, label: t.label, hint: t.hint, required: isRequired(t, pro), status: docStatus(d, now), number: t.number, expiry: t.expiry, issuedMaxDays: t.issuedMaxDays, doc: d });
  }
  const required = items.filter((i) => i.required);
  const missing = required.filter((i) => i.status !== 'accepted');
  const qualified = ['certificate', 'liability_insurance'].some((k) => docStatus(latest.get(k), now) === 'accepted');
  return {
    items,
    missing: missing.map((i) => ({ key: i.key, label: i.label, status: i.status })),
    /** Éléments obligatoires déposés ou faits (acceptés ou en attente d'examen), pour la barre de progression. */
    provided: required.filter((i) => i.status === 'accepted' || i.status === 'pending').length,
    requiredCount: required.length,
    complete: missing.length === 0,
    qualified,
  };
}
