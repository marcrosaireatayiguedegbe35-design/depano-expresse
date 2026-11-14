import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Model, Types } from 'mongoose';
import { InjectM } from '../database.module';
import { hmac, safeEqualHex } from './crypto';
import { emailLayout, MailService } from './mail.service';

export type CodePurpose = 'signup' | 'login' | 'password_reset' | 'email_change' | 'pro_signup' | 'pro_reset';
export type Channel = 'email' | 'sms';

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_S = 60;
const MAX_SENDS_PER_HOUR = 5;

const SUBJECTS: Record<CodePurpose, string> = {
  signup: 'Votre code de confirmation',
  login: 'Votre code de connexion',
  password_reset: 'Réinitialisation de votre mot de passe',
  email_change: 'Confirmez votre nouvelle adresse e-mail',
  pro_signup: 'Confirmez votre compte professionnel',
  pro_reset: 'Réinitialisation de votre mot de passe professionnel',
};

/**
 * Codes de vérification à 6 chiffres envoyés par Brevo.
 * - tirage cryptographique (crypto.randomInt) ;
 * - stockage haché (HMAC), jamais en clair ;
 * - validité 10 min, 5 essais, usage unique ;
 * - limites d'envoi : 1 code / 60 s et 5 codes / heure par destinataire.
 */
@Injectable()
export class VerificationService {
  constructor(
    @InjectM('VerificationCode') private readonly codes: Model<any>,
    private readonly mail: MailService,
  ) {}

  private hash(destination: string, purpose: string, code: string) {
    return hmac(`otp|${purpose}|${destination}|${code}`);
  }

  async send(destination: string, channel: Channel, purpose: CodePurpose, userId?: Types.ObjectId, name?: string) {
    const dest = channel === 'email' ? destination.toLowerCase().trim() : destination.trim();
    const now = Date.now();
    const recent = await this.codes
      .find({ destination: dest, purpose, createdAt: { $gte: new Date(now - 3600_000) } })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean<any[]>();
    if (recent[0] && now - new Date(recent[0].createdAt).getTime() < RESEND_COOLDOWN_S * 1000) {
      const wait = Math.ceil((RESEND_COOLDOWN_S * 1000 - (now - new Date(recent[0].createdAt).getTime())) / 1000);
      throw new HttpException(`Patientez ${wait} s avant de demander un nouveau code.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= MAX_SENDS_PER_HOUR) {
      throw new HttpException('Trop de codes demandés. Réessayez dans une heure.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Un seul code actif par destinataire et par usage.
    await this.codes.updateMany({ destination: dest, purpose, consumedAt: null }, { consumedAt: new Date() });
    await this.codes.create({
      destination: dest, channel, purpose, userId, codeHash: this.hash(dest, purpose, code),
      expiresAt: new Date(now + TTL_MINUTES * 60_000),
    });

    if (channel === 'sms') {
      await this.mail.sendSms(dest, `${code} est votre code de vérification Depanno Expresse. Valable ${TTL_MINUTES} min. Ne le communiquez à personne.`);
    } else {
      const html = emailLayout(SUBJECTS[purpose], `
        <p>${name ? `Bonjour ${name.replace(/[<>&"]/g, '')},` : 'Bonjour,'}</p>
        <p>Voici votre code de vérification :</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#f4f5f7;border-radius:8px;padding:14px;margin:16px 0">${code}</p>
        <p>Il est valable <strong>${TTL_MINUTES} minutes</strong>. Ne le communiquez à personne : notre équipe ne vous le demandera jamais.</p>`);
      await this.mail.sendEmail({ email: dest, name }, `${code} – ${SUBJECTS[purpose]}`, html,
        `Votre code de vérification : ${code} (valable ${TTL_MINUTES} minutes). Ne le communiquez à personne.`);
    }
    return { expiresInSeconds: TTL_MINUTES * 60, resendInSeconds: RESEND_COOLDOWN_S };
  }

  /** Vérifie et consomme le code. Renvoie l'userId associé éventuel. */
  async verify(destination: string, purpose: CodePurpose, code: string, channel: Channel = 'email') {
    const dest = channel === 'email' ? destination.toLowerCase().trim() : destination.trim();
    if (!/^\d{6}$/.test(code)) throw new BadRequestException('Le code doit comporter 6 chiffres');
    const doc = await this.codes.findOneAndUpdate(
      { destination: dest, purpose, consumedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true, sort: { createdAt: -1 } },
    );
    if (!doc) throw new BadRequestException('Code expiré ou trop d’essais. Demandez un nouveau code.');
    if (!safeEqualHex(this.hash(dest, purpose, code), doc.codeHash)) {
      const left = MAX_ATTEMPTS - doc.attempts;
      throw new BadRequestException(left > 0 ? `Code incorrect. ${left} essai(s) restant(s).` : 'Code incorrect. Demandez un nouveau code.');
    }
    doc.consumedAt = new Date();
    await doc.save();
    return { userId: doc.userId as Types.ObjectId | undefined };
  }
}
