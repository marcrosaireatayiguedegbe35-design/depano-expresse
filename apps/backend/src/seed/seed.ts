/**
 * Initialisation de la base :
 *   npm run seed       → super administrateur, catégories, paramètres de commission
 *   npm run seed:demo  → idem + données de démonstration (si la base est vide)
 */
import mongoose, { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { config } from '../config';
import { MODELS, ModelName } from '../models';
import { computeCommission, DEFAULT_RATE_BPS, InvoiceLine } from '../common/commission';
import { temporaryPassword } from '../common/crypto';

const M = {} as Record<ModelName, Model<any>>;

const SERVICE_CATEGORIES = [
  { trade: 'mecanicien', icon: '🔧', name: 'Mécanique', problems: ['Panne moteur', 'Véhicule qui ne démarre pas', 'Surchauffe', 'Freinage', 'Embrayage', 'Fuite', 'Entretien'] },
  { trade: 'vulcanisateur', icon: '🛞', name: 'Vulcanisation', problems: ['Pneu crevé', 'Changement de pneu', 'Réparation de chambre à air', 'Problème de valve', 'Pression des pneus'] },
  { trade: 'electricien', icon: '🔋', name: 'Électricité automobile', problems: ['Batterie', 'Alternateur', 'Démarreur', 'Éclairage', 'Faisceau électrique', 'Problème électrique général'] },
  { trade: 'remorqueur', icon: '🚛', name: 'Remorquage', problems: ['Véhicule immobilisé', 'Accident', 'Panne moteur', 'Transport vers un garage'] },
  { trade: 'soudeur', icon: '🔥', name: 'Soudure automobile', problems: ['Soudure métallique', 'Réparation de supports', 'Réparation de pièces métalliques', 'Autres travaux de soudure'] },
];

const PRODUCT_CATEGORIES = [
  'Pièces détachées', 'Pneus', 'Chambres à air', 'Batteries', 'Huiles', 'Lubrifiants', 'Filtres',
  'Accessoires', 'Outils', 'Équipements de garage', "Produits d'entretien", 'Équipements de sécurité',
];

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (s: string) => slug(s).replace(/-/g, '_');
const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000 - rand(0, 36_000_000));

async function base() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase();
  if (!email) throw new Error('SEED_ADMIN_EMAIL manquant dans .env');
  if (!(await M.Administrator.exists({ role: 'super_admin' }))) {
    const password = temporaryPassword();
    await M.Administrator.create({
      email, name: process.env.SEED_ADMIN_NAME ?? 'Super Administrateur', role: 'super_admin',
      passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true,
    });
    console.log('\n================ SUPER ADMINISTRATEUR CRÉÉ ================');
    console.log(`  E-mail                 : ${email}`);
    console.log(`  Mot de passe temporaire: ${password}`);
    console.log('  → affiché une seule fois. 2FA et nouveau mot de passe exigés à la 1re connexion.');
    console.log('===========================================================\n');
  } else {
    console.log('Super administrateur déjà présent : inchangé.');
  }

  for (const [i, c] of SERVICE_CATEGORIES.entries()) {
    await M.ServiceCategory.updateOne(
      { trade: c.trade },
      { $setOnInsert: { name: c.name, icon: c.icon, order: i, active: true, problems: c.problems.map((p) => ({ key: key(p), label: p, active: true })) } },
      { upsert: true },
    );
  }
  for (const name of PRODUCT_CATEGORIES) {
    await M.ProductCategory.updateOne({ slug: slug(name) }, { $setOnInsert: { name, active: true } }, { upsert: true });
  }
  if (!(await M.SystemSetting.exists({ key: 'commission' }))) {
    await M.SystemSetting.create({ key: 'commission', value: { rateBps: DEFAULT_RATE_BPS, baseMode: 'services_only' } });
    await M.CommissionRateHistory.create({ rateBps: DEFAULT_RATE_BPS, baseMode: 'services_only', effectiveFrom: new Date(), reason: 'Taux standard du cahier des charges (20 %)' });
  }
  console.log('Catégories de services, catégories produits et commission (20 %) initialisées.');
}

/* ------------------------------------------------------------------ */

const FIRST = ['Koffi', 'Afi', 'Sèna', 'Codjo', 'Mariam', 'Rodrigue', 'Fifamè', 'Ismaël', 'Nadège', 'Gildas', 'Yasmine', 'Brice', 'Aïcha', 'Hervé', 'Bénédicte'];
const LAST = ['Agbo', 'Houngbédji', 'Dossou', 'Akpovi', 'Sossa', 'Zinsou', 'Adjovi', 'Tchibozo', 'Gbaguidi', 'Hounkpatin', 'Kpadé', 'Ahouansou'];
const COMMUNES = [
  { c: 'Cotonou', q: ['Akpakpa', 'Cadjèhoun', 'Fidjrossè', 'Gbégamey', 'Zogbo'], lat: 6.3703, lng: 2.3912 },
  { c: 'Abomey-Calavi', q: ['Godomey', 'Togba', 'Zoca', 'Akassato'], lat: 6.4485, lng: 2.3557 },
  { c: 'Porto-Novo', q: ['Ouando', 'Tokpota', 'Djègan-Kpèvi'], lat: 6.4969, lng: 2.6289 },
  { c: 'Parakou', q: ['Banikanni', 'Zongo', 'Albarika'], lat: 9.3372, lng: 2.6303 },
];
const TRADES = ['mecanicien', 'vulcanisateur', 'electricien', 'remorqueur', 'soudeur'] as const;
const BRANDS = [['Toyota', 'Corolla'], ['Toyota', 'RAV4'], ['Hyundai', 'Tucson'], ['Peugeot', '406'], ['Honda', 'Civic'], ['Mercedes', 'C 200'], ['Nissan', 'Patrol']];

function invoiceLines(trade: string): InvoiceLine[] {
  const lines: InvoiceLine[] = [
    { type: 'labor', label: "Main-d'œuvre", quantity: 1, unitPrice: rand(8, 40) * 1000 },
    { type: 'travel', label: 'Déplacement', quantity: 1, unitPrice: pick([2000, 3000, 5000]) },
  ];
  if (trade !== 'remorqueur' && Math.random() > 0.3) {
    lines.push({ type: 'parts', label: pick(['Plaquettes de frein', 'Courroie', 'Bougie', 'Valve', 'Fusible', 'Filtre à huile']), quantity: rand(1, 2), unitPrice: rand(3, 25) * 1000 });
  }
  if (Math.random() > 0.7) lines.push({ type: 'diagnostic', label: 'Diagnostic', quantity: 1, unitPrice: 5000 });
  return lines;
}

async function demo() {
  if (await M.User.exists({})) {
    console.log('Des clients existent déjà : données de démonstration non ajoutées.');
    return;
  }
  console.log('Création des données de démonstration…');

  const users = await M.User.insertMany(
    Array.from({ length: 40 }, (_, i) => {
      const f = pick(FIRST), l = pick(LAST);
      return {
        firstName: f, lastName: l, email: `${slug(f)}.${slug(l)}${i}@exemple.bj`, phone: `+2290197${String(100000 + i).slice(1)}`,
        commune: pick(COMMUNES).c, status: i % 17 === 0 ? 'suspended' : 'active', createdAt: daysAgo(rand(1, 120)),
      };
    }),
  );
  await M.Vehicle.insertMany(users.slice(0, 30).map((u) => { const [b, m] = pick(BRANDS); return { userId: u._id, brand: b, model: m, year: rand(2005, 2022) }; }));

  const statuses = ['validated', 'validated', 'validated', 'validated', 'pending', 'in_review', 'rejected', 'suspended'];
  const pros = await M.Professional.insertMany(
    Array.from({ length: 30 }, (_, i) => {
      const loc = pick(COMMUNES); const f = pick(FIRST), l = pick(LAST);
      const trade = TRADES[i % TRADES.length]; const vs = statuses[i % statuses.length];
      return {
        firstName: f, lastName: l, businessName: i % 3 === 0 ? `Garage ${l}` : undefined, trade,
        email: `pro.${slug(l)}${i}@exemple.bj`, phone: `+2290196${String(100000 + i).slice(1)}`,
        commune: loc.c, quartier: pick(loc.q), address: `Rue ${rand(100, 999)}, ${loc.c}`,
        location: { type: 'Point', coordinates: [loc.lng + (Math.random() - 0.5) / 20, loc.lat + (Math.random() - 0.5) / 20] },
        description: 'Professionnel expérimenté, intervention rapide.', services: ['Dépannage', 'Diagnostic'],
        zoneRadiusKm: pick([5, 10, 15, 25]), hours: 'Lun–Sam 7h–19h', indicativeRates: 'À partir de 5 000 FCFA',
        availability: vs === 'validated' ? pick(['available', 'busy', 'unavailable']) : 'unavailable',
        verificationStatus: vs, verificationHistory: [{ status: vs, at: daysAgo(rand(1, 60)), byEmail: 'seed' }],
        payoutAccount: { operator: pick(['MTN MoMo', 'Moov Money']), msisdn: `+2290196${String(100000 + i).slice(1)}`, holderName: `${f} ${l}` },
        createdAt: daysAgo(rand(10, 150)),
      };
    }),
  );
  await M.ProfessionalDocument.insertMany(
    pros.flatMap((p: any) => [
      { professionalId: p._id, type: 'id_card', label: "Pièce d'identité", url: 'https://exemple.bj/docs/cni.pdf', status: p.verificationStatus === 'validated' ? 'accepted' : 'pending' },
      { professionalId: p._id, type: 'business_registration', label: 'Registre du commerce (RCCM)', url: 'https://exemple.bj/docs/rccm.pdf', status: p.verificationStatus === 'validated' ? 'accepted' : 'pending' },
    ]),
  );

  const validated = pros.filter((p: any) => p.verificationStatus === 'validated');
  let seq = 1;
  for (let i = 0; i < 70; i++) {
    const pro: any = pick(validated); const client: any = pick(users); const [b, m] = pick(BRANDS);
    const cat = SERVICE_CATEGORIES.find((c) => c.trade === pro.trade)!;
    const problem = pick(cat.problems); const created = daysAgo(rand(0, 45));
    const grouped = Math.random() > 0.6;
    const request = await M.ServiceRequest.create({
      clientId: client._id, mode: grouped ? 'grouped' : 'individual', trade: pro.trade, problem, description: `${problem} sur ${b} ${m}`,
      vehicle: { brand: b, model: m, year: rand(2005, 2022) }, address: `${pro.quartier}, ${pro.commune}`, urgency: pick(['normal', 'high']),
      recipients: grouped ? validated.filter((p: any) => p.trade === pro.trade).slice(0, 4).map((p: any) => p._id) : [pro._id],
      selectedProfessionalId: pro._id, status: 'pro_selected', createdAt: created,
    });

    // Répartition des scénarios
    const r = Math.random();
    const scenario = r < 0.55 ? 'paid' : r < 0.65 ? 'approved' : r < 0.75 ? 'submitted' : r < 0.83 ? 'contested' : r < 0.93 ? 'in_progress' : 'cancelled';
    const status = scenario === 'paid' || scenario === 'approved' || scenario === 'submitted' ? 'completed'
      : scenario === 'contested' ? 'contested' : scenario === 'in_progress' ? pick(['accepted', 'en_route', 'on_site', 'in_progress']) : 'cancelled';

    const intervention = await M.Intervention.create({
      reference: `INT-${String(seq++).padStart(5, '0')}`, requestId: request._id, clientId: client._id, professionalId: pro._id,
      trade: pro.trade, problem, address: request.address, status, createdAt: created,
      timeline: [{ status: 'accepted', at: created }, { status: 'in_progress', at: new Date(created.getTime() + 3_600_000) }, { status, at: new Date(created.getTime() + 7_200_000) }],
    });
    if (scenario === 'in_progress' || scenario === 'cancelled') continue;

    const lines = invoiceLines(pro.trade);
    await M.Quotation.create({
      interventionId: intervention._id, professionalId: pro._id, kind: 'initial', diagnosis: `Diagnostic : ${problem.toLowerCase()}`,
      plannedWork: 'Réparation et contrôle', lines: lines.map((l) => ({ ...l, total: l.quantity * l.unitPrice })),
      total: lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), status: 'accepted', decidedAt: created, createdAt: created,
    });
    const calc = computeCommission(lines, DEFAULT_RATE_BPS, 'services_only');
    const approvedAt = new Date(created.getTime() + 9_000_000);
    const invoice = await M.Invoice.create({
      number: `FAC-${intervention.reference.slice(4)}`, version: 1, interventionId: intervention._id, professionalId: pro._id, clientId: client._id,
      problem, diagnosis: `Origine identifiée : ${problem.toLowerCase()}`, workDone: 'Remplacement / réparation effectués, essai routier OK.',
      lines: lines.map((l) => ({ ...l, total: l.quantity * l.unitPrice })), total: calc.total, commissionBase: calc.commissionBase,
      excludedFromBase: calc.excludedFromBase, submittedAt: new Date(created.getTime() + 8_000_000),
      ...(scenario === 'paid' || scenario === 'approved'
        ? { commissionRateBps: DEFAULT_RATE_BPS, commissionBaseMode: 'services_only', commissionAmount: calc.commission, professionalNet: calc.professionalNet, approvedAt }
        : {}),
      status: scenario === 'paid' ? 'paid' : scenario,
      createdAt: created,
    });
    intervention.currentInvoiceId = invoice._id;
    await intervention.save();

    if (scenario !== 'submitted') {
      await M.ClientApproval.create({ invoiceId: invoice._id, clientId: client._id, decision: scenario === 'contested' ? 'contested' : 'confirmed', reason: scenario === 'contested' ? 'Montant supérieur au devis accepté' : undefined, createdAt: approvedAt });
    }
    if (scenario === 'contested') {
      await M.Dispute.create({ interventionId: intervention._id, invoiceId: invoice._id, clientId: client._id, professionalId: pro._id, reason: 'Le montant facturé dépasse le devis accepté sans supplément validé.', status: pick(['open', 'in_review']), createdAt: approvedAt });
    }
    if (scenario === 'paid') {
      const paidAt = new Date(approvedAt.getTime() + 600_000);
      const payment = await M.Payment.create({
        kind: 'intervention', invoiceId: invoice._id, interventionId: intervention._id, clientId: client._id, professionalId: pro._id,
        amount: calc.total, method: 'mobile_money', provider: pick(['MTN MoMo', 'Moov Money']), providerRef: `TX${rand(10_000_000, 99_999_999)}`,
        idempotencyKey: `seed-${intervention.reference}`, status: 'succeeded', paidAt, createdAt: paidAt,
      });
      await M.Commission.create({
        paymentId: payment._id, invoiceId: invoice._id, professionalId: pro._id, trade: pro.trade, paymentAmount: calc.total,
        base: calc.commissionBase, rateBps: DEFAULT_RATE_BPS, amount: calc.commission, professionalNet: calc.professionalNet, collectedAt: paidAt,
      });
      if (Math.random() > 0.4) {
        await M.Review.create({ interventionId: intervention._id, clientId: client._id, professionalId: pro._id, rating: rand(3, 5), comment: pick(['Travail rapide et propre.', 'Très professionnel.', 'Correct, un peu en retard.', 'Je recommande !']), createdAt: paidAt });
      }
    }
  }

  // Notes moyennes
  const agg = await M.Review.aggregate([{ $group: { _id: '$professionalId', avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  for (const a of agg) await M.Professional.updateOne({ _id: a._id }, { rating: Math.round(a.avg * 10) / 10, reviewsCount: a.n });

  // Un reversement payé pour un professionnel
  const someCommissions = await M.Commission.find().limit(3);
  if (someCommissions.length) {
    const proId = someCommissions[0].professionalId;
    const mine = await M.Commission.find({ professionalId: proId, payoutId: null });
    const pro: any = await M.Professional.findById(proId);
    const payout = await M.Payout.create({
      reference: 'RV-DEMO-0001', professionalId: proId, amount: mine.reduce((s: number, c: any) => s + c.professionalNet, 0),
      commissionIds: mine.map((c: any) => c._id), beneficiary: pro.payoutAccount, status: 'paid', providerRef: 'MOMO-DEMO-1', paidAt: new Date(),
      idempotencyKey: 'seed-payout-demo-0001', history: [{ status: 'pending', at: daysAgo(2), by: 'seed' }, { status: 'paid', at: new Date(), by: 'seed' }],
    });
    await M.Commission.updateMany({ _id: { $in: payout.commissionIds } }, { payoutId: payout._id });
  }

  // Marketplace
  const cats = await M.ProductCategory.find();
  const catBySlug = (s: string) => cats.find((c: any) => c.slug === s)?._id;
  const products = await M.Product.insertMany([
    { name: 'Batterie 12V 70Ah', reference: 'BAT-70', categoryId: catBySlug('batteries'), price: 65000, promoPrice: 59000, brand: 'Varta', stock: 14, warranty: '12 mois', compatibility: ['Toyota Corolla', 'Hyundai Tucson'], status: 'published' },
    { name: 'Pneu 205/55 R16', reference: 'PN-2055516', categoryId: catBySlug('pneus'), price: 48000, brand: 'Michelin', stock: 32, warranty: '24 mois', status: 'published' },
    { name: 'Huile moteur 5W30 – 5 L', reference: 'HUI-5W30-5', categoryId: catBySlug('huiles'), price: 22000, brand: 'Total', stock: 4, status: 'published' },
    { name: 'Filtre à huile', reference: 'FLT-OIL-01', categoryId: catBySlug('filtres'), price: 4500, brand: 'Bosch', stock: 60, status: 'published' },
    { name: 'Plaquettes de frein avant', reference: 'PLQ-AV-01', categoryId: catBySlug('pieces-detachees'), price: 18000, brand: 'Brembo', stock: 2, status: 'published' },
    { name: "Triangle de signalisation", reference: 'SEC-TRI', categoryId: catBySlug('equipements-de-securite'), price: 6000, stock: 25, status: 'draft' },
    { name: 'Cric hydraulique 2T', reference: 'OUT-CRIC-2T', categoryId: catBySlug('outils'), price: 27000, stock: 9, status: 'published' },
  ]);
  const orderStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'delivered', 'cancelled'];
  await M.Order.insertMany(
    Array.from({ length: 18 }, (_, i) => {
      const p: any = pick(products.filter((x: any) => x.status === 'published')); const qty = rand(1, 3); const client: any = pick(users);
      const st = pick(orderStatuses); const unit = p.promoPrice ?? p.price;
      return {
        number: `CMD-${String(1000 + i)}`, clientId: client._id, items: [{ productId: p._id, name: p.name, quantity: qty, unitPrice: unit }],
        total: qty * unit, paymentMethod: pick(['mobile_money', 'cash_on_delivery']), paymentStatus: st === 'delivered' ? 'paid' : 'pending',
        status: st, delivery: { address: `${pick(COMMUNES).c}`, phone: client.phone }, history: [{ status: st, at: daysAgo(rand(0, 20)), by: 'seed' }],
        createdAt: daysAgo(rand(0, 30)),
      };
    }),
  );

  // Annuaire & publicités
  const companies = await M.Company.insertMany([
    { name: 'Bénin Auto Pièces', activity: 'Distribution de pièces détachées', address: 'Bd Steinmetz, Cotonou', phone: '+2290121000000', website: 'https://exemple.bj', status: 'validated', description: 'Grossiste en pièces toutes marques.' },
    { name: 'Lubrifiants du Golfe', activity: 'Huiles et lubrifiants', address: 'Zone industrielle, Cotonou', phone: '+2290121000001', status: 'validated' },
    { name: 'Auto-École Excellence', activity: 'Formation à la conduite', address: 'Godomey, Abomey-Calavi', phone: '+2290121000002', status: 'pending' },
    { name: 'Pneus Express Parakou', activity: 'Vente de pneus', address: 'Parakou centre', phone: '+2290121000003', website: 'https://exemple.bj/pneus', status: 'validated' },
  ]);
  await M.Advertisement.insertMany([
    { title: 'Promo batteries -10 %', kind: 'promotion', companyId: companies[0]._id, placements: ['home', 'marketplace', 'mobile'], startAt: daysAgo(10), endAt: new Date(Date.now() + 20 * 86_400_000), link: 'https://exemple.bj/promo', status: 'active', campaign: { name: 'Batteries saison des pluies', budget: 150000, price: 150000 }, stats: { impressions: 18450, clicks: 612 } },
    { title: 'Vidange offerte dès 4 bidons', kind: 'ad', companyId: companies[1]._id, placements: ['home', 'directory'], startAt: daysAgo(30), endAt: daysAgo(2), status: 'ended', campaign: { name: 'Vidange', budget: 80000, price: 80000 }, stats: { impressions: 9020, clicks: 201 } },
    { title: 'Salon de l’automobile de Cotonou', kind: 'event', placements: ['news', 'home'], startAt: new Date(), endAt: new Date(Date.now() + 40 * 86_400_000), status: 'draft', stats: { impressions: 0, clicks: 0 } },
  ]);

  // Signalements
  await M.Report.insertMany([
    { reporterType: 'client', reporterId: users[0]._id, targetType: 'professional', targetId: pros[0]._id, reason: 'Comportement inapproprié', details: 'Propos déplacés au téléphone.', status: 'open' },
    { reporterType: 'professional', reporterId: pros[1]._id, targetType: 'user', targetId: users[2]._id, reason: 'Faux rendez-vous', details: 'Client absent à trois reprises.', status: 'open' },
    { reporterType: 'client', reporterId: users[3]._id, targetType: 'message', targetId: new Types.ObjectId(), reason: 'Spam', status: 'resolved', resolution: { note: 'Message supprimé', at: daysAgo(3), byEmail: 'seed' } },
  ]);
  console.log('Données de démonstration créées.');
}

async function main() {
  await mongoose.connect(config.mongoUri, { dbName: config.mongoDb });
  for (const name of Object.keys(MODELS) as ModelName[]) M[name] = mongoose.model(name, MODELS[name]);
  await Promise.all(Object.values(M).map((m) => m.syncIndexes()));
  console.log(`Connecté à MongoDB – base « ${config.mongoDb} »`);
  await base();
  if (process.argv.includes('--demo')) await demo();
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
