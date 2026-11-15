import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { InjectM } from '../database.module';
import { AD_PLACEMENTS } from '../models';
import { escapeRegex, oid, oneOf, paginate } from './http';
import { randomToken } from './crypto';
import { NotificationsService } from './notifications.service';

/** Acheteur d'une commande : un client (espace client) ou un professionnel (espace pro). */
export interface Buyer { type: 'client' | 'professional'; id: string }

export interface OrderInput {
  items: { productId: string; quantity: number }[];
  delivery: { address: string; commune: string; phone: string; note?: string };
  paymentMethod: 'cash_on_delivery' | 'mobile_money';
}

export const PRODUCT_PUBLIC = 'name reference categoryId description images price promoPrice brand compatibility specs stock warranty createdAt';

/**
 * Boutique (marketplace) commune aux espaces client et professionnel : catalogue, publicités et commandes.
 * Les prix sont toujours relus en base et le stock est décrémenté de façon atomique.
 */
@Injectable()
export class ShopService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectM('ProductCategory') private readonly categories: Model<any>,
    @InjectM('Product') private readonly products: Model<any>,
    @InjectM('Order') private readonly orders: Model<any>,
    @InjectM('Advertisement') private readonly ads: Model<any>,
    private readonly notify: NotificationsService,
  ) {}

  /* ---------- Catalogue ---------- */

  productCategories() {
    return this.categories.find({ active: true }).sort({ name: 1 }).select('name slug imageUrl').lean();
  }

  async listProducts(q: Record<string, unknown>) {
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

  async product(id: string) {
    const p = await this.products.findOne({ _id: oid(id), status: 'published' }).select(PRODUCT_PUBLIC).populate('categoryId', 'name slug').lean();
    if (!p) throw new NotFoundException('Produit introuvable');
    return p;
  }

  listAds(q: Record<string, unknown>) {
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

  async trackAd(id: string, event: string) {
    if (event !== 'impression' && event !== 'click') throw new NotFoundException();
    await this.ads.updateOne({ _id: oid(id), status: 'active' }, { $inc: { [`stats.${event === 'click' ? 'clicks' : 'impressions'}`]: 1 } });
  }

  /* ---------- Commandes ---------- */

  private owner(b: Buyer) {
    return b.type === 'client' ? { clientId: oid(b.id) } : { professionalId: oid(b.id) };
  }

  /** Lien « Mes commandes » propre à chaque espace. */
  private ordersLink(b: Buyer) {
    return b.type === 'client' ? '/compte/commandes' : '/commandes';
  }

  async createOrder(b: Buyer, dto: OrderInput) {
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
          ...this.owner(b), buyerType: b.type, items, total, paymentMethod: dto.paymentMethod, paymentStatus: 'pending', status: 'pending',
          delivery: dto.delivery, history: [{ status: 'pending', at: now, by: b.type }],
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    await this.notify.notify({ recipientType: b.type, recipientId: b.id, type: 'order.created', title: 'Commande enregistrée', body: `${order.number} – ${order.total} FCFA`, link: this.ordersLink(b) },
      { actorType: b.type, actorId: b.id, refType: 'order', refId: String(order._id), amount: order.total });
    return order.toObject();
  }

  myOrders(b: Buyer, q: Record<string, unknown>) {
    return paginate(this.orders, this.owner(b), q);
  }

  private async mine(b: Buyer, id: string) {
    const order = await this.orders.findOne({ _id: oid(id), ...this.owner(b) });
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }

  async cancelOrder(b: Buyer, id: string) {
    const order = await this.mine(b, id);
    if (order.status !== 'pending') throw new BadRequestException('Commande déjà en préparation : contactez le support');
    order.status = 'cancelled';
    order.history.push({ status: 'cancelled', at: new Date(), by: b.type });
    await order.save();
    await Promise.all(order.items.map((it: any) => this.products.updateOne({ _id: it.productId }, { $inc: { stock: it.quantity } })));
    return { ok: true };
  }

  /** L'acheteur confirme avoir réellement reçu sa commande (après expédition). */
  async confirmReceived(b: Buyer, id: string) {
    const order = await this.mine(b, id);
    if (order.receivedAt) return { ok: true };
    if (!['shipped', 'delivered'].includes(order.status)) throw new BadRequestException('La commande n’a pas encore été expédiée');
    const now = new Date();
    order.receivedAt = now;
    order.deliveryIssue = undefined;
    if (order.status !== 'delivered') order.status = 'delivered';
    order.history.push({ status: 'delivered', at: now, by: b.type, note: b.type === 'client' ? 'Réception confirmée par le client' : 'Réception confirmée par le professionnel' });
    await order.save();
    await this.notify.emit('order.received', `${order.number} – ${order.total} FCFA`, 1, { actorType: b.type, actorId: b.id, refType: 'order', refId: String(order._id) });
    return { ok: true };
  }

  /** L'acheteur signale qu'il n'a pas reçu sa commande (ou qu'elle est incomplète). */
  async reportNotReceived(b: Buyer, id: string, reason: string) {
    const order = await this.mine(b, id);
    if (order.receivedAt) throw new BadRequestException('Vous avez déjà confirmé la réception de cette commande');
    if (!['shipped', 'delivered'].includes(order.status)) throw new BadRequestException('La commande n’a pas encore été expédiée');
    const now = new Date();
    const text = reason.trim();
    order.deliveryIssue = { reason: text, at: now };
    order.history.push({ status: order.status, at: now, by: b.type, note: `Problème signalé : ${text}` });
    await order.save();
    await this.notify.emit('order.issue', `${order.number} – ${text}`, 1, { actorType: b.type, actorId: b.id, refType: 'order', refId: String(order._id) });
    return { ok: true };
  }
}
