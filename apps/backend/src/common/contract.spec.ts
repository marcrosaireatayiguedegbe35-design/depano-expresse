import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import { buildContract, contractText, DEFAULT_COMPANY, sha256 } from './contract';
import { contractPdf } from './contract-pdf';
import { checklist } from './pro-requirements';

const input = {
  proId: '65f0c0ffee0000000000abcd', firstName: 'Koffi', lastName: 'Adjovi', businessName: 'Garage du Centre', trade: 'mecanicien',
  phone: '+2290197000000', email: 'koffi@example.com', place: 'Akpakpa, arrondissement 1, Cotonou, département Littoral',
  idKind: 'cip', idNumber: 'AB1234567', rateBps: 1000, baseMode: 'services_only', company: DEFAULT_COMPANY, date: new Date('2026-11-19T10:00:00Z'),
};

test('le contrat est personnalisé et son empreinte change au moindre caractère', () => {
  const doc = buildContract(input);
  const text = contractText(doc);
  assert.match(text, /Koffi Adjovi/);
  assert.match(text, /AB1234567/);
  assert.match(text, /Garage du Centre/);
  assert.match(text, /10 %/);
  assert.equal(doc.reference, 'DE-PRO-00ABCD-20261119');
  const other = contractText(buildContract({ ...input, idNumber: 'AB1234568' }));
  assert.notEqual(sha256(text), sha256(other));
});

test('le PDF signé est généré (accents, signature, certificat)', async () => {
  const doc = buildContract(input);
  // PNG 1×1 transparent
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const bytes = await contractPdf({
    doc, textHash: sha256(contractText(doc)), signatureDataUrl: png, signedName: 'Koffi Adjovi', signedAt: new Date(),
    ip: '41.85.1.2', userAgent: 'Mozilla/5.0 (Linux; Android 14)', idKind: 'cip', idNumber: 'AB1234567', contractId: 'abc',
    companyName: 'Depanno Expresse',
  });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  assert.ok(bytes.length > 5000);
  if (process.env.CONTRACT_PDF_OUT) writeFileSync(process.env.CONTRACT_PDF_OUT, bytes);
});

test('la liste de contrôle dépend du métier et de l’atelier', () => {
  const base = { trade: 'mecanicien', photoUrl: 'x', payoutAccount: { msisdn: '1' } };
  const solo = checklist(base, [], true);
  assert.ok(!solo.items.find((i) => i.key === 'ifu')!.required);
  assert.ok(!solo.items.find((i) => i.key === 'driving_license')!.required);
  const tow = checklist({ ...base, trade: 'remorqueur', businessName: 'Dépannage Express' }, [], false);
  assert.ok(tow.items.find((i) => i.key === 'ifu')!.required);
  assert.ok(tow.items.find((i) => i.key === 'driving_license')!.required);
  assert.ok(tow.missing.some((m) => m.key === 'contract'));
  // pièce expirée = non acceptée
  const now = new Date();
  const docs = ['id_card', 'id_card_back', 'selfie_id', 'criminal_record', 'proof_of_address', 'workshop_photo']
    .map((type) => ({ type, status: 'accepted', createdAt: now, expiresAt: type === 'id_card' ? new Date(+now - 86400_000) : undefined }));
  const r = checklist(base, docs, true, now);
  assert.deepEqual(r.missing.map((m) => m.key), ['id_card']);
  assert.equal(r.missing[0].status, 'expired');
  const ok = checklist(base, docs.map((d) => ({ ...d, expiresAt: undefined })), true, now);
  assert.ok(ok.complete);
});
