import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCommission, prorateAfterRefund, InvoiceLine } from './commission';

test('Scénario 7 du CDC : 50 000 FCFA → 10 000 plateforme / 40 000 professionnel', () => {
  const lines: InvoiceLine[] = [{ type: 'labor', label: 'Réparation', quantity: 1, unitPrice: 50000 }];
  const r = computeCommission(lines, 2000, 'services_only');
  assert.equal(r.total, 50000);
  assert.equal(r.commission, 10000);
  assert.equal(r.professionalNet, 40000);
});

test('Les pièces et dépenses externes sont exclues de la base en mode services_only', () => {
  const lines: InvoiceLine[] = [
    { type: 'labor', label: "Main-d'œuvre", quantity: 1, unitPrice: 20000 },
    { type: 'travel', label: 'Déplacement', quantity: 1, unitPrice: 5000 },
    { type: 'parts', label: 'Plaquettes', quantity: 2, unitPrice: 12500 },
    { type: 'external', label: 'Remorquage tiers', quantity: 1, unitPrice: 10000 },
  ];
  const r = computeCommission(lines, 2000, 'services_only');
  assert.equal(r.total, 60000);
  assert.equal(r.commissionBase, 25000);
  assert.equal(r.excludedFromBase, 35000);
  assert.equal(r.commission, 5000);
  assert.equal(r.professionalNet, 55000);
});

test('Le mode full_invoice prélève sur toute la facture', () => {
  const lines: InvoiceLine[] = [
    { type: 'labor', label: 'MO', quantity: 1, unitPrice: 20000 },
    { type: 'parts', label: 'Pièce', quantity: 1, unitPrice: 30000 },
  ];
  assert.equal(computeCommission(lines, 2000, 'full_invoice').commission, 10000);
});

test('Le client paie exactement le total : la commission ne s’ajoute pas', () => {
  const lines: InvoiceLine[] = [{ type: 'labor', label: 'MO', quantity: 3, unitPrice: 7333 }];
  const r = computeCommission(lines, 2000, 'services_only');
  assert.equal(r.commission + r.professionalNet, r.total);
});

test('Montants non entiers ou négatifs refusés', () => {
  assert.throws(() => computeCommission([{ type: 'labor', label: 'x', quantity: 1, unitPrice: 10.5 }], 2000, 'services_only'));
  assert.throws(() => computeCommission([{ type: 'labor', label: 'x', quantity: 1, unitPrice: -1 }], 2000, 'services_only'));
  assert.throws(() => computeCommission([], 20000, 'services_only'));
});

test('Remboursement partiel : commission recalculée au prorata', () => {
  // 50 000 payés, commission 10 000, remboursement de 10 000
  const r = prorateAfterRefund(10000, 50000, 10000);
  assert.equal(r.commission, 8000);
  assert.equal(r.professionalNet, 32000);
});

test('Remboursement total : commission annulée', () => {
  assert.deepEqual(prorateAfterRefund(10000, 50000, 50000), { commission: 0, professionalNet: 0 });
  assert.throws(() => prorateAfterRefund(10000, 50000, 60000));
});
