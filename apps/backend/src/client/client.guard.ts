import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Model } from 'mongoose';
import type { Request } from 'express';
import { config } from '../config';
import { InjectM } from '../database.module';
import { sha256 } from '../common/crypto';

export const CLIENT_PUBLIC_KEY = 'client:public';
/** Route de l'espace client accessible sans connexion (catalogue, recherche…). */
export const ClientPublic = () => SetMetadata(CLIENT_PUBLIC_KEY, true);

export const CLIENT_CSRF = { name: 'x-requested-with', value: 'plateforme-client' };
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface ClientContext {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sessionId: string;
}

/** Attention : `req.client` est réservé par Node (socket) — le contexte est porté par `req.customer`. */
export type ClientRequest = Request & { customer?: ClientContext };

export const CurrentClient = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<ClientRequest>().customer;
});

/**
 * Garde de l'espace client (/client/*) :
 * - anti-CSRF sur les requêtes modifiantes ;
 * - session par cookie httpOnly opaque (30 jours glissants), vérifiée en base ;
 * - toute route est protégée sauf déclaration explicite @ClientPublic().
 * Sur une route publique, la session est tout de même lue si elle existe.
 */
@Injectable()
export class ClientGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectM('ClientSession') private readonly sessions: Model<any>,
    @InjectM('User') private readonly users: Model<any>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ClientRequest>();
    if (!(req.path.startsWith('/client/') || req.path === '/client')) return true;

    if (!SAFE.has(req.method) && req.headers[CLIENT_CSRF.name] !== CLIENT_CSRF.value) {
      throw new ForbiddenException('Requête refusée (protection CSRF)');
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(CLIENT_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const token = req.cookies?.[config.clientSession.cookieName];

    if (typeof token === 'string' && token.length >= 20) {
      const now = new Date();
      const session = await this.sessions.findOne({ tokenHash: sha256(token), revokedAt: null, expiresAt: { $gt: now } });
      if (session) {
        const user = await this.users.findById(session.userId).lean<any>();
        if (user && user.status === 'active') {
          req.customer = {
            id: String(user._id), email: user.email, firstName: user.firstName, lastName: user.lastName, sessionId: String(session._id),
          };
          // Session glissante : prolongée au plus une fois par heure.
          if (now.getTime() - session.lastSeenAt.getTime() > 3600_000) {
            await this.sessions.updateOne(
              { _id: session._id },
              { lastSeenAt: now, expiresAt: new Date(now.getTime() + config.clientSession.days * 86_400_000) },
            );
          }
        } else if (user?.status === 'suspended' && !isPublic) {
          throw new ForbiddenException('Votre compte est suspendu. Contactez le support.');
        }
      }
    }

    if (isPublic) return true;
    if (!req.customer) throw new UnauthorizedException('Connexion requise');
    return true;
  }
}
