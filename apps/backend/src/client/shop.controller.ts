import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Connection, Model } from 'mongoose';
import { InjectM } from '../database.module';
import { escapeRegex, oid, oneOf, paginate } from '../common/http';
import { randomToken } from '../common/crypto';
import { NotificationsService } from '../common/notifications.service';
import { ShopService } from '../common/shop.service';
import { AD_PLACEMENTS } from '../models';
import { ClientContext, ClientPublic, CurrentClient } from './client.guard';

class OrderItemDto {
  @IsMongoId() productId: string;
  @IsInt() @Min(1) @Max(50) quantity: number;
}

class DeliveryDto {
  @IsString() @Length(3, 300) address: string;
  @IsString() @Length(2, 80) commune: string;
  @IsString() @Matches(/^\+229(01\d{8}|\d{8})$/, { message: 'Numéro au format +229 01XXXXXXXX' }) phone: string;
  @IsOptional() @IsString() @Length(0, 300) note?: string;
}

class CartDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
}

class OrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
  @ValidateNested() @Type(() => DeliveryDto) delivery: DeliveryDto;
  @IsIn(['cash_on_delivery', 'mobile_money']) paymentMethod: 'cash_on_delivery' | 'mobile_money';
}

class CompanyApplyDto {
  @IsString() @Length(2, 150) name: string;
  @IsString() @Length(2, 150) activity: string;
  @IsString() @Length(3, 300) address: string;
  @IsString() @Matches(/^\+229(01\d{8}|\d{8})$/, { message: 'Numéro au format +229 01XXXXXXXX' }) phone: string;
  @IsOptional() @IsString() @Length(0, 1000) description?: string;
  @IsOptional() @IsString() @Matches(/^https?:\/\/.+/, { message: 'Adresse du site invalide' }) website?: string;
}

const PRODUCT_PUBLIC = 'name reference categoryId description images price promoPrice brand compatibility specs stock warranty createdAt';

class DeliveryIssueDto {
  @IsString() @Length(3, 500) reason: string;
}

/** Marketplace, annuaire et publicités côté clients (CDC §13–15). */
@Controller()
export class ClientShopController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectM('ProductCategory') private readonly categories: Model<any>,
    @InjectM('Product') private readonly products: Model<any>,
    @InjectM('Order') private readonly orders: Model<any>,
    @InjectM('Company') private readonly companies: Model<any>,
    @InjectM('Advertisement') private readonly ads: Model<any>,
    private readonly notify: NotificationsService,
    private readonly shop: ShopService,
  ) {}

  /* ---------- Marketplace (service commun avec l'espace pro) ---------- */

  @Get('product-categories')
  @ClientPublic()
  productCategories() { return this.shop.productCategories(); }

  @Get('products')
  @ClientPublic()
  listProducts(@Query() q: Record<string, unknown>) { return this.shop.listProducts(q); }

  @Get('products/:id')
  @ClientPublic()
  product(@Param('id') id: string) { return this.shop.product(id); }

  /** Panier du compte : le même sur tous les appareils. */
  @Get('cart')
  getCart(@CurrentClient() me: ClientContext) { return this.shop.getCart({ type: 'client', id: me.id }); }

  @Put('cart')
  setCart(@CurrentClient() me: ClientContext, @Body() dto: CartDto) { return this.shop.setCart({ type: 'client', id: me.id }, dto.items); }

  /** Commande : prix relus en base, stock décrémenté de façon atomique. */
  @Post('orders')
  createOrder(@CurrentClient() me: ClientContext, @Body() dto: OrderDto) { return this.shop.createOrder({ type: 'client', id: me.id }, dto); }

  @Get('orders')
  myOrders(@CurrentClient() me: ClientContext, @Query() q: Record<string, unknown>) { return this.shop.myOrders({ type: 'client', id: me.id }, q); }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancelOrder(@CurrentClient() me: ClientContext, @Param('id') id: string) { return this.shop.cancelOrder({ type: 'client', id: me.id }, id); }

  /** Le client confirme avoir réellement reçu sa commande (après expédition). */
  @Post('orders/:id/received')
  @HttpCode(200)
  confirmReceived(@CurrentClient() me: ClientContext, @Param('id') id: string) { return this.shop.confirmReceived({ type: 'client', id: me.id }, id); }

  /** Le client signale qu'il n'a pas reçu sa commande (ou qu'elle est incomplète). */
  @Post('orders/:id/not-received')
  @HttpCode(200)
  reportNotReceived(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: DeliveryIssueDto) { return this.shop.reportNotReceived({ type: 'client', id: me.id }, id, dto.reason); }

  /* ---------- Annuaire ---------- */

  @Get('companies')
  @ClientPublic()
  listCompanies(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = { status: 'validated' };
    if (typeof q.q === 'string' && q.q.trim()) {
      const rx = new RegExp(escapeRegex(q.q.trim().slice(0, 100)), 'i');
      filter.$or = [{ name: rx }, { activity: rx }, { address: rx }];
    }
    return paginate(this.companies, filter, { ...q, limit: q.limit ?? 24 }, { sort: { name: 1 }, select: '-status' });
  }

  /** Demande d'inscription d'une entreprise (bannière « Vous êtes une entreprise ? ») : créée « en attente ». */
  @Post('companies/apply')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async applyCompany(@CurrentClient() me: ClientContext, @Body() dto: CompanyApplyDto) {
    const exists = await this.companies.exists({ name: new RegExp(`^${escapeRegex(dto.name.trim())}$`, 'i') });
    if (exists) throw new BadRequestException('Une entreprise portant ce nom est déjà inscrite');
    const c = await this.companies.create({ ...dto, status: 'pending' });
    await this.notify.emit('company.applied', `${dto.name} – ${dto.activity}`, 1, { actorType: 'client', actorId: me.id, refType: 'company', refId: String(c._id) });
    return { ok: true, message: 'Demande envoyée : notre équipe vérifie votre entreprise avant publication.' };
  }

  @Get('companies/:id')
  @ClientPublic()
  async company(@Param('id') id: string) {
    const c = await this.companies.findOne({ _id: oid(id), status: 'validated' }).select('-status').lean();
    if (!c) throw new NotFoundException('Entreprise introuvable');
    return c;
  }

  /* ---------- Publicités & actualités ---------- */

  @Get('ads')
  @ClientPublic()
  listAds(@Query() q: Record<string, unknown>) { return this.shop.listAds(q); }

  @Get('ads/:id')
  @ClientPublic()
  async ad(@Param('id') id: string) {
    const now = new Date();
    const a = await this.ads
      .findOne({ _id: oid(id), status: { $in: ['active', 'ended'] }, startAt: { $lte: now } })
      .select('title description imageUrl kind link website sponsoredLabel companyId startAt endAt stats.impressions status')
      .populate('companyId', 'name website phone address logoUrl')
      .lean();
    if (!a) throw new NotFoundException('Publication introuvable');
    return a;
  }

  @Post('ads/:id/:event')
  @ClientPublic()
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  track(@Param('id') id: string, @Param('event') event: string) { return this.shop.trackAd(id, event); }
}
