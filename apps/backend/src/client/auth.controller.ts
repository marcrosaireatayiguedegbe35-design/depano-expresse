import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Patch, Post, Res, UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { config } from '../config';
import { InjectM } from '../database.module';
import { randomToken, sha256 } from '../common/crypto';
import { Client, ClientInfo } from '../common/http';
import { VerificationService } from '../common/verification.service';
import { NotificationsService } from '../common/notifications.service';
import { ClientContext, ClientPublic, CurrentClient } from './client.guard';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.';
/** Numéros béninois : +229 suivi de 10 chiffres (01XXXXXXXX) ou ancien format à 8 chiffres. */
const PHONE_RULE = /^\+229(01\d{8}|\d{8})$/;
const DUMMY_HASH = bcrypt.hashSync('dummy-client-password', 10);

class RegisterDto {
  @IsString() @Length(2, 60) firstName: string;
  @IsString() @Length(2, 60) lastName: string;
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Matches(PHONE_RULE, { message: 'Numéro au format +229 01XXXXXXXX' }) phone: string;
  @IsString() @Length(8, 128) password: string;
  @IsOptional() @IsString() @Length(0, 80) commune?: string;
}

class EmailDto {
  @IsEmail() @MaxLength(200) email: string;
}

class VerifyDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Matches(/^\d{6}$/, { message: 'Le code doit comporter 6 chiffres' }) code: string;
}

class LoginDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Length(1, 128) password: string;
}

class ResetDto extends VerifyDto {
  @IsString() @Length(8, 128) password: string;
}

class ProfileDto {
  @IsOptional() @IsString() @Length(2, 60) firstName?: string;
  @IsOptional() @IsString() @Length(2, 60) lastName?: string;
  @IsOptional() @IsString() @Matches(PHONE_RULE, { message: 'Numéro au format +229 01XXXXXXXX' }) phone?: string;
  @IsOptional() @IsString() @Length(0, 80) commune?: string;
  @IsOptional() @IsString() @Length(0, 80) quartier?: string;
}

class PasswordDto {
  @IsString() @Length(1, 128) currentPassword: string;
  @IsString() @Length(8, 128) newPassword: string;
}

const STRICT = { default: { limit: 8, ttl: 60_000 } };

@Controller('auth')
export class ClientAuthController {
  constructor(
    @InjectM('User') private readonly users: Model<any>,
    @InjectM('ClientSession') private readonly sessions: Model<any>,
    private readonly verification: VerificationService,
    private readonly ops: NotificationsService,
  ) {}

  /* ---------- Inscription : compte créé non vérifié, code envoyé par e-mail ---------- */

  @Post('register')
  @ClientPublic()
  @Throttle(STRICT)
  async register(@Body() dto: RegisterDto) {
    if (!PASSWORD_RULE.test(dto.password)) throw new BadRequestException(PASSWORD_MSG);
    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findOne({ email, passwordHash: { $type: 'string' } }).select('+passwordHash');
    if (existing?.emailVerified) throw new ConflictException('Un compte existe déjà avec cet e-mail. Connectez-vous.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = existing
      ? Object.assign(existing, { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone, commune: dto.commune, passwordHash })
      : new this.users({ firstName: dto.firstName, lastName: dto.lastName, email, phone: dto.phone, commune: dto.commune, passwordHash });
    await user.save();
    const r = await this.verification.send(email, 'email', 'signup', user._id, dto.firstName);
    return { step: 'verify', email, ...r };
  }

  @Post('resend')
  @ClientPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async resend(@Body() dto: EmailDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ email, passwordHash: { $type: 'string' }, emailVerified: false });
    // Réponse identique que le compte existe ou non (pas d'énumération).
    if (!user) return { ok: true };
    return this.verification.send(email, 'email', 'signup', user._id, user.firstName);
  }

  @Post('verify')
  @ClientPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async verify(@Body() dto: VerifyDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.toLowerCase().trim();
    await this.verification.verify(email, 'signup', dto.code);
    const user = await this.users.findOne({ email, passwordHash: { $type: 'string' } });
    if (!user) throw new BadRequestException('Compte introuvable');
    const isNew = !user.emailVerified;
    user.emailVerified = true;
    await user.save();
    if (isNew) this.ops.emit('client.registered', `${user.firstName} ${user.lastName} – ${user.email}`, 1, { actorType: 'client', actorId: String(user._id), refType: 'user', refId: String(user._id) });
    return this.openSession(user, client, res);
  }

  /* ---------- Connexion ---------- */

  @Post('login')
  @ClientPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async login(@Body() dto: LoginDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ email, passwordHash: { $type: 'string' } }).select('+passwordHash');
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException('Trop de tentatives. Réessayez dans 15 minutes ou réinitialisez votre mot de passe.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      user.failedAttempts = (user.failedAttempts ?? 0) + 1;
      if (user.failedAttempts >= 8) {
        user.lockedUntil = new Date(Date.now() + 15 * 60_000);
        user.failedAttempts = 0;
      }
      await user.save();
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    if (user.status !== 'active') throw new UnauthorizedException('Votre compte est suspendu. Contactez le support.');
    user.failedAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();
    // Plus de code à 6 chiffres à la connexion : il n'est demandé qu'à l'inscription.
    return this.openSession(user, client, res);
  }

  /* ---------- Mot de passe oublié : code à 6 chiffres ---------- */

  @Post('forgot')
  @ClientPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async forgot(@Body() dto: EmailDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findOne({ email, passwordHash: { $type: 'string' } });
    if (user) await this.verification.send(email, 'email', 'password_reset', user._id, user.firstName);
    return { ok: true, message: 'Si un compte existe avec cet e-mail, un code vient de vous être envoyé.' };
  }

  @Post('reset')
  @ClientPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async reset(@Body() dto: ResetDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    if (!PASSWORD_RULE.test(dto.password)) throw new BadRequestException(PASSWORD_MSG);
    const email = dto.email.toLowerCase().trim();
    await this.verification.verify(email, 'password_reset', dto.code);
    const user = await this.users.findOne({ email, passwordHash: { $type: 'string' } });
    if (!user) throw new BadRequestException('Compte introuvable');
    user.passwordHash = await bcrypt.hash(dto.password, 12);
    user.emailVerified = true; // le code reçu prouve la possession de l'adresse
    user.failedAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();
    await this.sessions.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
    return this.openSession(user, client, res);
  }

  /* ---------- Session & profil ---------- */

  @Get('me')
  @ClientPublic()
  async me(@CurrentClient() me?: ClientContext) {
    if (!me) return { authenticated: false };
    const user = await this.users.findById(me.id).select('firstName lastName email phone commune quartier emailVerified createdAt').lean();
    return { authenticated: true, user };
  }

  @Patch('me')
  async updateProfile(@CurrentClient() me: ClientContext, @Body() dto: ProfileDto) {
    return this.users.findByIdAndUpdate(me.id, dto, { new: true }).select('firstName lastName email phone commune quartier').lean();
  }

  @Post('password')
  @HttpCode(200)
  @Throttle(STRICT)
  async changePassword(@CurrentClient() me: ClientContext, @Body() dto: PasswordDto) {
    if (!PASSWORD_RULE.test(dto.newPassword)) throw new BadRequestException(PASSWORD_MSG);
    const user = await this.users.findById(me.id).select('+passwordHash');
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) throw new UnauthorizedException('Mot de passe actuel incorrect');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await user.save();
    await this.sessions.updateMany({ userId: user._id, _id: { $ne: me.sessionId }, revokedAt: null }, { revokedAt: new Date() });
    return { ok: true };
  }

  @Post('logout')
  @ClientPublic()
  @HttpCode(200)
  async logout(@CurrentClient() me: ClientContext | undefined, @Res({ passthrough: true }) res: Response) {
    if (me) await this.sessions.updateOne({ _id: me.sessionId }, { revokedAt: new Date() });
    res.clearCookie(config.clientSession.cookieName, { httpOnly: true, secure: config.isProd, sameSite: 'lax', path: '/' });
    return { ok: true };
  }

  /** Demande de suppression du compte (CDC §18) : traitée par l'administration. */
  @Delete('me')
  async requestDeletion(@CurrentClient() me: ClientContext, @Res({ passthrough: true }) res: Response) {
    await this.users.updateOne({ _id: me.id }, { deletionRequestedAt: new Date() });
    await this.sessions.updateMany({ userId: me.id, revokedAt: null }, { revokedAt: new Date() });
    res.clearCookie(config.clientSession.cookieName, { path: '/' });
    return { ok: true, message: 'Votre demande de suppression a été enregistrée.' };
  }

  private async openSession(user: any, client: ClientInfo, res: Response) {
    const token = randomToken();
    const maxAge = config.clientSession.days * 86_400_000;
    await this.sessions.create({ userId: user._id, tokenHash: sha256(token), ...client, expiresAt: new Date(Date.now() + maxAge) });
    await this.users.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
    // SameSite=Lax : le lien depuis un e-mail ouvre l'espace connecté ; le CSRF est bloqué par l'en-tête obligatoire.
    res.cookie(config.clientSession.cookieName, token, { httpOnly: true, secure: config.isProd, sameSite: 'lax', path: '/', maxAge });
    return { step: 'done', user: { id: String(user._id), firstName: user.firstName, lastName: user.lastName, email: user.email } };
  }
}
