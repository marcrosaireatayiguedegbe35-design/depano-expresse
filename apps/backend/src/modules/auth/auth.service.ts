import {
  BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import type { Response } from 'express';
import { config } from '../../config';
import { InjectM } from '../../database.module';
import { decryptSecret, encryptSecret, randomToken, sha256 } from '../../common/crypto';
import { AdminContext, ClientInfo } from '../../common/http';
import { permissionsOf, ROLES } from '../../common/permissions';
import { AuditService } from '../audit/audit.service';
import { VerificationService } from '../../common/verification.service';

authenticator.options = { window: 1, step: 30 };

const GENERIC_LOGIN_ERROR = 'Identifiants invalides';
// Hachage factice pour garder un temps de réponse constant si l'e-mail est inconnu.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);
const ISSUER = 'Plateforme Auto – Admin';

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

@Injectable()
export class AuthService {
  constructor(
    @InjectM('Administrator') private readonly admins: Model<any>,
    @InjectM('AdminSession') private readonly sessions: Model<any>,
    private readonly audit: AuditService,
    private readonly verification: VerificationService,
  ) {}

  /** Masque l'adresse : ma****2@g****.com */
  private static hint(email: string) {
    const [u, d] = email.split('@');
    const [dn, ...tld] = d.split('.');
    return `${u.slice(0, 2)}****${u.slice(-1)}@${dn[0]}****.${tld.join('.')}`;
  }

  /** Envoie un code à 6 chiffres à l'adresse de l'administrateur (Brevo). */
  private sendEmailCode(admin: any) {
    return this.verification.send(admin.email, 'email', 'login', admin._id, admin.name);
  }

  /* ---------- Étape 1 : mot de passe ---------- */

  async login(email: string, password: string, client: ClientInfo) {
    const admin = await this.admins.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    const fail = async (reason: string, adminId?: string) => {
      await this.audit.log({ action: 'auth.login', result: 'failure', adminId, adminEmail: email, ...client, details: { reason } });
    };

    if (!admin) {
      await bcrypt.compare(password, DUMMY_HASH);
      await fail('unknown_email');
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      await fail('locked', String(admin._id));
      throw new HttpException('Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.', 423 as HttpStatus);
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      admin.failedAttempts = (admin.failedAttempts ?? 0) + 1;
      if (admin.failedAttempts >= config.lockout.maxAttempts) {
        admin.lockedUntil = new Date(Date.now() + config.lockout.lockMinutes * 60_000);
        admin.failedAttempts = 0;
        await this.audit.log({ action: 'auth.lockout', result: 'success', adminId: String(admin._id), adminEmail: admin.email, ...client });
      }
      await admin.save();
      await fail('bad_password', String(admin._id));
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    if (admin.status !== 'active') {
      await fail('suspended', String(admin._id));
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    admin.failedAttempts = 0;
    admin.lockedUntil = undefined;
    await admin.save();

    // 2FA obligatoire. Par défaut : code à 6 chiffres envoyé par e-mail (Brevo).
    // Si l'administrateur a activé une application d'authentification (TOTP), c'est elle qui est demandée.
    if (!admin.totpEnabled) {
      const ticket = await this.createTicket(String(admin._id), 'mfa', client, undefined, 10);
      let resendInSeconds = 60;
      let alreadySent = false;
      try {
        resendInSeconds = (await this.sendEmailCode(admin)).resendInSeconds;
      } catch (e) {
        // Un code récent est encore valable : on ne bloque pas la connexion, on invite à l'utiliser.
        if (e instanceof HttpException && e.getStatus() === 429) alreadySent = true;
        else throw e;
      }
      return { step: 'mfa' as const, channel: 'email' as const, ticket, emailHint: AuthService.hint(admin.email), resendInSeconds, alreadySent };
    }
    const ticket = await this.createTicket(String(admin._id), 'mfa', client, undefined, 5);
    return { step: 'mfa' as const, channel: 'totp' as const, ticket };
  }

  /* ---------- Étape 2 : code TOTP ---------- */

  async verifyMfa(ticket: string, code: string, client: ClientInfo, res: Response) {
    const t = await this.consumeTicketAttempt(ticket, 'mfa');
    const admin = await this.admins.findById(t.adminId).select('+totpSecretEnc +lastTotpStep');
    if (!admin || admin.status !== 'active') throw new UnauthorizedException('Session de connexion invalide');

    if (!admin.totpEnabled) {
      try {
        await this.verification.verify(admin.email, 'login', code);
      } catch (e) {
        await this.audit.log({ action: 'auth.mfa', result: 'failure', adminId: String(admin._id), adminEmail: admin.email, ...client, details: { channel: 'email' } });
        throw new UnauthorizedException((e as Error).message);
      }
      await this.sessions.deleteOne({ _id: t._id });
      return this.openSession(admin, client, res, 'auth.login');
    }

    const step = this.checkTotp(code, decryptSecret(admin.totpSecretEnc));
    if (step === null || step <= (admin.lastTotpStep ?? 0)) {
      await this.audit.log({ action: 'auth.mfa', result: 'failure', adminId: String(admin._id), adminEmail: admin.email, ...client });
      throw new UnauthorizedException('Code de vérification invalide');
    }
    admin.lastTotpStep = step;
    await this.sessions.deleteOne({ _id: t._id });
    return this.openSession(admin, client, res, 'auth.login');
  }

  /** Renvoi du code e-mail pendant la connexion (limité par VerificationService). */
  async resendMfa(ticket: string) {
    const t = await this.sessions.findOne({ tokenHash: sha256(ticket), purpose: 'mfa', expiresAt: { $gt: new Date() } });
    if (!t) throw new UnauthorizedException('Étape de connexion expirée. Recommencez.');
    const admin = await this.admins.findById(t.adminId);
    if (!admin || admin.status !== 'active' || admin.totpEnabled) throw new BadRequestException('Renvoi impossible');
    return this.sendEmailCode(admin);
  }

  /** Code e-mail pour confirmer une action sensible (changement de mot de passe). */
  async sendActionCode(me: AdminContext) {
    const admin = await this.admins.findById(me.id);
    if (!admin) throw new UnauthorizedException();
    if (admin.totpEnabled) return { channel: 'totp' };
    const r = await this.sendEmailCode(admin);
    return { channel: 'email', emailHint: AuthService.hint(admin.email), ...r };
  }

  async enroll(ticket: string, code: string, client: ClientInfo, res: Response) {
    const t = await this.consumeTicketAttempt(ticket, 'enroll');
    const secret = decryptSecret(t.pendingSecretEnc);
    const step = this.checkTotp(code, secret);
    const admin = await this.admins.findById(t.adminId);
    if (!admin || admin.status !== 'active') throw new UnauthorizedException('Session de connexion invalide');
    if (step === null) {
      await this.audit.log({ action: 'auth.2fa_enroll', result: 'failure', adminId: String(admin._id), adminEmail: admin.email, ...client });
      throw new UnauthorizedException('Code de vérification invalide');
    }
    admin.totpSecretEnc = encryptSecret(secret);
    admin.totpEnabled = true;
    admin.lastTotpStep = step;
    await this.sessions.deleteOne({ _id: t._id });
    await this.audit.log({ action: 'auth.2fa_enroll', result: 'success', adminId: String(admin._id), adminEmail: admin.email, ...client });
    return this.openSession(admin, client, res, 'auth.login');
  }

  /* ---------- Session ---------- */

  me(admin: AdminContext) {
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      roleLabel: (ROLES as any)[admin.role]?.label ?? admin.role,
      permissions: admin.permissions,
      mustChangePassword: admin.mustChangePassword,
    };
  }

  async logout(admin: AdminContext, client: ClientInfo, res: Response) {
    await this.sessions.updateOne({ _id: admin.sessionId }, { revokedAt: new Date() });
    this.clearCookie(res);
    await this.audit.log({ action: 'auth.logout', result: 'success', adminId: admin.id, adminEmail: admin.email, ...client });
    return { ok: true };
  }

  async changePassword(admin: AdminContext, current: string, next: string, code: string, client: ClientInfo) {
    if (!PASSWORD_RULE.test(next)) {
      throw new BadRequestException('Le mot de passe doit contenir 12 caractères minimum, avec majuscule, minuscule, chiffre et symbole.');
    }
    const doc = await this.admins.findById(admin.id).select('+passwordHash +totpSecretEnc +lastTotpStep');
    if (!doc || !(await bcrypt.compare(current, doc.passwordHash))) throw new UnauthorizedException('Mot de passe actuel incorrect');
    let step: number | null = doc.lastTotpStep ?? 0;
    if (doc.totpEnabled) {
      step = this.checkTotp(code, decryptSecret(doc.totpSecretEnc));
      if (step === null || step <= (doc.lastTotpStep ?? 0)) throw new UnauthorizedException('Code de vérification invalide');
    } else {
      await this.verification.verify(doc.email, 'login', code).catch((e) => { throw new UnauthorizedException((e as Error).message); });
    }
    if (await bcrypt.compare(next, doc.passwordHash)) throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien");

    doc.passwordHash = await bcrypt.hash(next, 12);
    doc.mustChangePassword = false;
    doc.lastTotpStep = step;
    await doc.save();
    // Révoque toutes les autres sessions.
    await this.sessions.updateMany(
      { adminId: doc._id, purpose: 'session', _id: { $ne: admin.sessionId }, revokedAt: null },
      { revokedAt: new Date() },
    );
    await this.audit.log({ action: 'auth.password_change', result: 'success', adminId: admin.id, adminEmail: admin.email, ...client });
    return { ok: true };
  }

  listSessions(admin: AdminContext) {
    return this.sessions
      .find({ adminId: admin.id, purpose: 'session', revokedAt: null, expiresAt: { $gt: new Date() } })
      .select('ip userAgent createdAt lastSeenAt expiresAt')
      .sort({ lastSeenAt: -1 })
      .lean()
      .then((list: any[]) => list.map((s) => ({ ...s, current: String(s._id) === admin.sessionId })));
  }

  async revokeSession(admin: AdminContext, sessionId: string) {
    const r = await this.sessions.updateOne({ _id: sessionId, adminId: admin.id, revokedAt: null }, { revokedAt: new Date() });
    if (!r.matchedCount) throw new BadRequestException('Session introuvable');
    return { ok: true };
  }

  /* ---------- Interne ---------- */

  private checkTotp(code: string, secret: string): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const delta = authenticator.checkDelta(code, secret);
    if (delta === null) return null;
    return Math.floor(Date.now() / 30_000) + delta;
  }

  private async createTicket(adminId: string, purpose: 'mfa' | 'enroll', client: ClientInfo, pendingSecretEnc: string | undefined, minutes: number) {
    // Un seul ticket en attente par admin.
    await this.sessions.deleteMany({ adminId, purpose: { $in: ['mfa', 'enroll'] } });
    const ticket = randomToken();
    await this.sessions.create({
      adminId, purpose, tokenHash: sha256(ticket), pendingSecretEnc, ...client,
      expiresAt: new Date(Date.now() + minutes * 60_000),
    });
    return ticket;
  }

  private async consumeTicketAttempt(ticket: string, purpose: 'mfa' | 'enroll') {
    const t = await this.sessions
      .findOneAndUpdate(
        { tokenHash: sha256(ticket), purpose, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } },
        { new: true },
      )
      .select('+pendingSecretEnc');
    if (!t) throw new UnauthorizedException('Étape de connexion expirée. Recommencez.');
    return t;
  }

  private async openSession(admin: any, client: ClientInfo, res: Response, action: string) {
    const token = randomToken();
    const maxAge = config.session.absoluteHours * 3600_000;
    await this.sessions.create({
      adminId: admin._id, purpose: 'session', tokenHash: sha256(token), ...client,
      lastSeenAt: new Date(), expiresAt: new Date(Date.now() + maxAge),
    });
    admin.lastLoginAt = new Date();
    admin.lastLoginIp = client.ip;
    await admin.save();
    res.cookie(config.session.cookieName, token, {
      httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/', maxAge,
    });
    await this.audit.log({ action, result: 'success', adminId: String(admin._id), adminEmail: admin.email, ...client });
    return {
      step: 'done' as const,
      admin: { id: String(admin._id), email: admin.email, name: admin.name, role: admin.role, permissions: permissionsOf(admin.role), mustChangePassword: admin.mustChangePassword },
    };
  }

  private clearCookie(res: Response) {
    res.clearCookie(config.session.cookieName, { httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/' });
  }

  ensureNotSelf(admin: AdminContext, targetId: string) {
    if (admin.id === targetId) throw new ForbiddenException('Action impossible sur votre propre compte');
  }
}
