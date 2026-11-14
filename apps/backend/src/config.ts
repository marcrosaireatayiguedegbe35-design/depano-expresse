import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

function hexKey(name: string): Buffer {
  const buf = Buffer.from(required(name), 'hex');
  if (buf.length !== 32) throw new Error(`${name} doit contenir 32 octets en hexadécimal (64 caractères)`);
  return buf;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI'),
  mongoDb: process.env.MONGODB_DB ?? 'plateforme_auto',
  isProd: process.env.NODE_ENV === 'production',
  adminOrigin: process.env.ADMIN_ORIGIN ?? 'http://localhost:3001',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  brevo: {
    apiKey: process.env.BREVO_API_KEY ?? '',
    senderEmail: process.env.BREVO_SENDER_EMAIL ?? '',
    senderName: process.env.BREVO_SENDER_NAME ?? 'Depanno Expresse',
    smsSender: process.env.BREVO_SMS_SENDER ?? '',
  },
  /** Paiement simulé (développement uniquement) tant qu'aucun prestataire Mobile Money n'est branché. */
  paymentSimulation: process.env.PAYMENT_SIMULATION === 'true' && process.env.NODE_ENV !== 'production',
  clientSession: { cookieName: 'cli_sid', days: 30 },
  proSession: { cookieName: 'pro_sid', days: 30 },
  proOrigin: process.env.PRO_ORIGIN ?? 'http://localhost:3002',
  /** Clé HMAC qui scelle chaque entrée du journal d'audit. */
  auditHmacKey: hexKey('AUDIT_HMAC_KEY'),
  /** Clé AES-256-GCM qui chiffre les secrets TOTP au repos. */
  totpEncKey: hexKey('TOTP_ENCRYPTION_KEY'),
  session: {
    cookieName: 'adm_sid',
    idleMinutes: Number(process.env.ADMIN_SESSION_IDLE_MIN ?? 30),
    absoluteHours: Number(process.env.ADMIN_SESSION_MAX_HOURS ?? 8),
  },
  lockout: { maxAttempts: 5, lockMinutes: 15 },
  /** En-tête anti-CSRF exigé sur toute requête modifiante. */
  csrfHeader: { name: 'x-requested-with', value: 'plateforme-admin' },
};
