/**
 * Règles financières des interventions (CDC §10).
 *
 * - Tous les montants sont des entiers en FCFA (le XOF n'a pas de subdivision).
 * - Le taux est exprimé en points de base (2000 = 20 %) pour éviter les flottants.
 * - La commission est une retenue sur la part du professionnel : elle ne s'ajoute
 *   jamais au montant payé par le client (CDC §10.6).
 */

export const LINE_TYPES = ['labor', 'diagnostic', 'travel', 'service', 'parts', 'external'] as const;
export type LineType = (typeof LINE_TYPES)[number];

export const LINE_TYPE_LABELS: Record<LineType, string> = {
  labor: "Main-d'œuvre",
  diagnostic: 'Diagnostic',
  travel: 'Déplacement',
  service: 'Autre prestation professionnelle',
  parts: 'Pièces détachées',
  external: 'Dépense externe justifiée',
};

/** Lignes soumises à commission en mode « services_only » (CDC §10.4). */
export const ELIGIBLE_LINE_TYPES: readonly LineType[] = ['labor', 'diagnostic', 'travel', 'service'];

export const BASE_MODES = ['services_only', 'full_invoice'] as const;
export type BaseMode = (typeof BASE_MODES)[number];

export const DEFAULT_RATE_BPS = 2000;

export interface InvoiceLine {
  type: LineType;
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface CommissionBreakdown {
  total: number;
  commissionBase: number;
  excludedFromBase: number;
  rateBps: number;
  commission: number;
  professionalNet: number;
}

function assertAmount(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} doit être un entier positif (FCFA)`);
}

export function lineTotal(line: InvoiceLine): number {
  assertAmount(line.unitPrice, 'Le prix unitaire');
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error('La quantité doit être un entier > 0');
  return line.quantity * line.unitPrice;
}

export function computeCommission(lines: InvoiceLine[], rateBps: number, mode: BaseMode): CommissionBreakdown {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new Error('Taux invalide');
  let total = 0;
  let base = 0;
  for (const line of lines) {
    const t = lineTotal(line);
    total += t;
    if (mode === 'full_invoice' || ELIGIBLE_LINE_TYPES.includes(line.type)) base += t;
  }
  const commission = Math.round((base * rateBps) / 10000);
  return {
    total,
    commissionBase: base,
    excludedFromBase: total - base,
    rateBps,
    commission,
    professionalNet: total - commission,
  };
}

/**
 * Recalcule la commission après un remboursement (CDC §10.8).
 * La commission est réduite au prorata de la part non remboursée du paiement.
 */
export function prorateAfterRefund(originalCommission: number, paymentTotal: number, refundedTotal: number) {
  assertAmount(originalCommission, 'La commission');
  assertAmount(paymentTotal, 'Le paiement');
  assertAmount(refundedTotal, 'Le remboursement');
  if (refundedTotal > paymentTotal) throw new Error('Remboursement supérieur au paiement');
  if (paymentTotal === 0) return { commission: 0, professionalNet: 0 };
  const kept = paymentTotal - refundedTotal;
  const commission = Math.round((originalCommission * kept) / paymentTotal);
  return { commission, professionalNet: kept - commission };
}

export const percentToBps = (p: number) => Math.round(p * 100);
export const bpsToPercent = (bps: number) => bps / 100;
