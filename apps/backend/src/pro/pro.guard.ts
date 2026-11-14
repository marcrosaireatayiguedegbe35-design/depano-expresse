import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Model } from 'mongoose';
import type { Request } from 'express';
import { config } from '../config';
import { InjectM } from '../database.module';
import { sha256 } from '../common/crypto';

export const PRO_PUBLIC_KEY = 'pro:public';
/** Route de l'espace professionnels accessible sans connexion (inscription, connexion…). */
export const ProPublic = () => SetMetadata(PRO_PUBLIC_KEY, true);

export const PRO_CSRF = { name: 'x-requested-with', value: 'plateforme-pro' };
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface ProContext {
  id: string;
  email: string;
  name: string;
  trade: string;
  verificationStatus: string;
  sessionId: string;
}

export type ProRequest = Request & { pro?: ProContext };

export const CurrentPro = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<ProRequest>().pro);

/**
 * Garde de l'espace professionnels (/pro/*) : anti-CSRF, session par cookie httpOnly opaque
 * (30 jours glissants) vérifiée en base. Toute route est protégée sauf @ProPublic().
 */
@Injectable()
export class ProGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectM('ProSession') private readonly sessions: Model<any>,
    @InjectM('Professional') private readonly pros: Model<any>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ProRequest>();
    if (!(req.path.startsWith('/pro/') || req.path === '/pro')) return true;

    if (!SAFE.has(req.method) && req.headers[PRO_CSRF.name] !== PRO_CSRF.value) {
      throw new ForbiddenException('Requête refusée (protection CSRF)');
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(PRO_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const token = req.cookies?.[config.proSession.cookieName];

    if (typeof token === 'string' && token.length >= 20) {
      const now = new Date();
      const session = await this.sessions.findOne({ tokenHash: sha256(token), revokedAt: null, expiresAt: { $gt: now } });
      if (session) {
        const p = await this.pros.findById(session.professionalId).lean<any>();
        if (p && p.verificationStatus !== 'suspended') {
          req.pro = {
            id: String(p._id), email: p.email, trade: p.trade, verificationStatus: p.verificationStatus,
            name: p.businessName || [p.firstName, p.lastName].filter(Boolean).join(' '), sessionId: String(session._id),
          };
          if (now.getTime() - session.lastSeenAt.getTime() > 3600_000) {
            await this.sessions.updateOne({ _id: session._id }, { lastSeenAt: now, expiresAt: new Date(now.getTime() + config.proSession.days * 86_400_000) });
          }
        } else if (p?.verificationStatus === 'suspended' && !isPublic) {
          throw new ForbiddenException('Votre compte professionnel est suspendu. Contactez le support.');
        }
      }
    }
    if (isPublic) return true;
    if (!req.pro) throw new UnauthorizedException('Connexion requise');
    return true;
  }
}
