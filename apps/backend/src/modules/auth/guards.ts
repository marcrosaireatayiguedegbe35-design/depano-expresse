import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Model } from 'mongoose';
import { config } from '../../config';
import { InjectM } from '../../database.module';
import { sha256 } from '../../common/crypto';
import { permissionsOf, Permission } from '../../common/permissions';
import {
  AdminRequest, ALLOW_PENDING_PASSWORD_KEY, PERMS_KEY, PUBLIC_KEY,
} from '../../common/http';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Garde globale du back-office :
 * 1. anti-CSRF (en-tête personnalisé obligatoire sur les requêtes modifiantes) ;
 * 2. session admin valide (cookie httpOnly opaque, vérifié en base à chaque requête,
 *    expiration d'inactivité + expiration absolue, révocable instantanément) ;
 * 3. permissions déclarées sur la route — refus par défaut si rien n'est déclaré.
 *
 * Les comptes clients et professionnels n'existent pas dans la collection
 * `administrators` : aucun jeton de ces espaces ne peut ouvrir une session ici.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectM('AdminSession') private readonly sessions: Model<any>,
    @InjectM('Administrator') private readonly admins: Model<any>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const targets = [ctx.getHandler(), ctx.getClass()];
    // Les routes de l'espace client sont contrôlées par ClientGuard.
    if (/^\/(client|pro)(\/|$)/.test(req.path)) return true;

    if (!SAFE_METHODS.has(req.method) && req.headers[config.csrfHeader.name] !== config.csrfHeader.value) {
      throw new ForbiddenException('Requête refusée (protection CSRF)');
    }

    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const token = req.cookies?.[config.session.cookieName];
    if (typeof token !== 'string' || token.length < 20) throw new UnauthorizedException('Session requise');

    const now = new Date();
    const session = await this.sessions.findOne({ tokenHash: sha256(token), purpose: 'session', revokedAt: null });
    const idleLimit = new Date(now.getTime() - config.session.idleMinutes * 60_000);
    if (!session || session.expiresAt <= now || session.lastSeenAt < idleLimit) {
      throw new UnauthorizedException('Session expirée');
    }

    const admin = await this.admins.findById(session.adminId).lean<any>();
    if (!admin || admin.status !== 'active') throw new UnauthorizedException('Compte inactif');

    // Mise à jour de l'activité au plus une fois par minute.
    if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
      await this.sessions.updateOne({ _id: session._id }, { lastSeenAt: now });
    }

    req.admin = {
      id: String(admin._id),
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: permissionsOf(admin.role),
      sessionId: String(session._id),
      mustChangePassword: !!admin.mustChangePassword,
    };

    if (admin.mustChangePassword && !this.reflector.get<boolean>(ALLOW_PENDING_PASSWORD_KEY, ctx.getHandler())) {
      throw new ForbiddenException({ message: 'Changement de mot de passe obligatoire', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMS_KEY, targets);
    if (required === undefined) throw new ForbiddenException('Route non autorisée');
    const missing = required.filter((p) => !req.admin!.permissions.includes(p));
    if (missing.length) throw new ForbiddenException(`Permission manquante : ${missing.join(', ')}`);
    return true;
  }
}
