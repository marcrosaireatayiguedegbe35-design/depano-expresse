import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { AdminContext, Audit, CurrentAdmin, oid, oneOf, paginate, Perm, searchFilter, tradeKey } from '../../common/http';
import { VERIFICATION_STATUSES } from '../../models';
import { NotificationsService } from '../../common/notifications.service';

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
  ) {}

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
    return { professional: pro, documents, interventions, finance: finance[0] ?? { billed: 0, commission: 0, net: 0, count: 0 }, reviews };
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
  async reviewDocument(@Param('id') id: string, @Param('docId') docId: string, @Body() dto: DocumentStatusDto) {
    const r = await this.docs.updateOne({ _id: oid(docId), professionalId: oid(id) }, { status: dto.status });
    if (!r.matchedCount) throw new NotFoundException('Document introuvable');
    return { ok: true };
  }
}
