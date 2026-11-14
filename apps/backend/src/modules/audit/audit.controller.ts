import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Audit, Perm, toCsv } from '../../common/http';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Perm('audit.read')
  list(@Query() q: Record<string, unknown>) {
    return this.audit.list(q);
  }

  @Get('export')
  @Perm('audit.read')
  @Audit('audit.export')
  async export(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const rows = await this.audit.listAll(q);
    const csv = toCsv(
      rows.map((r: any) => ({ ...r, result: r.result === 'success' ? 'Succès' : 'Échec', details: r.details ? JSON.stringify(r.details) : '' })),
      [
        { key: 'seq', label: 'N°' }, { key: 'at', label: 'Date et heure' }, { key: 'adminEmail', label: 'Administrateur' },
        { key: 'action', label: 'Action' }, { key: 'targetType', label: 'Objet' }, { key: 'targetId', label: 'ID objet' },
        { key: 'result', label: 'Résultat' }, { key: 'ip', label: 'Adresse IP' }, { key: 'details', label: 'Détails' }, { key: 'hmac', label: 'Sceau' },
      ],
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="journal-activite-admin-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get('verify')
  @Perm('audit.read')
  verify() {
    return this.audit.verify();
  }
}
