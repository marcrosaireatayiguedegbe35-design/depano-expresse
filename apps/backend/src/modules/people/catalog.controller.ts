import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { SITE_IMAGE_KEYS, SITE_IMAGE_SLOTS } from '../../common/site-images';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUrl, Length, Matches, ValidateIf, ValidateNested } from 'class-validator';

/** URL https d'image (Cloudinary) ; chaîne vide = retirer l'image. */
const IMG = () => (t: object, k: string) => { IsOptional()(t, k); ValidateIf((_o, v) => v !== '')(t, k); IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Image invalide' })(t, k); };
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { AuthOnly, Audit, Perm, tradeKey } from '../../common/http';

class ProblemDto {
  @IsString() @Matches(/^[a-z0-9_]{2,50}$/) key: string;
  @IsString() @Length(2, 120) label: string;
  @IMG() imageUrl?: string;
  @IsBoolean() active: boolean;
}

class CategoryDto {
  @IsString() @Length(2, 80) name: string;
  @IsOptional() @IsString() @Length(1, 8) icon?: string;
  @IMG() imageUrl?: string;
  @IsOptional() @IsString() @Length(0, 200) description?: string;
  @IsBoolean() active: boolean;
  @IsOptional() @IsInt() order?: number;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ProblemDto) problems: ProblemDto[];
}

class CreateCategoryDto extends CategoryDto {
  @IsString() @Matches(/^[a-z0-9_]{2,40}$/, { message: 'Identifiant : lettres minuscules, chiffres et « _ » (2 à 40)' }) trade: string;
}

/**
 * Services (métiers) et problèmes proposés aux clients (CDC §5.1).
 * L'administration peut créer de nouveaux services à tout moment ; un service n'est jamais
 * supprimé (des professionnels et interventions y sont rattachés) : il est désactivé.
 */
@Controller()
export class CatalogController {
  constructor(
    @InjectM('ServiceCategory') private readonly categories: Model<any>,
    @InjectM('SystemSetting') private readonly settings: Model<any>,
  ) {}

  /* ---------- Visuels du site client ---------- */

  @Get('site-images')
  @AuthOnly()
  async siteImages() {
    const s = await this.settings.findOne({ key: 'siteImages' }).lean<any>();
    return { slots: SITE_IMAGE_SLOTS, values: s?.value ?? {} };
  }

  @Put('site-images')
  @Perm('catalog.write')
  @Audit('catalog.site_images_update')
  async setSiteImages(@Body() body: { values?: Record<string, unknown> }) {
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(body?.values ?? {})) {
      if (!SITE_IMAGE_KEYS.has(k)) throw new BadRequestException(`Emplacement inconnu : ${k}`);
      if (v === '' || v === null || v === undefined) continue;
      if (typeof v !== 'string' || !/^https:\/\/[^\s]{5,500}$/.test(v)) throw new BadRequestException('Image invalide');
      values[k] = v;
    }
    await this.settings.updateOne({ key: 'siteImages' }, { $set: { value: values } }, { upsert: true });
    return { slots: SITE_IMAGE_SLOTS, values };
  }

  /* ---------- Services ---------- */

  @Get('service-categories')
  @AuthOnly()
  list() {
    return this.categories.find().sort({ order: 1, name: 1 }).lean();
  }

  @Post('service-categories')
  @Perm('catalog.write')
  @Audit('catalog.create')
  async create(@Body() dto: CreateCategoryDto) {
    if (await this.categories.exists({ trade: dto.trade })) throw new ConflictException('Un service avec cet identifiant existe déjà');
    const order = dto.order ?? (await this.categories.countDocuments());
    return this.categories.create({ ...dto, order });
  }

  @Put('service-categories/:trade')
  @Perm('catalog.write')
  @Audit('catalog.update')
  async update(@Param('trade') trade: string, @Body() dto: CategoryDto) {
    const t = tradeKey(trade);
    if (!t) throw new NotFoundException('Service inconnu');
    const r = await this.categories.findOneAndUpdate({ trade: t }, dto, { new: true }).lean();
    if (!r) throw new NotFoundException('Service inconnu');
    return r;
  }
}
