import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, AdminRequest, PUBLIC_KEY } from '../../common/http';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Journalise automatiquement toute action modifiante d'un administrateur. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const explicit = this.reflector.get<string>(AUDIT_KEY, ctx.getHandler());
    // Toute action modifiante est journalisée, ainsi que les lectures sensibles marquées @Audit (exports).
    if ((!MUTATING.has(req.method) && !explicit) || isPublic || !req.admin) return next.handle();

    const action = explicit ?? `${req.method} ${req.route?.path ?? req.path}`;
    const base = {
      adminId: req.admin.id,
      adminEmail: req.admin.email,
      action,
      targetType: ctx.getClass().name.replace(/Controller$/, ''),
      targetId: typeof req.params?.id === 'string' ? req.params.id : undefined,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
    };
    const details = MUTATING.has(req.method) ? { body: req.body, params: req.params } : { query: req.query };

    return next.handle().pipe(
      tap({
        next: () => void this.audit.log({ ...base, result: 'success', details }),
        error: (err) => void this.audit.log({ ...base, result: 'failure', details: { ...details, error: err?.message } }),
      }),
    );
  }
}
