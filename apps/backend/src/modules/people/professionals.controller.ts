import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, Length, ValidateIf } from 'class-validator';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { AdminContext, Audit, CurrentAdmin, oid, oneOf, paginate, Perm, searchFilter, tradeKey } from '../../common/http';
import { VERIFICATION_STATUSES } from '../../models';
import { NotificationsService } from '../../common/notifications.service';
import { ProContractService } from '../../common/pro-contract.service';
import { docType } from '../../common/pro-requirements';
import { IsUploadUrl } from '../../common/upload-url';

type VStatus = (typeof VERIFICATION_STATUSES)[number];

/** Transitions autorisées du statut de vérification (CDC §11.2). */
const TRANSITIONS: Record<VStatus, VStatus[]> = {
  pending: ['in_review', 'validated', 'rejected'],
  in_review: ['validated', 'rejected', 'pending'],
  validated: ['suspended'],
  rejected: ['in_review'],
  suspended: ['validated', 'rejected'],
};

class VerificationDto {
  @IsIn(VERIFICATION_STATUSES) status: VStatus;
  @IsOptional() @IsString() @Length(3, 1000) reason?: string;
}

class DocumentStatusDto {
  @IsIn(['pending', 'accepted', 'rejected']) status: string;
  /** Motif obligatoire en cas de refus : il est envoyé au professionnel. */
  @ValidateIf((o) => o.status === 'rejected') @IsString() @Length(3, 500) reason?: string;
}

class CompanyDto {
  @IsString() @Length(2, 120) name: string;
  @IsOptional() @IsString() @Length(0, 80) legalForm?: string;
  @IsOptional() @IsString() @Length(0, 60) rccm?: string;
  @IsOptional() @IsString() @Length(0, 30) ifu?: string;
  @IsOptional() @IsString() @Length(0, 200) address?: string;
  @IsOptional() @IsString() @Length(0, 80) city?: string;
  @IsOptional() @IsString() @Length(0, 120) representative?: string;
  @IsOptional() @IsString() @Length(0, 80) representativeTitle?: string;
  @IsOptional() @IsString() @Length(0, 30) phone?: string;
  @IsOptional() @ValidateIf((o) => !!o.email) @IsEmail() email?: string;
  @IsOptional() @ValidateIf((o) => !!o.stampUrl) @IsUploadUrl() stampUrl?: string;
}


@Controller('professionals')
export class ProfessionalsController {
  constructor(
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('ProfessionalDocument') private readonly docs: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('Review') private readonly reviews: Model<any>,
    private readonly notify: NotificationsService,
    private readonly contracts: ProContractService,
  ) {}

  /* ---------- Identité légale de la plateforme (en-tête du contrat des professionnels) ---------- */

  @Get('contract-settings')
  @Perm('pros.read')
  async contractSettings() {
    return { company: await this.contracts.company() };
  }

  @Put('contract-settings')
  @Perm('settings.commission.write')
  @Audit('settings.contract_company')
  saveContractSettings(@CurrentAdmin() me: AdminContext, @Body() dto: CompanyDto) {
    return this.contracts.setCompany(dto, me.id).then((company) => ({ company }));
  }

  @Get()
  @Perm('pros.read')
  list(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = searchFilter(q.q, ['firstName', 'lastName', 'businessName', 'phone', 'email', 'commune']);
    const status = oneOf(q.status, VERIFICATION_STATUSES);
    const trade = tradeKey(q.trade);
    if (status) filter.verificationStatus = status;
    if (trade) filter.trade = trade;
    return paginate(this.pros, filter, q, { select: '-verificationHistory -payoutAccount' });
  }

  /** Export de la liste (PDF côté back-office) : tous les professionnels filtrés, avec coordonnées et position. */
  @Get('export')
  @Perm('pros.read')
  @Audit('pros.export')
  async export(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = { deletedAt: null };
    const status = oneOf(q.status, VERIFICATION_STATUSES);
    const trade = tradeKey(q.trade);
    const availability = oneOf(q.availability, ['available', 'busy', 'unavailable'] as const);
    if (status) filter.verificationStatus = status;
    if (trade) filter.trade = trade;
    if (availability) filter.availability = availability;
    const items = await this.pros.find(filter).sort({ trade: 1, commune: 1, lastName: 1 }).limit(2000)
      .select('firstName lastName businessName phone email trade commune quartier address location area zoneRadiusKm hours availability verificationStatus rating reviewsCount services createdAt').lean();
    return { generatedAt: new Date(), total: items.length, items };
  }

  @Get(':id')
  @Perm('pros.read')
  async get(@Param('id') id: string) {
    const _id = oid(id);
    const pro = await this.pros.findById(_id).lean();
    if (!pro) throw new NotFoundException('Professionnel introuvable');
    const [documents, interventions, finance, reviews] = await Promise.all([
      this.docs.find({ professionalId: _id }).lean(),
      this.interventions.find({ professionalId: _id }).sort({ createdAt: -1 }).limit(20).lean(),
      this.commissions.aggregate([
        { $match: { professionalId: _id } },
        { $group: { _id: null, billed: { $sum: '$paymentAmount' }, commission: { $sum: '$amount' }, net: { $sum: '$professionalNet' }, count: { $sum: 1 } } },
      ]),
      this.reviews.find({ professionalId: _id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const [list, contract] = await Promise.all([this.contracts.checklistFor(_id), this.contracts.signedDetail(id)]);
    return { professional: pro, documents, interventions, finance: finance[0] ?? { billed: 0, commission: 0, net: 0, count: 0 }, reviews, checklist: list, contract };
  }

  @Get(':id/contract/pdf')
  @Perm('pros.read')
  @Audit('pros.contract_download')
  async contractPdf(@Param('id') id: string, @Res() res: Response) {
    const { bytes, filename } = await this.contracts.pdf(String(oid(id)));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(Buffer.from(bytes));
  }

  @Post(':id/verification')
  @Perm('pros.verify')
  @Audit('pros.verification')
  async setVerification(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: VerificationDto) {
    const pro = await this.pros.findById(oid(id));
    if (!pro) throw new NotFoundException('Professionnel introuvable');
    const current = pro.verificationStatus as VStatus;
    if (!TRANSITIONS[current].includes(dto.status)) {
      throw new BadRequestException(`Transition impossible : ${current} → ${dto.status}`);
    }
    if ((dto.status === 'rejected' || dto.status === 'suspended') && !dto.reason) {
      throw new BadRequestException('Un motif est obligatoire pour refuser ou suspendre');
    }
    if (dto.status === 'validated') {
      const list = await this.contracts.checklistFor(pro._id);
      if (!list.complete) {
        throw new BadRequestException(`Validation impossible, éléments manquants ou non acceptés : ${list.missing.map((m) => m.label).join(', ')}.`);
      }
    }
    pro.verificationStatus = dto.status;
    // Un compte non validé ne doit plus recevoir de demandes (CDC §5.3).
    if (dto.status !== 'validated') pro.availability = 'unavailable';
    pro.verificationHistory.push({ status: dto.status, reason: dto.reason, by: me.id, byEmail: me.email, at: new Date() });
    await pro.save();
    const titles: Record<string, string> = {
      validated: 'Votre compte est validé : passez en « Disponible » pour recevoir des demandes',
      rejected: 'Vérification refusée', suspended: 'Compte suspendu', in_review: 'Documents en cours de vérification', pending: 'Documents à compléter',
    };
    await this.notify.notify({ recipientType: 'professional', recipientId: pro._id, type: `pro.${dto.status}`, title: titles[dto.status] ?? 'Statut du compte mis à jour', body: dto.reason, link: '/profil/documents' },
      { actorType: 'admin', actorId: me.id, refType: 'professional', refId: String(pro._id) });
    return { ok: true, status: pro.verificationStatus };
  }

  @Patch(':id/documents/:docId')
  @Perm('pros.verify')
  @Audit('pros.document_review')
  async reviewDocument(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Param('docId') docId: string, @Body() dto: DocumentStatusDto) {
    const d = await this.docs.findOneAndUpdate(
      { _id: oid(docId), professionalId: oid(id) },
      { status: dto.status, rejectReason: dto.status === 'rejected' ? dto.reason : null, reviewedAt: new Date() },
      { new: true },
    ).lean<any>();
    if (!d) throw new NotFoundException('Document introuvable');
    if (dto.status === 'rejected') {
      const label = docType(d.type)?.label ?? d.label;
      await this.notify.notify({ recipientType: 'professional', recipientId: d.professionalId, type: 'pro.document_rejected', title: `${label} refusé(e)`, body: `${dto.reason} Déposez un nouveau document dans « Documents ».`, link: '/profil/documents' },
        { actorType: 'admin', actorId: me.id, refType: 'professional', refId: id, silent: true });
    }
    return { ok: true };
  }
}
