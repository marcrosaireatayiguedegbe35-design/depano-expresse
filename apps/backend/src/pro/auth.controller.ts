import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpException, HttpStatus, Patch, Post, Res, UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min, ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Response } from 'express';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { config } from '../config';
import { InjectM } from '../database.module';
import { randomToken, sha256 } from '../common/crypto';
import { Client, ClientInfo } from '../common/http';
import { VerificationService } from '../common/verification.service';
import { NotificationsService } from '../common/notifications.service';
import { CurrentPro, ProContext, ProPublic } from './pro.guard';
import { currentEngagement } from '../common/pro-lock';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const PASSWORD_MSG = 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.';
const PHONE_RULE = /^\+229(01\d{8}|\d{8})$/;
const PHONE_MSG = 'Numéro au format +229 01XXXXXXXX';
const DUMMY_HASH = bcrypt.hashSync('dummy-pro-password', 10);
const STRICT = { default: { limit: 8, ttl: 60_000 } };

/** Champs du profil renvoyés au professionnel lui-même. */
export const PRO_SELF = 'firstName lastName businessName email phone photoUrl trade address commune quartier location description services zoneRadiusKm hours indicativeRates availability verificationStatus rating reviewsCount payoutAccount emailVerified createdAt';

class RegisterDto {
  @IsString() @Length(2, 60) firstName: string;
  @IsString() @Length(2, 60) lastName: string;
  @IsOptional() @IsString() @Length(0, 120) businessName?: string;
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Matches(PHONE_RULE, { message: PHONE_MSG }) phone: string;
  @IsString() @Length(8, 128) password: string;
  @IsString() @Matches(/^[a-z0-9_]{2,40}$/) trade: string;
  @IsString() @Length(2, 80) commune: string;
  @IsOptional() @IsString() @Length(0, 80) quartier?: string;
  @IsLatitude() lat: number;
  @IsLongitude() lng: number;
}
class EmailDto { @IsEmail() @MaxLength(200) email: string; }
class VerifyDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Matches(/^\d{6}$/, { message: 'Le code doit comporter 6 chiffres' }) code: string;
}
class LoginDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @Length(1, 128) password: string;
}
class ResetDto extends VerifyDto { @IsString() @Length(8, 128) password: string; }
class PasswordDto {
  @IsString() @Length(1, 128) currentPassword: string;
  @IsString() @Length(8, 128) newPassword: string;
}
class PayoutDto {
  @IsIn(['mtn', 'moov', 'celtiis']) operator: string;
  @IsString() @Matches(PHONE_RULE, { message: PHONE_MSG }) msisdn: string;
  @IsString() @Length(2, 120) holderName: string;
}
class ProfileDto {
  @IsOptional() @IsString() @Length(2, 60) firstName?: string;
  @IsOptional() @IsString() @Length(2, 60) lastName?: string;
  @IsOptional() @IsString() @Length(0, 120) businessName?: string;
  @IsOptional() @IsString() @Matches(PHONE_RULE, { message: PHONE_MSG }) phone?: string;
  @IsOptional() @ValidateIf((_o, v) => v !== '') @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Photo invalide' }) photoUrl?: string;
  @IsOptional() @IsString() @Length(0, 200) address?: string;
  @IsOptional() @IsString() @Length(2, 80) commune?: string;
  @IsOptional() @IsString() @Length(0, 80) quartier?: string;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsString() @Length(0, 1000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @Length(1, 80, { each: true }) services?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(200) zoneRadiusKm?: number;
  @IsOptional() @IsString() @Length(0, 200) hours?: string;
  @IsOptional() @IsString() @Length(0, 200) indicativeRates?: string;
  @IsOptional() @ValidateNested() @Type(() => PayoutDto) payoutAccount?: PayoutDto;
}
class AvailabilityDto { @IsIn(['available', 'busy', 'unavailable']) availability: string; }

/** Comptes de l'espace professionnels : inscription vérifiée par code, connexion, profil. */
@Controller('auth')
export class ProAuthController {
  constructor(
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('ProSession') private readonly sessions: Model<any>,
    @InjectM('ServiceCategory') private readonly categories: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    private readonly verification: VerificationService,
    private readonly ops: NotificationsService,
  ) {}

  @Post('register')
  @ProPublic()
  @Throttle(STRICT)
  async register(@Body() dto: RegisterDto) {
    if (!PASSWORD_RULE.test(dto.password)) throw new BadRequestException(PASSWORD_MSG);
    if (!(await this.categories.exists({ trade: dto.trade, active: true }))) throw new BadRequestException('Métier inconnu');
    const email = dto.email.toLowerCase().trim();
    const existing = await this.pros.findOne({ email, passwordHash: { $type: 'string' } }).select('+passwordHash');
    if (existing?.emailVerified) throw new ConflictException('Un compte professionnel existe déjà avec cet e-mail. Connectez-vous.');
    const fields = {
      firstName: dto.firstName, lastName: dto.lastName, businessName: dto.businessName || undefined, phone: dto.phone, trade: dto.trade,
      commune: dto.commune, quartier: dto.quartier, location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
      passwordHash: await bcrypt.hash(dto.password, 12),
    };
    // Nouveau compte : en attente de vérification des documents par l'administration (invisible des clients).
    const pro = existing ? Object.assign(existing, fields) : new this.pros({ ...fields, email, verificationStatus: 'pending', availability: 'unavailable' });
    await pro.save();
    const r = await this.verification.send(email, 'email', 'pro_signup', pro._id, dto.firstName);
    return { step: 'verify', email, ...r };
  }

  @Post('resend')
  @ProPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async resend(@Body() dto: EmailDto) {
    const email = dto.email.toLowerCase().trim();
    const pro = await this.pros.findOne({ email, passwordHash: { $type: 'string' }, emailVerified: false });
    if (!pro) return { ok: true };
    return this.verification.send(email, 'email', 'pro_signup', pro._id, pro.firstName);
  }

  @Post('verify')
  @ProPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async verify(@Body() dto: VerifyDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.toLowerCase().trim();
    await this.verification.verify(email, 'pro_signup', dto.code);
    const pro = await this.pros.findOne({ email, passwordHash: { $type: 'string' } });
    if (!pro) throw new BadRequestException('Compte introuvable');
    const isNew = !pro.emailVerified;
    pro.emailVerified = true;
    await pro.save();
    if (isNew) this.ops.emit('pro.registered', `${pro.firstName} ${pro.lastName} – ${pro.trade} – ${pro.commune}`, 1, { actorType: 'professional', actorId: String(pro._id), refType: 'professional', refId: String(pro._id) });
    return this.openSession(pro, client, res);
  }

  @Post('login')
  @ProPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async login(@Body() dto: LoginDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const email = dto.email.toLowerCase().trim();
    const pro = await this.pros.findOne({ email, passwordHash: { $type: 'string' } }).select('+passwordHash');
    if (!pro) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    if (pro.lockedUntil && pro.lockedUntil > new Date()) {
      throw new HttpException('Trop de tentatives. Réessayez dans 15 minutes ou réinitialisez votre mot de passe.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!(await bcrypt.compare(dto.password, pro.passwordHash))) {
      pro.failedAttempts = (pro.failedAttempts ?? 0) + 1;
      if (pro.failedAttempts >= 8) { pro.lockedUntil = new Date(Date.now() + 15 * 60_000); pro.failedAttempts = 0; }
      await pro.save();
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    if (pro.verificationStatus === 'suspended') throw new UnauthorizedException('Votre compte professionnel est suspendu. Contactez le support.');
    pro.failedAttempts = 0;
    pro.lockedUntil = undefined;
    await pro.save();
    // Plus de code à 6 chiffres à la connexion : il n'est demandé qu'à l'inscription.
    return this.openSession(pro, client, res);
  }

  @Post('forgot')
  @ProPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async forgot(@Body() dto: EmailDto) {
    const email = dto.email.toLowerCase().trim();
    const pro = await this.pros.findOne({ email, passwordHash: { $type: 'string' } });
    if (pro) await this.verification.send(email, 'email', 'pro_reset', pro._id, pro.firstName);
    return { ok: true, message: 'Si un compte existe avec cet e-mail, un code vient de vous être envoyé.' };
  }

  @Post('reset')
  @ProPublic()
  @HttpCode(200)
  @Throttle(STRICT)
  async reset(@Body() dto: ResetDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    if (!PASSWORD_RULE.test(dto.password)) throw new BadRequestException(PASSWORD_MSG);
    const email = dto.email.toLowerCase().trim();
    await this.verification.verify(email, 'pro_reset', dto.code);
    const pro = await this.pros.findOne({ email, passwordHash: { $type: 'string' } });
    if (!pro) throw new BadRequestException('Compte introuvable');
    Object.assign(pro, { passwordHash: await bcrypt.hash(dto.password, 12), emailVerified: true, failedAttempts: 0, lockedUntil: undefined });
    await pro.save();
    await this.sessions.updateMany({ professionalId: pro._id, revokedAt: null }, { revokedAt: new Date() });
    return this.openSession(pro, client, res);
  }

  @Get('me')
  @ProPublic()
  async me(@CurrentPro() me?: ProContext) {
    if (!me) return { authenticated: false };
    return { authenticated: true, pro: await this.pros.findById(me.id).select(PRO_SELF).lean() };
  }

  @Patch('me')
  async update(@CurrentPro() me: ProContext, @Body() dto: ProfileDto) {
    const { lat, lng, ...rest } = dto;
    const set: Record<string, unknown> = { ...rest };
    if (dto.photoUrl === '') { delete set.photoUrl; (set as any).$unset = { photoUrl: '' }; }
    if (lat !== undefined && lng !== undefined) set.location = { type: 'Point', coordinates: [lng, lat] };
    return this.pros.findByIdAndUpdate(me.id, set, { new: true }).select(PRO_SELF).lean();
  }

  @Patch('availability')
  async availability(@CurrentPro() me: ProContext, @Body() dto: AvailabilityDto) {
    if (dto.availability !== 'unavailable' && me.verificationStatus !== 'validated') {
      throw new BadRequestException('Votre compte doit être validé par notre équipe avant de recevoir des demandes.');
    }
    if (dto.availability === 'available') {
      const busy = await currentEngagement(this.pros, this.interventions, me.id);
      if (busy) throw new BadRequestException(`Vous êtes en intervention (${busy.reference}) : vous redeviendrez « Disponible » quand le client aura confirmé la fin des travaux.`);
    }
    return this.pros.findByIdAndUpdate(me.id, { availability: dto.availability }, { new: true }).select('availability').lean();
  }

  @Post('password')
  @HttpCode(200)
  @Throttle(STRICT)
  async changePassword(@CurrentPro() me: ProContext, @Body() dto: PasswordDto) {
    if (!PASSWORD_RULE.test(dto.newPassword)) throw new BadRequestException(PASSWORD_MSG);
    const pro = await this.pros.findById(me.id).select('+passwordHash');
    if (!pro || !(await bcrypt.compare(dto.currentPassword, pro.passwordHash))) throw new UnauthorizedException('Mot de passe actuel incorrect');
    pro.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await pro.save();
    await this.sessions.updateMany({ professionalId: pro._id, _id: { $ne: me.sessionId }, revokedAt: null }, { revokedAt: new Date() });
    return { ok: true };
  }

  @Post('logout')
  @ProPublic()
  @HttpCode(200)
  async logout(@CurrentPro() me: ProContext | undefined, @Res({ passthrough: true }) res: Response) {
    if (me) await this.sessions.updateOne({ _id: me.sessionId }, { revokedAt: new Date() });
    res.clearCookie(config.proSession.cookieName, { httpOnly: true, secure: config.isProd, sameSite: 'lax', path: '/' });
    return { ok: true };
  }

  private async openSession(pro: any, client: ClientInfo, res: Response) {
    const token = randomToken();
    const maxAge = config.proSession.days * 86_400_000;
    await this.sessions.create({ professionalId: pro._id, tokenHash: sha256(token), ...client, expiresAt: new Date(Date.now() + maxAge) });
    await this.pros.updateOne({ _id: pro._id }, { lastLoginAt: new Date() });
    res.cookie(config.proSession.cookieName, token, { httpOnly: true, secure: config.isProd, sameSite: 'lax', path: '/', maxAge });
    return { step: 'done', pro: { id: String(pro._id), firstName: pro.firstName, lastName: pro.lastName, email: pro.email } };
  }
}
