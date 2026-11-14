import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { AdminContext, Audit, CurrentAdmin, oid, oneOf, paginate, Perm } from '../../common/http';

class ResolveReportDto {
  @IsIn(['resolved', 'dismissed']) status: string;
  @IsString() @Length(3, 1000) note: string;
}

class ReviewVisibilityDto {
  @IsBoolean() hidden: boolean;
  @IsOptional() @IsString() @Length(3, 500) reason?: string;
}

@Controller()
export class ModerationController {
  constructor(
    @InjectM('Report') private readonly reports: Model<any>,
    @InjectM('Review') private readonly reviews: Model<any>,
    @InjectM('Professional') private readonly pros: Model<any>,
  ) {}

  @Get('reports')
  @Perm('moderation.read')
  listReports(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    const status = oneOf(q.status, ['open', 'resolved', 'dismissed'] as const);
    const targetType = oneOf(q.targetType, ['user', 'professional', 'message', 'review'] as const);
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;
    return paginate(this.reports, filter, q);
  }

  @Post('reports/:id/resolve')
  @Perm('moderation.write')
  @Audit('moderation.report_resolve')
  async resolve(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    const r = await this.reports.updateOne(
      { _id: oid(id), status: 'open' },
      { status: dto.status, resolution: { note: dto.note, by: me.id, byEmail: me.email, at: new Date() } },
    );
    if (!r.matchedCount) throw new NotFoundException('Signalement introuvable ou déjà traité');
    return { ok: true };
  }

  /** Avis : chaque avis est lié à une intervention réelle (index unique, règle 29). */
  @Get('reviews')
  @Perm('moderation.read')
  listReviews(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = {};
    if (q.hidden === 'true') filter.hidden = true;
    if (q.hidden === 'false') filter.hidden = false;
    return paginate(this.reviews, filter, q, {
      populate: [
        { path: 'professionalId', select: 'firstName lastName businessName' },
        { path: 'clientId', select: 'firstName lastName' },
        { path: 'interventionId', select: 'reference' },
      ],
    });
  }

  @Post('reviews/:id/visibility')
  @Perm('moderation.write')
  @Audit('moderation.review_visibility')
  async setVisibility(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: ReviewVisibilityDto) {
    const review = await this.reviews.findByIdAndUpdate(
      oid(id),
      { hidden: dto.hidden, moderation: { reason: dto.reason, by: me.id, at: new Date() } },
      { new: true },
    );
    if (!review) throw new NotFoundException('Avis introuvable');
    // Recalcule la note moyenne du professionnel sur les avis visibles.
    const [agg] = await this.reviews.aggregate([
      { $match: { professionalId: review.professionalId, hidden: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]);
    await this.pros.updateOne({ _id: review.professionalId }, { rating: Math.round((agg?.avg ?? 0) * 10) / 10, reviewsCount: agg?.n ?? 0 });
    return { ok: true };
  }
}
