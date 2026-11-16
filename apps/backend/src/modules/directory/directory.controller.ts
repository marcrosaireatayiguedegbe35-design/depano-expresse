import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsEmail, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Length, Min, ValidateNested,
} from 'class-validator';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { Audit, oid, oneOf, paginate, Perm, searchFilter } from '../../common/http';
import { PushService } from '../../common/push.service';
import { AD_KINDS, AD_PLACEMENTS, AD_STATUSES } from '../../models';

const URL_OPTS = { protocols: ['https', 'http'], require_protocol: true };

class SocialsDto {
  @IsOptional() @IsUrl(URL_OPTS) facebook?: string;
  @IsOptional() @IsUrl(URL_OPTS) instagram?: string;
  @IsOptional() @IsUrl(URL_OPTS) linkedin?: string;
  @IsOptional() @IsUrl(URL_OPTS) tiktok?: string;
}

class CompanyDto {
  @IsString() @Length(2, 150) name: string;
  @IsOptional() @IsUrl(URL_OPTS) logoUrl?: string;
  @IsOptional() @IsUrl(URL_OPTS) bannerUrl?: string;
  @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @IsOptional() @IsString() @Length(0, 150) activity?: string;
  @IsOptional() @IsString() @Length(0, 300) address?: string;
  @IsOptional() @IsString() @Length(0, 30) phone?: string;
  @IsOptional() @IsString() @Length(0, 30) whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(0, 300) hours?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUrl(URL_OPTS, { each: true }) gallery?: string[];
  @IsOptional() @IsUrl(URL_OPTS) website?: string;
  @IsOptional() @ValidateNested() @Type(() => SocialsDto) socials?: SocialsDto;
  @IsIn(['pending', 'validated', 'rejected']) status: string;
}

class CampaignDto {
  @IsOptional() @IsString() @Length(0, 150) name?: string;
  @IsOptional() @IsInt() @Min(0) budget?: number;
  @IsOptional() @IsInt() @Min(0) price?: number;
}

class AdDto {
  @IsString() @Length(2, 150) title: string;
  @IsOptional() @IsString() @Length(0, 3000) description?: string;
  @IsOptional() @IsUrl(URL_OPTS) imageUrl?: string;
  @IsOptional() @IsMongoId() companyId?: string;
  @IsIn(AD_KINDS) kind: string;
  @IsArray() @ArrayMaxSize(6) @IsIn(AD_PLACEMENTS, { each: true }) placements: string[];
  @IsDateString() startAt: string;
  @IsDateString() endAt: string;
  @IsOptional() @IsUrl(URL_OPTS) link?: string;
  @IsOptional() @IsUrl(URL_OPTS) website?: string;
  @IsString() @Length(3, 40) sponsoredLabel: string;
  @IsOptional() @ValidateNested() @Type(() => CampaignDto) campaign?: CampaignDto;
  @IsIn(AD_STATUSES) status: string;
}

/** Annuaire des entreprises (CDC §14) et publicités / publications (CDC §15). */
@Controller()
export class DirectoryController {
  constructor(
    @InjectM('Company') private readonly companies: Model<any>,
    @InjectM('Advertisement') private readonly ads: Model<any>,
    private readonly push: PushService,
  ) {}

  /* ---------- Entreprises ---------- */

  @Get('companies')
  @Perm('companies.read')
  listCompanies(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = searchFilter(q.q, ['name', 'activity', 'address']);
    const status = oneOf(q.status, ['pending', 'validated', 'rejected'] as const);
    if (status) filter.status = status;
    return paginate(this.companies, filter, q);
  }

  @Get('companies/:id')
  @Perm('companies.read')
  async getCompany(@Param('id') id: string) {
    const c = await this.companies.findById(oid(id)).lean();
    if (!c) throw new NotFoundException('Entreprise introuvable');
    return c;
  }

  @Post('companies')
  @Perm('companies.write')
  @Audit('companies.create')
  createCompany(@Body() dto: CompanyDto) {
    return this.companies.create(dto);
  }

  @Patch('companies/:id')
  @Perm('companies.write')
  @Audit('companies.update')
  async updateCompany(@Param('id') id: string, @Body() dto: CompanyDto) {
    const r = await this.companies.findByIdAndUpdate(oid(id), dto, { new: true }).lean();
    if (!r) throw new NotFoundException('Entreprise introuvable');
    return r;
  }

  /* ---------- Publicités ---------- */

  @Get('advertisements')
  @Perm('ads.read')
  listAds(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = searchFilter(q.q, ['title', 'campaign.name']);
    const status = oneOf(q.status, AD_STATUSES);
    const placement = oneOf(q.placement, AD_PLACEMENTS);
    if (status) filter.status = status;
    if (placement) filter.placements = placement;
    return paginate(this.ads, filter, q, { populate: { path: 'companyId', select: 'name' } });
  }

  @Get('advertisements/:id')
  @Perm('ads.read')
  async getAd(@Param('id') id: string) {
    const a = await this.ads.findById(oid(id)).populate('companyId', 'name website').lean();
    if (!a) throw new NotFoundException('Publication introuvable');
    return a;
  }

  @Post('advertisements')
  @Perm('ads.write')
  @Audit('ads.create')
  async createAd(@Body() dto: AdDto) {
    const a = await this.ads.create(this.adDoc(dto));
    void this.announce(a.toObject());
    return a;
  }

  @Patch('advertisements/:id')
  @Perm('ads.write')
  @Audit('ads.update')
  async updateAd(@Param('id') id: string, @Body() dto: AdDto) {
    const r = await this.ads.findByIdAndUpdate(oid(id), this.adDoc(dto), { new: true }).lean();
    if (!r) throw new NotFoundException('Publication introuvable');
    void this.announce(r);
    return r;
  }

  @Delete('advertisements/:id')
  @Perm('ads.write')
  @Audit('ads.delete')
  async deleteAd(@Param('id') id: string) {
    const r = await this.ads.deleteOne({ _id: oid(id) });
    if (!r.deletedCount) throw new NotFoundException('Publication introuvable');
    return { ok: true };
  }

  /**
   * Publication en ligne : prévient une seule fois les téléphones abonnés.
   * « Espace professionnels » ou « Accueil » → professionnels ; « Accueil » → clients.
   */
  private async announce(a: any) {
    const now = new Date();
    if (a.status !== 'active' || a.notifiedAt || new Date(a.startAt) > now || new Date(a.endAt) < now) return;
    const claimed = await this.ads.updateOne({ _id: a._id, notifiedAt: null }, { $set: { notifiedAt: now } });
    if (!claimed.modifiedCount) return;
    const body = (a.description || '').slice(0, 140);
    const tag = `ad-${a._id}`;
    const places: string[] = a.placements ?? [];
    if (places.includes('pro') || places.includes('home')) await this.push.broadcast('professional', { title: a.title, body, link: '/', tag });
    if (places.includes('home')) await this.push.broadcast('client', { title: a.title, body, link: `/actualite?id=${a._id}`, tag });
  }

  private adDoc(dto: AdDto) {
    if (new Date(dto.endAt) <= new Date(dto.startAt)) throw new BadRequestException('La date de fin doit suivre la date de début');
    return { ...dto, companyId: dto.companyId ? oid(dto.companyId) : undefined, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt) };
  }
}
