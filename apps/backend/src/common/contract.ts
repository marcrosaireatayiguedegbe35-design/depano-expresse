import { createHash } from 'crypto';

/**
 * Contrat de partenariat signé par chaque professionnel.
 * Toute modification du texte doit s'accompagner d'une nouvelle version : chaque pro devra alors signer à nouveau,
 * les versions déjà signées restant archivées telles quelles (texte figé + empreinte SHA-256).
 */
export const CONTRACT_VERSION = '1.0';

export const ID_KINDS: Record<string, string> = {
  cip: 'Certificat d’Identification Personnelle (CIP)',
  cni: 'Carte nationale d’identité biométrique',
  passport: 'Passeport',
  resident: 'Carte de séjour',
};

export const TRADE_LABELS: Record<string, string> = {
  mecanicien: 'mécanicien automobile',
  vulcanisateur: 'vulcanisateur',
  electricien: 'électricien automobile',
  remorqueur: 'dépanneur-remorqueur',
  soudeur: 'soudeur automobile',
};

/** Identité légale de la plateforme, modifiable au back-office (Paramètres → Contrat). */
export interface CompanyInfo {
  name: string;
  legalForm?: string;
  rccm?: string;
  ifu?: string;
  address?: string;
  city?: string;
  representative?: string;
  representativeTitle?: string;
  phone?: string;
  email?: string;
}

export const DEFAULT_COMPANY: CompanyInfo = { name: 'Depanno Expresse', address: 'Cotonou, République du Bénin', city: 'Cotonou', representativeTitle: 'Gérant' };

export interface ContractInput {
  proId: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  trade: string;
  phone?: string;
  email?: string;
  place: string;
  idKind: string;
  idNumber: string;
  rateBps: number;
  baseMode: string;
  company: CompanyInfo;
  date: Date;
}

export interface ContractDoc {
  title: string;
  version: string;
  reference: string;
  parties: string[];
  articles: { title: string; paras: string[] }[];
  closing: string;
}

const blank = (v?: string) => (v && v.trim() ? v.trim() : '…………');
const dateFr = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Porto-Novo' });

export function contractReference(proId: string, date: Date) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `DE-PRO-${proId.slice(-6).toUpperCase()}-${ymd}`;
}

/** Texte personnalisé du contrat (le même texte sert à l'affichage, au PDF et à l'empreinte). */
export function buildContract(i: ContractInput): ContractDoc {
  const c = i.company;
  const rate = (i.rateBps / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const base = i.baseMode === 'full_invoice'
    ? 'le montant total de la facture, pièces comprises'
    : 'le montant des prestations (main-d’œuvre, diagnostic, déplacement et autres prestations), à l’exclusion des pièces détachées et des dépenses externes';
  const company = [
    `${c.name}${c.legalForm ? `, ${c.legalForm}` : ''}`,
    `immatriculée au Registre du Commerce et du Crédit Mobilier sous le n° ${blank(c.rccm)}`,
    `Identifiant Fiscal Unique n° ${blank(c.ifu)}`,
    `dont le siège est situé à ${blank(c.address)}`,
    `représentée par ${blank(c.representative)}, en qualité de ${blank(c.representativeTitle)}`,
  ].join(', ');
  const trade = TRADE_LABELS[i.trade] ?? i.trade;
  const partner = [
    `${i.firstName} ${i.lastName}`,
    `titulaire de la pièce d’identité suivante : ${ID_KINDS[i.idKind] ?? i.idKind} n° ${i.idNumber}`,
    `exerçant le métier de ${trade}${i.businessName ? ` sous l’enseigne « ${i.businessName} »` : ' à titre individuel'}`,
    `établi(e) à ${i.place}`,
    `joignable au ${blank(i.phone)} et à l’adresse électronique ${blank(i.email)}`,
  ].join(', ');

  return {
    title: 'Contrat de partenariat professionnel',
    version: CONTRACT_VERSION,
    reference: contractReference(i.proId, i.date),
    parties: [
      'ENTRE LES SOUSSIGNÉS :',
      `${company}, ci-après dénommée « la Plateforme » ;`,
      'ET',
      `${partner}, ci-après dénommé(e) « le Partenaire ».`,
      'Il a été convenu ce qui suit.',
    ],
    articles: [
      { title: 'Article 1 – Objet', paras: [
        'Le présent contrat définit les conditions dans lesquelles le Partenaire propose ses services de dépannage et de réparation automobile aux clients de la Plateforme Depanno Expresse (sites et applications), et les engagements réciproques des parties.',
      ] },
      { title: 'Article 2 – Statut du Partenaire', paras: [
        'Le Partenaire exerce en toute indépendance. Le présent contrat ne crée aucun lien de subordination, de mandat ou de contrat de travail entre les parties. Le Partenaire reste libre d’accepter ou de refuser les demandes, de fixer ses horaires et son organisation.',
        'Le Partenaire est seul responsable du respect de ses obligations fiscales, sociales et administratives liées à son activité.',
      ] },
      { title: 'Article 3 – Inscription et vérification', paras: [
        'Le Partenaire certifie l’exactitude des informations et des pièces justificatives qu’il fournit (identité, casier judiciaire, domicile, atelier, et selon le cas registre du commerce, IFU, permis de conduire, documents du véhicule de dépannage). Il s’engage à les tenir à jour et à remplacer toute pièce expirée.',
        'Le compte n’est visible des clients qu’après validation par la Plateforme. Toute fausse déclaration ou pièce falsifiée entraîne la résiliation immédiate du contrat, sans préjudice d’éventuelles poursuites.',
      ] },
      { title: 'Article 4 – Engagements du Partenaire', paras: [
        'a) Qualité : réaliser les interventions avec soin, selon les règles de l’art, avec un matériel adapté et en bon état.',
        'b) Prix : présenter le devis ou le prix au client avant toute intervention et ne jamais réclamer un montant supérieur à celui validé par le client dans l’application.',
        'c) Pièces détachées : utiliser des pièces d’origine licite, déclarer si elles sont neuves ou d’occasion, et les facturer à leur prix réel.',
        'd) Comportement : faire preuve de courtoisie, de ponctualité et d’honnêteté ; respecter le véhicule et les biens du client ; ne jamais intervenir sous l’emprise de l’alcool ou de stupéfiants.',
        'e) Loyauté : ne pas détourner hors de la Plateforme les clients rencontrés par son intermédiaire afin d’éviter la commission.',
        'f) Traçabilité : renseigner dans l’application les étapes de l’intervention, les photos et la facture.',
      ] },
      { title: 'Article 5 – Engagements de la Plateforme', paras: [
        'La Plateforme met le Partenaire en relation avec des clients situés dans sa zone, met à sa disposition les outils de suivi, de facturation et de paiement, assure l’assistance et propose une médiation en cas de litige avec un client.',
      ] },
      { title: 'Article 6 – Commission et paiements', paras: [
        `En contrepartie de la mise en relation et des services fournis, la Plateforme perçoit une commission de ${rate} % calculée sur ${base}. Le taux applicable est celui en vigueur au moment de la validation de chaque facture.`,
        'Les paiements effectués par les clients via la Plateforme sont reversés au Partenaire sur son compte Mobile Money, déduction faite de la commission. Lorsque le client paie en espèces, le Partenaire reste redevable de la commission envers la Plateforme.',
        'Toute modification du taux de commission est notifiée au Partenaire à l’avance et ne s’applique jamais aux factures déjà validées.',
      ] },
      { title: 'Article 7 – Responsabilité et assurance', paras: [
        'Le Partenaire est seul responsable des prestations qu’il réalise et des dommages qu’il pourrait causer au client, à son véhicule ou à des tiers à l’occasion de ses interventions. La Plateforme agit en qualité d’intermédiaire et ne peut être tenue responsable de l’exécution des prestations.',
        'Le Partenaire est invité à souscrire une assurance responsabilité civile professionnelle. Pour les remorqueurs, le véhicule de dépannage doit être assuré, immatriculé et à jour de sa visite technique.',
      ] },
      { title: 'Article 8 – Évaluations et qualité de service', paras: [
        'Les clients peuvent noter et commenter les interventions. En cas de plaintes répétées, de notes durablement insuffisantes ou de manquement aux présentes, la Plateforme peut adresser un avertissement, suspendre ou résilier le compte du Partenaire.',
      ] },
      { title: 'Article 9 – Données personnelles et confidentialité', paras: [
        'Les données personnelles du Partenaire sont traitées par la Plateforme pour la gestion du partenariat, la vérification d’identité, la mise en relation et les paiements, conformément à la loi n° 2017-20 du 20 avril 2018 portant Code du numérique en République du Bénin. Le Partenaire dispose d’un droit d’accès, de rectification et de suppression qu’il exerce depuis son espace ou auprès de l’assistance.',
        'Le Partenaire s’engage à ne pas utiliser les coordonnées et informations des clients à d’autres fins que l’exécution de l’intervention demandée.',
      ] },
      { title: 'Article 10 – Durée, suspension et résiliation', paras: [
        'Le présent contrat est conclu pour une durée indéterminée à compter de sa signature.',
        'Le Partenaire peut y mettre fin à tout moment en supprimant son compte, après avoir terminé les interventions en cours et réglé les sommes éventuellement dues.',
        'La Plateforme peut suspendre ou résilier le contrat en cas de manquement grave, de fraude, de pièce expirée non remplacée ou de plaintes répétées, après en avoir informé le Partenaire.',
      ] },
      { title: 'Article 11 – Signature électronique et preuve', paras: [
        'Le présent contrat est signé de manière électronique par une signature manuscrite tracée sur l’écran. La Plateforme conserve le texte signé, son empreinte numérique (SHA-256), la date et l’heure de signature, l’adresse IP et l’appareil utilisés. Les parties reconnaissent à ces éléments la même valeur probante qu’un écrit signé sur papier.',
        'Le Partenaire peut télécharger à tout moment un exemplaire PDF du contrat signé depuis son espace professionnel.',
      ] },
      { title: 'Article 12 – Modification du contrat', paras: [
        'Toute nouvelle version du contrat est présentée au Partenaire dans son espace. Il devra la signer pour continuer à recevoir des demandes ; à défaut, il peut résilier le contrat dans les conditions de l’article 10.',
      ] },
      { title: 'Article 13 – Droit applicable et litiges', paras: [
        'Le présent contrat est soumis au droit béninois et aux Actes uniformes de l’OHADA applicables.',
        'En cas de différend, les parties recherchent d’abord une solution amiable dans un délai de trente (30) jours. À défaut d’accord, le litige est porté devant le tribunal de commerce de Cotonou.',
      ] },
    ],
    closing: `Fait à ${blank(c.city)}, le ${dateFr(i.date)}, par voie électronique.`,
  };
}

/** Texte brut canonique (sert à l'empreinte SHA-256 : un seul caractère modifié change l'empreinte). */
export function contractText(c: ContractDoc) {
  return [`${c.title} – version ${c.version}`, `Référence : ${c.reference}`, '', ...c.parties, '',
    ...c.articles.flatMap((a) => [a.title, ...a.paras, '']), c.closing].join('\n');
}

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
