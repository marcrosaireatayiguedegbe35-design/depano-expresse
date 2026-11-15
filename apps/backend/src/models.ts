/**
 * Schémas MongoDB du backend central (CDC §19.2).
 * Les noms de collections reprennent ceux du cahier des charges.
 */
import { Schema } from 'mongoose';
import { LINE_TYPES, BASE_MODES } from './common/commission';
import { ROLE_KEYS } from './common/permissions';

const { ObjectId, Mixed } = Schema.Types;
const ts = (collection: string) => ({ timestamps: true, collection });

/** Métiers proposés au lancement. La liste réelle est administrable (collection service_categories). */
export const TRADES = ['mecanicien', 'vulcanisateur', 'electricien', 'remorqueur', 'soudeur'] as const;
/** Format d'une clé de métier créée par l'administration. */
export const TRADE_KEY = /^[a-z0-9_]{2,40}$/;
export const VERIFICATION_STATUSES = ['pending', 'in_review', 'validated', 'rejected', 'suspended'] as const;
export const INTERVENTION_STATUSES = [
  'draft', 'sent', 'pending', 'response_received', 'pro_selected', 'accepted', 'en_route',
  'on_site', 'in_progress', 'completed', 'cancelled', 'contested', 'expired',
] as const;
export const INVOICE_STATUSES = [
  'submitted', 'approved', 'contested', 'superseded', 'paid', 'partially_refunded', 'refunded', 'cancelled',
] as const;
export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] as const;
export const AD_PLACEMENTS = ['home', 'marketplace', 'directory', 'news', 'mobile'] as const;
export const AD_KINDS = ['ad', 'promotion', 'announcement', 'news', 'event', 'partner', 'campaign'] as const;
export const AD_STATUSES = ['draft', 'active', 'paused', 'ended'] as const;

const point = new Schema(
  { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: undefined } },
  { _id: false },
);

/* ===================== Administration ===================== */

export const AdministratorSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_KEYS, required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    mustChangePassword: { type: Boolean, default: true },
    totpSecretEnc: { type: String, select: false },
    totpEnabled: { type: Boolean, default: false },
    lastTotpStep: { type: Number, default: 0, select: false },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    lastLoginIp: String,
    createdBy: { type: ObjectId, ref: 'Administrator' },
    // Propriétaire de la plateforme : peut supprimer n'importe quel administrateur, ne peut être ni supprimé ni modifié par un autre.
    isOwner: { type: Boolean, default: false },
  },
  ts('administrators'),
);

export const AdminSessionSchema = new Schema(
  {
    adminId: { type: ObjectId, ref: 'Administrator', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    /** session = connecté ; mfa = mot de passe validé, code 2FA attendu ; enroll = 1re configuration 2FA */
    purpose: { type: String, enum: ['session', 'mfa', 'enroll'], required: true },
    pendingSecretEnc: { type: String, select: false },
    attempts: { type: Number, default: 0 },
    ip: String,
    userAgent: String,
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  ts('admin_sessions'),
);
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuditLogSchema = new Schema(
  {
    seq: { type: Number, required: true, unique: true },
    at: { type: Date, required: true },
    adminId: { type: ObjectId, ref: 'Administrator' },
    adminEmail: String,
    action: { type: String, required: true, index: true },
    targetType: String,
    targetId: String,
    result: { type: String, enum: ['success', 'failure'], required: true },
    ip: String,
    userAgent: String,
    details: Mixed,
    hmac: { type: String, required: true },
  },
  // minimize: false → les objets vides sont conservés tels quels, sinon le sceau HMAC ne serait plus vérifiable.
  { collection: 'audit_logs', versionKey: false, minimize: false },
);
AuditLogSchema.index({ at: -1 });

export const CounterSchema = new Schema({ _id: String, seq: Number }, { collection: 'counters', versionKey: false });

export const SystemSettingSchema = new Schema(
  { key: { type: String, unique: true, required: true }, value: Mixed, updatedBy: { type: ObjectId, ref: 'Administrator' } },
  ts('system_settings'),
);

export const CommissionRateHistorySchema = new Schema(
  {
    rateBps: { type: Number, required: true },
    baseMode: { type: String, enum: BASE_MODES, required: true },
    effectiveFrom: { type: Date, required: true },
    setBy: { type: ObjectId, ref: 'Administrator' },
    setByEmail: String,
    reason: String,
  },
  ts('commission_rate_history'),
);

/* ===================== Utilisateurs & professionnels ===================== */

export const UserSchema = new Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, index: true },
    commune: String,
    quartier: String,
    passwordHash: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    suspension: { reason: String, at: Date, by: { type: ObjectId, ref: 'Administrator' } },
    deletionRequestedAt: Date,
    /** Compte supprimé par son titulaire : données personnelles effacées, historique comptable conservé. */
    deletedAt: Date,
  },
  ts('users'),
);
// Unicité de l'e-mail pour les comptes inscrits (les fiches sans mot de passe sont des données importées).
UserSchema.index({ email: 1 }, { name: 'email_registered_unique', unique: true, partialFilterExpression: { passwordHash: { $type: 'string' } } });

/** Codes de vérification à 6 chiffres (stockés hachés, usage unique). */
export const VerificationCodeSchema = new Schema(
  {
    destination: { type: String, required: true, index: true },
    channel: { type: String, enum: ['email', 'sms'], required: true },
    purpose: { type: String, enum: ['signup', 'login', 'password_reset', 'email_change', 'pro_signup', 'pro_reset'], required: true },
    userId: { type: ObjectId, ref: 'User' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  ts('verification_codes'),
);
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const ClientSessionSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    ip: String,
    userAgent: String,
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  ts('client_sessions'),
);
ClientSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NotificationSchema = new Schema(
  {
    recipientType: { type: String, enum: ['client', 'professional'], required: true },
    recipientId: { type: ObjectId, required: true, index: true },
    type: { type: String, required: true },
    title: String,
    body: String,
    link: String,
    readAt: Date,
  },
  ts('notifications'),
);

export const VehicleSchema = new Schema(
  { userId: { type: ObjectId, ref: 'User', index: true }, brand: String, model: String, year: Number, plate: String },
  ts('vehicles'),
);

export const ProfessionalSchema = new Schema(
  {
    firstName: String,
    lastName: String,
    businessName: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    photoUrl: String,
    /** Bannière en haut de la fiche publique, choisie par le professionnel. */
    coverUrl: String,
    trade: { type: String, required: true, index: true },
    address: String,
    commune: String,
    quartier: String,
    location: point,
    description: String,
    services: [String],
    zoneRadiusKm: Number,
    hours: String,
    indicativeRates: String,
    availability: { type: String, enum: ['available', 'busy', 'unavailable'], default: 'unavailable' },
    /** Compte supprimé par son titulaire : données personnelles effacées, historique comptable conservé. */
    deletedAt: Date,
    /** Intervention en cours : un professionnel ne prend qu'un client à la fois (voir common/pro-lock.ts). */
    activeInterventionId: { type: ObjectId, ref: 'Intervention' },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'pending', index: true },
    verificationHistory: [
      { status: String, reason: String, by: { type: ObjectId, ref: 'Administrator' }, byEmail: String, at: Date },
    ],
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    payoutAccount: { operator: String, msisdn: String, holderName: String },
    /* Compte d'accès à l'espace professionnels */
    passwordHash: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
  },
  ts('professionals'),
);
ProfessionalSchema.index({ email: 1 }, { name: 'pro_email_registered_unique', unique: true, partialFilterExpression: { passwordHash: { $type: 'string' } } });

export const ProSessionSchema = new Schema(
  {
    professionalId: { type: ObjectId, ref: 'Professional', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    ip: String,
    userAgent: String,
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  ts('pro_sessions'),
);
ProSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ProfessionalSchema.index({ location: '2dsphere' });

export const ProfessionalDocumentSchema = new Schema(
  {
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    type: { type: String, enum: ['id_card', 'business_registration', 'certificate', 'other'] },
    label: String,
    url: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  ts('professional_documents'),
);

export const ServiceCategorySchema = new Schema(
  {
    trade: { type: String, required: true, unique: true, match: TRADE_KEY },
    icon: { type: String, default: '🔧' },
    /** Visuel choisi par l'administration (remplace l'icône sur le site client). */
    imageUrl: String,
    description: String,
    name: { type: String, required: true },
    problems: [{ key: String, label: String, imageUrl: String, active: { type: Boolean, default: true } }],
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  ts('service_categories'),
);

/* ===================== Interventions, devis, factures ===================== */

const vehicleInfo = new Schema({ brand: String, model: String, year: Number }, { _id: false });

export const ServiceRequestSchema = new Schema(
  {
    clientId: { type: ObjectId, ref: 'User', index: true },
    mode: { type: String, enum: ['individual', 'grouped'], required: true },
    trade: { type: String },
    problem: String,
    description: String,
    vehicle: vehicleInfo,
    address: String,
    location: point,
    urgency: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    phone: String,
    preferredDate: Date,
    photos: [String],
    vehicleId: { type: ObjectId, ref: 'Vehicle' },
    recipients: [{ type: ObjectId, ref: 'Professional' }],
    selectedProfessionalId: { type: ObjectId, ref: 'Professional' },
    status: { type: String, enum: INTERVENTION_STATUSES, default: 'sent' },
  },
  ts('service_requests'),
);

/** Réponse d'un professionnel à une demande (individuelle ou groupée). */
export const ServiceResponseSchema = new Schema(
  {
    requestId: { type: ObjectId, ref: 'ServiceRequest', required: true, index: true },
    professionalId: { type: ObjectId, ref: 'Professional', required: true },
    status: { type: String, enum: ['pending', 'proposed', 'declined', 'info_requested', 'selected', 'closed'], default: 'pending' },
    message: String,
    estimatedPrice: Number,
    etaMinutes: Number,
    respondedAt: Date,
  },
  ts('service_responses'),
);
ServiceResponseSchema.index({ requestId: 1, professionalId: 1 }, { unique: true });

export const InterventionSchema = new Schema(
  {
    reference: { type: String, unique: true },
    requestId: { type: ObjectId, ref: 'ServiceRequest' },
    clientId: { type: ObjectId, ref: 'User', index: true },
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    trade: { type: String, index: true },
    problem: String,
    address: String,
    status: { type: String, enum: INTERVENTION_STATUSES, default: 'accepted', index: true },
    timeline: [{ status: String, at: Date, note: String, by: String }],
    currentInvoiceId: { type: ObjectId, ref: 'Invoice' },
    /** Étape déclarée par le professionnel et en attente de la confirmation du client (on_site, in_progress, completed). */
    awaitingConfirmation: String,
    confirmations: [{ status: String, decision: { type: String, enum: ['confirmed', 'rejected'] }, by: { type: String, enum: ['client', 'admin'] }, adminEmail: String, note: String, at: Date }],
    /** Dernière position GPS du professionnel, partagée uniquement pendant le trajet vers le client. */
    tracking: { lat: Number, lng: Number, accuracy: Number, heading: Number, speed: Number, at: Date },
    trail: [{ _id: false, lat: Number, lng: Number, at: Date }],
  },
  ts('interventions'),
);

const lineSchema = new Schema(
  { type: { type: String, enum: LINE_TYPES, required: true }, label: String, quantity: Number, unitPrice: Number, total: Number },
  { _id: false },
);

export const QuotationSchema = new Schema(
  {
    interventionId: { type: ObjectId, ref: 'Intervention', index: true },
    professionalId: { type: ObjectId, ref: 'Professional' },
    kind: { type: String, enum: ['initial', 'supplement'], default: 'initial' },
    diagnosis: String,
    plannedWork: String,
    lines: [lineSchema],
    total: Number,
    emergencyAuthorized: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    decidedAt: Date,
  },
  ts('quotations'),
);

/**
 * Chaque version de facture est un document immuable (collection invoice_versions
 * du CDC fusionnée ici) : une modification crée une nouvelle version et passe la
 * précédente en « superseded » (CDC §9.5).
 */
export const InvoiceSchema = new Schema(
  {
    number: { type: String, index: true },
    version: { type: Number, default: 1 },
    previousVersionId: { type: ObjectId, ref: 'Invoice' },
    changeReason: String,
    interventionId: { type: ObjectId, ref: 'Intervention', index: true },
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    clientId: { type: ObjectId, ref: 'User' },
    problem: String,
    diagnosis: String,
    workDone: String,
    observations: String,
    lines: [lineSchema],
    photos: { before: [String], after: [String], replacedParts: [String] },
    total: Number,
    commissionBase: Number,
    excludedFromBase: Number,
    /** Figés à la validation client : un changement de taux n'est jamais rétroactif. */
    commissionRateBps: Number,
    commissionBaseMode: { type: String, enum: BASE_MODES },
    commissionAmount: Number,
    professionalNet: Number,
    status: { type: String, enum: INVOICE_STATUSES, default: 'submitted', index: true },
    submittedAt: Date,
    approvedAt: Date,
  },
  ts('invoices'),
);

export const ClientApprovalSchema = new Schema(
  {
    invoiceId: { type: ObjectId, ref: 'Invoice', index: true },
    clientId: { type: ObjectId, ref: 'User' },
    decision: { type: String, enum: ['confirmed', 'contested'], required: true },
    reason: String,
    ip: String,
  },
  ts('client_approvals'),
);

export const DisputeSchema = new Schema(
  {
    interventionId: { type: ObjectId, ref: 'Intervention', index: true },
    invoiceId: { type: ObjectId, ref: 'Invoice' },
    clientId: { type: ObjectId, ref: 'User' },
    professionalId: { type: ObjectId, ref: 'Professional' },
    reason: String,
    status: { type: String, enum: ['open', 'in_review', 'resolved'], default: 'open', index: true },
    notes: [{ text: String, by: { type: ObjectId, ref: 'Administrator' }, byEmail: String, at: Date }],
    resolution: {
      decision: { type: String, enum: ['request_new_version', 'dismiss', 'cancel_intervention'] },
      note: String,
      by: { type: ObjectId, ref: 'Administrator' },
      byEmail: String,
      at: Date,
    },
  },
  ts('disputes'),
);

export const ReviewSchema = new Schema(
  {
    interventionId: { type: ObjectId, ref: 'Intervention', required: true, unique: true },
    clientId: { type: ObjectId, ref: 'User' },
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    hidden: { type: Boolean, default: false },
    moderation: { reason: String, by: { type: ObjectId, ref: 'Administrator' }, at: Date },
  },
  ts('reviews'),
);

/* ===================== Finance ===================== */

export const PaymentSchema = new Schema(
  {
    kind: { type: String, enum: ['intervention', 'order'], required: true, index: true },
    invoiceId: { type: ObjectId, ref: 'Invoice' },
    orderId: { type: ObjectId, ref: 'Order' },
    interventionId: { type: ObjectId, ref: 'Intervention' },
    clientId: { type: ObjectId, ref: 'User' },
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    amount: { type: Number, required: true },
    refundedAmount: { type: Number, default: 0 },
    method: { type: String, enum: ['mobile_money', 'card', 'cash_on_delivery', 'cash'] },
    provider: String,
    providerRef: String,
    idempotencyKey: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['pending', 'succeeded', 'failed', 'partially_refunded', 'refunded'], index: true },
    failureReason: String,
    paidAt: Date,
  },
  ts('payments'),
);

export const CommissionSchema = new Schema(
  {
    paymentId: { type: ObjectId, ref: 'Payment', unique: true },
    invoiceId: { type: ObjectId, ref: 'Invoice' },
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    trade: String,
    paymentAmount: Number,
    base: Number,
    rateBps: Number,
    amount: Number,
    professionalNet: Number,
    adjustments: [{ refundId: { type: ObjectId, ref: 'Refund' }, commissionDelta: Number, netDelta: Number, at: Date }],
    payoutId: { type: ObjectId, ref: 'Payout', index: true },
    collectedAt: Date,
    /** cash : le client a payé le professionnel en espèces ; c'est le pro qui doit la commission à la plateforme. */
    collection: { type: String, enum: ['platform', 'cash'], default: 'platform' },
    commissionSettledAt: Date,
  },
  ts('commissions'),
);

export const PayoutSchema = new Schema(
  {
    reference: { type: String, unique: true },
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    amount: Number,
    commissionIds: [{ type: ObjectId, ref: 'Commission' }],
    refundIds: [{ type: ObjectId, ref: 'Refund' }],
    beneficiary: { operator: String, msisdn: String, holderName: String },
    provider: String,
    providerRef: String,
    idempotencyKey: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    failureReason: String,
    history: [{ status: String, at: Date, by: String, note: String }],
    paidAt: Date,
  },
  ts('payouts'),
);

export const RefundSchema = new Schema(
  {
    paymentId: { type: ObjectId, ref: 'Payment', index: true },
    professionalId: { type: ObjectId, ref: 'Professional' },
    amount: Number,
    reason: String,
    commissionDelta: Number,
    professionalNetDelta: Number,
    /** Si le reversement a déjà eu lieu, la régularisation est imputée au prochain reversement. */
    settledInPayoutId: { type: ObjectId, ref: 'Payout' },
    needsSettlement: { type: Boolean, default: false },
    idempotencyKey: { type: String, unique: true, required: true },
    by: { type: ObjectId, ref: 'Administrator' },
    byEmail: String,
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'succeeded' },
  },
  ts('refunds'),
);

/* ===================== Marketplace ===================== */

export const ProductCategorySchema = new Schema(
  { name: { type: String, required: true }, slug: { type: String, unique: true }, imageUrl: String, active: { type: Boolean, default: true } },
  ts('product_categories'),
);

export const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    categoryId: { type: ObjectId, ref: 'ProductCategory', index: true },
    description: String,
    images: [String],
    price: { type: Number, required: true },
    promoPrice: Number,
    brand: String,
    compatibility: [String],
    specs: [{ name: String, value: String }],
    stock: { type: Number, default: 0 },
    warranty: String,
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  },
  ts('products'),
);

export const OrderSchema = new Schema(
  {
    number: { type: String, unique: true },
    clientId: { type: ObjectId, ref: 'User', index: true },
    /** Commande passée depuis l'espace professionnel (boutique pro). */
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    buyerType: { type: String, enum: ['client', 'professional'], default: 'client' },
    items: [{ productId: { type: ObjectId, ref: 'Product' }, name: String, quantity: Number, unitPrice: Number }],
    total: Number,
    paymentMethod: { type: String, enum: ['mobile_money', 'card', 'cash_on_delivery'] },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    delivery: { address: String, commune: String, phone: String, note: String },
    history: [{ status: String, at: Date, by: String, note: String }],
    /** Réception confirmée par le client lui-même. */
    receivedAt: Date,
    /** Problème de livraison signalé par le client (non reçu, incomplet…). */
    deliveryIssue: { reason: String, at: Date },
  },
  ts('orders'),
);

/* ===================== Annuaire & publicité ===================== */

export const CompanySchema = new Schema(
  {
    name: { type: String, required: true },
    logoUrl: String,
    bannerUrl: String,
    description: String,
    activity: String,
    address: String,
    phone: String,
    whatsapp: String,
    email: String,
    hours: String,
    gallery: [String],
    website: String,
    socials: { facebook: String, instagram: String, linkedin: String, tiktok: String },
    status: { type: String, enum: ['pending', 'validated', 'rejected'], default: 'pending', index: true },
  },
  ts('companies'),
);

export const AdvertisementSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    imageUrl: String,
    companyId: { type: ObjectId, ref: 'Company' },
    kind: { type: String, enum: AD_KINDS, default: 'ad' },
    placements: [{ type: String, enum: AD_PLACEMENTS }],
    startAt: Date,
    endAt: Date,
    link: String,
    website: String,
    /** Mention obligatoire : les publicités doivent rester identifiables (règle 28). */
    sponsoredLabel: { type: String, default: 'Publicité' },
    campaign: { name: String, budget: Number, price: Number },
    stats: { impressions: { type: Number, default: 0 }, clicks: { type: Number, default: 0 } },
    status: { type: String, enum: AD_STATUSES, default: 'draft', index: true },
  },
  ts('advertisements'),
);

/* ===================== Modération ===================== */

export const ReportSchema = new Schema(
  {
    reporterType: { type: String, enum: ['client', 'professional'] },
    reporterId: ObjectId,
    targetType: { type: String, enum: ['user', 'professional', 'message', 'review'] },
    targetId: ObjectId,
    reason: String,
    details: String,
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
    resolution: { note: String, by: { type: ObjectId, ref: 'Administrator' }, byEmail: String, at: Date },
  },
  ts('reports'),
);

/** Journal des opérations de la plateforme (demandes, paiements, commandes, inscriptions…). */
/** Appel audio dans le site entre le client et le professionnel d'une intervention (WebRTC, mise en relation par l'API). */
export const CallSchema = new Schema(
  {
    interventionId: { type: ObjectId, ref: 'Intervention', index: true },
    conversationId: { type: ObjectId, ref: 'Conversation', index: true },
    clientId: { type: ObjectId, ref: 'User', index: true },
    professionalId: { type: ObjectId, ref: 'Professional', index: true },
    caller: { type: String, enum: ['client', 'professional'], required: true },
    status: { type: String, enum: ['ringing', 'active', 'ended', 'missed', 'declined'], default: 'ringing', index: true },
    offer: String,
    answer: String,
    candidates: { client: [String], professional: [String] },
    answeredAt: Date,
    endedAt: Date,
    endedBy: String,
    expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 86_400_000) },
  },
  ts('calls'),
);
CallSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* ===================== Mise en relation hors urgence ===================== */

/** Demande de contact d'un client à un professionnel précis (révision, amélioration, travail spécifique),
 *  puis messagerie entre eux une fois la demande acceptée. */
export const ConversationSchema = new Schema(
  {
    clientId: { type: ObjectId, ref: 'User', required: true, index: true },
    professionalId: { type: ObjectId, ref: 'Professional', required: true, index: true },
    topic: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'closed'], default: 'pending', index: true },
    messages: [{ from: { type: String, enum: ['client', 'professional'] }, text: String, at: Date }],
    lastMessageAt: { type: Date, index: true },
    clientReadAt: Date,
    proReadAt: Date,
    acceptedAt: Date,
    declinedAt: Date,
    closedAt: Date,
  },
  ts('conversations'),
);

export const OperationLogSchema = new Schema(
  {
    type: { type: String, required: true, index: true },
    title: String,
    body: String,
    actorType: { type: String, enum: ['client', 'professional', 'admin', 'system'] },
    actorId: String,
    refType: String,
    refId: String,
    amount: Number,
    at: { type: Date, default: Date.now, index: true },
  },
  { collection: 'operation_logs', versionKey: false },
);

/** Registre utilisé par MongooseModule.forFeature et par le script de seed. */
export const MODELS = {
  Administrator: AdministratorSchema,
  AdminSession: AdminSessionSchema,
  AuditLog: AuditLogSchema,
  Counter: CounterSchema,
  SystemSetting: SystemSettingSchema,
  CommissionRateHistory: CommissionRateHistorySchema,
  User: UserSchema,
  Vehicle: VehicleSchema,
  Professional: ProfessionalSchema,
  ProfessionalDocument: ProfessionalDocumentSchema,
  ServiceCategory: ServiceCategorySchema,
  ServiceRequest: ServiceRequestSchema,
  Intervention: InterventionSchema,
  Quotation: QuotationSchema,
  Invoice: InvoiceSchema,
  ClientApproval: ClientApprovalSchema,
  Dispute: DisputeSchema,
  Review: ReviewSchema,
  Payment: PaymentSchema,
  Commission: CommissionSchema,
  Payout: PayoutSchema,
  Refund: RefundSchema,
  ProductCategory: ProductCategorySchema,
  Product: ProductSchema,
  Order: OrderSchema,
  Company: CompanySchema,
  Advertisement: AdvertisementSchema,
  Report: ReportSchema,
  VerificationCode: VerificationCodeSchema,
  ClientSession: ClientSessionSchema,
  Notification: NotificationSchema,
  ServiceResponse: ServiceResponseSchema,
  OperationLog: OperationLogSchema,
  ProSession: ProSessionSchema,
  Call: CallSchema,
  Conversation: ConversationSchema,
} as const;

export type ModelName = keyof typeof MODELS;
