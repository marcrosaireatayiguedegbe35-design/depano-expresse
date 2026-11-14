import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Connection, Model } from 'mongoose';
import { InjectM } from '../database.module';
import { escapeRegex, oid, oneOf, paginate } from '../common/http';
import { randomToken } from '../common/crypto';
import { NotificationsService } from '../common/notifications.service';
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
  ) {}

  /* ---------- Marketplace ---------- */

  @Get('product-categories')
  @ClientPublic()
  productCategories() {
    return this.categories.find({ active: true }).sort({ name: 1 }).select('name slug imageUrl').lean();
  }

  @Get('products')
  @ClientPublic()
  async listProducts(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = { status: 'published' };
    if (typeof q.q === 'string' && q.q.trim()) {
      const rx = new RegExp(escapeRegex(q.q.trim().slice(0, 100)), 'i');
      filter.$or = [{ name: rx }, { brand: rx }, { reference: rx }, { compatibility: rx }];
    }
    if (typeof q.category === 'string' && q.category) filter.categoryId = oid(q.category);
    if (typeof q.brand === 'string' && q.brand) filter.brand = q.brand.slice(0, 80);
    if (q.inStock === 'true') filter.stock = { $gt: 0 };
    if (q.promo === 'true') filter.promoPrice = { $gt: 0 };
    const sort = ({ price_asc: { price: 1 }, price_desc: { price: -1 }, newest: { createdAt: -1 }, name: { name: 1 } } as Record<string, any>)[String(q.sort)] ?? { createdAt: -1 };
    const [page, top] = await Promise.all([
      paginate<any>(this.products, filter, { ...q, limit: q.limit ?? 24 }, { sort, select: PRODUCT_PUBLIC, populate: { path: 'categoryId', select: 'name slug' } }),
      this.topSellers(),
    ]);
    // Badges réels : « Top vente » (3 produits les plus vendus) et « Nouveau » (publié il y a moins de 30 jours).
    const recent = Date.now() - 30 * 86_400_000;
    page.items = page.items.map((p: any) => ({ ...p, topSeller: top.has(String(p._id)), isNew: new Date(p.createdAt).getTime() > recent }));
    return page;
  }

  private async topSellers(): Promise<Set<string>> {
    const rows = await this.orders.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', sold: { $sum: '$items.quantity' } } },
      { $sort: { sold: -1 } },
      { $limit: 3 },
    ]);
    return new Set(rows.map((r) => String(r._id)));
  }

  @Get('products/:id')
  @ClientPublic()
  async product(@Param('id') id: string) {
    const p = await this.products.findOne({ _id: oid(id), status: 'published' }).select(PRODUCT_PUBLIC).populate('categoryId', 'name slug').lean();
    if (!p) throw new NotFoundException('Produit introuvable');
    return p;
  }

  /** Commande : prix relus en base, stock décrémenté de façon atomique. */
  @Post('orders')
  async createOrder(@CurrentClient() me: ClientContext, @Body() dto: OrderDto) {
    const merged = new Map<string, number>();
    for (const it of dto.items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);

    const session = await this.connection.startSession();
    let order: any;
    try {
      await session.withTransaction(async () => {
        const items: any[] = [];
        for (const [productId, quantity] of merged) {
          const p = await this.products.findOneAndUpdate(
            { _id: oid(productId), status: 'published', stock: { $gte: quantity } },
            { $inc: { stock: -quantity } },
            { new: true, session },
          );
          if (!p) {
            const exists = await this.products.findById(productId).select('name stock status').session(session).lean<any>();
            throw new BadRequestException(exists && exists.status === 'published' ? `Stock insuffisant pour « ${exists.name} » (${exists.stock} disponible(s))` : 'Un produit n’est plus disponible');
          }
          items.push({ productId: p._id, name: p.name, quantity, unitPrice: p.promoPrice ?? p.price });
        }
        const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        const now = new Date();
        [order] = await this.orders.create([{
          number: `CMD-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${randomToken(4).toUpperCase().replace(/[^A-Z0-9]/g, '7')}`,
          clientId: oid(me.id), items, total, paymentMethod: dto.paymentMethod, paymentStatus: 'pending', status: 'pending',
          delivery: dto.delivery, history: [{ status: 'pending', at: now, by: 'client' }],
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    await this.notify.notify({ recipientType: 'client', recipientId: me.id, type: 'order.created', title: 'Commande enregistrée', body: `${order.number} – ${order.total} FCFA`, link: `/compte/commandes` },
      { actorType: 'client', actorId: me.id, refType: 'order', refId: String(order._id), amount: order.total });
    return order.toObject();
  }

  @Get('orders')
  myOrders(@CurrentClient() me: ClientContext, @Query() q: Record<string, unknown>) {
    return paginate(this.orders, { clientId: oid(me.id) }, q);
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  async cancelOrder(@CurrentClient() me: ClientContext, @Param('id') id: string) {
    const order = await this.orders.findOne({ _id: oid(id), clientId: oid(me.id) });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.status !== 'pending') throw new BadRequestException('Commande déjà en préparation : contactez le support');
    order.status = 'cancelled';
    order.history.push({ status: 'cancelled', at: new Date(), by: 'client' });
    await order.save();
    await Promise.all(order.items.map((it: any) => this.products.updateOne({ _id: it.productId }, { $inc: { stock: it.quantity } })));
    return { ok: true };
  }

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
  listAds(@Query() q: Record<string, unknown>) {
    const now = new Date();
    const filter: Record<string, unknown> = { status: 'active', startAt: { $lte: now }, endAt: { $gte: now } };
    const placement = oneOf(q.placement, AD_PLACEMENTS);
    if (placement) filter.placements = placement;
    if (q.kind === 'news') filter.kind = { $in: ['news', 'event', 'announcement'] };
    return this.ads
      .find(filter)
      .sort({ startAt: -1 })
      .limit(Math.min(Number(q.limit) || 6, 20))
      .select('title description imageUrl kind link website sponsoredLabel companyId startAt endAt')
      .populate('companyId', 'name website')
      .lean();
  }

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
  async track(@Param('id') id: string, @Param('event') event: string) {
    if (event !== 'impression' && event !== 'click') throw new NotFoundException();
    await this.ads.updateOne({ _id: oid(id), status: 'active' }, { $inc: { [`stats.${event === 'click' ? 'clicks' : 'impressions'}`]: 1 } });
  }
}
