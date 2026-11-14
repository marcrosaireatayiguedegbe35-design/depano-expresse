import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUrl, Length, Matches, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { Model } from 'mongoose';
import { InjectM } from '../../database.module';
import { AdminContext, Audit, CurrentAdmin, oid, oneOf, paginate, Perm, searchFilter } from '../../common/http';
import { ORDER_STATUSES } from '../../models';

class CategoryDto {
  @IsString() @Length(2, 80) name: string;
  @IsString() @Matches(/^[a-z0-9-]{2,80}$/) slug: string;
  @IsOptional() @ValidateIf((_o, v) => v !== '') @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Image invalide' }) imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class SpecDto {
  @IsString() @Length(1, 80) name: string;
  @IsString() @Length(1, 200) value: string;
}

class ProductDto {
  @IsString() @Length(2, 200) name: string;
  @IsString() @Length(2, 60) reference: string;
  @IsMongoId({ message: 'Choisissez une catégorie' }) categoryId: string;
  @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUrl({ protocols: ['https', 'http'] }, { each: true }) images?: string[];
  @IsInt() @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) promoPrice?: number;
  @IsOptional() @IsString() @Length(0, 80) brand?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) compatibility?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => SpecDto) specs?: SpecDto[];
  @IsInt() @Min(0) stock: number;
  @IsOptional() @IsString() @Length(0, 200) warranty?: string;
  @IsIn(['draft', 'published', 'archived']) status: string;
}

class OrderStatusDto {
  @IsIn(ORDER_STATUSES) status: string;
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

const ORDER_FLOW: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Marketplace exclusivement automobile, publiée uniquement par l'administration (CDC §13). */
@Controller()
export class MarketplaceController {
  constructor(
    @InjectM('ProductCategory') private readonly categories: Model<any>,
    @InjectM('Product') private readonly products: Model<any>,
    @InjectM('Order') private readonly orders: Model<any>,
  ) {}

  /* ---------- Catégories ---------- */

  @Get('product-categories')
  @Perm('products.read')
  listCategories() {
    return this.categories.find().sort({ name: 1 }).lean();
  }

  @Post('product-categories')
  @Perm('products.write')
  @Audit('products.category_create')
  async createCategory(@Body() dto: CategoryDto) {
    if (await this.categories.exists({ slug: dto.slug })) throw new ConflictException('Ce slug existe déjà');
    return this.categories.create(dto);
  }

  @Patch('product-categories/:id')
  @Perm('products.write')
  @Audit('products.category_update')
  async updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) {
    const r = await this.categories.findByIdAndUpdate(oid(id), dto, { new: true }).lean();
    if (!r) throw new NotFoundException('Catégorie introuvable');
    return r;
  }

  /* ---------- Produits ---------- */

  @Get('products')
  @Perm('products.read')
  listProducts(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = searchFilter(q.q, ['name', 'reference', 'brand']);
    const status = oneOf(q.status, ['draft', 'published', 'archived'] as const);
    if (status) filter.status = status;
    if (typeof q.categoryId === 'string' && q.categoryId) filter.categoryId = oid(q.categoryId);
    if (q.lowStock === 'true') filter.stock = { $lte: 5 };
    return paginate(this.products, filter, q, { populate: { path: 'categoryId', select: 'name' } });
  }

  @Get('products/:id')
  @Perm('products.read')
  async getProduct(@Param('id') id: string) {
    const p = await this.products.findById(oid(id)).lean();
    if (!p) throw new NotFoundException('Produit introuvable');
    return p;
  }

  @Post('products')
  @Perm('products.write')
  @Audit('products.create')
  async createProduct(@Body() dto: ProductDto) {
    this.checkPromo(dto);
    if (await this.products.exists({ reference: dto.reference })) throw new ConflictException('Cette référence existe déjà');
    return this.products.create({ ...dto, categoryId: oid(dto.categoryId) });
  }

  @Patch('products/:id')
  @Perm('products.write')
  @Audit('products.update')
  async updateProduct(@Param('id') id: string, @Body() dto: ProductDto) {
    this.checkPromo(dto);
    const dup = await this.products.exists({ reference: dto.reference, _id: { $ne: oid(id) } });
    if (dup) throw new ConflictException('Cette référence existe déjà');
    const r = await this.products.findByIdAndUpdate(oid(id), { ...dto, categoryId: oid(dto.categoryId) }, { new: true }).lean();
    if (!r) throw new NotFoundException('Produit introuvable');
    return r;
  }

  @Delete('products/:id')
  @Perm('products.write')
  @Audit('products.delete')
  async deleteProduct(@Param('id') id: string) {
    const _id = oid(id);
    if (await this.orders.exists({ 'items.productId': _id })) {
      throw new ConflictException('Produit déjà commandé : archivez-le au lieu de le supprimer');
    }
    const r = await this.products.deleteOne({ _id });
    if (!r.deletedCount) throw new NotFoundException('Produit introuvable');
    return { ok: true };
  }

  private checkPromo(dto: ProductDto) {
    if (dto.promoPrice !== undefined && dto.promoPrice >= dto.price) {
      throw new BadRequestException('Le prix promotionnel doit être inférieur au prix');
    }
  }

  /* ---------- Commandes ---------- */

  @Get('orders')
  @Perm('orders.read')
  listOrders(@Query() q: Record<string, unknown>) {
    const filter: Record<string, unknown> = searchFilter(q.q, ['number', 'delivery.phone']);
    const status = oneOf(q.status, ORDER_STATUSES);
    if (status) filter.status = status;
    return paginate(this.orders, filter, q, { populate: { path: 'clientId', select: 'firstName lastName phone' } });
  }

  @Get('orders/:id')
  @Perm('orders.read')
  async getOrder(@Param('id') id: string) {
    const o = await this.orders.findById(oid(id)).populate('clientId', 'firstName lastName phone email').lean();
    if (!o) throw new NotFoundException('Commande introuvable');
    return o;
  }

  @Post('orders/:id/status')
  @Perm('orders.write')
  @Audit('orders.status')
  async setOrderStatus(@CurrentAdmin() me: AdminContext, @Param('id') id: string, @Body() dto: OrderStatusDto) {
    const order = await this.orders.findById(oid(id));
    if (!order) throw new NotFoundException('Commande introuvable');
    if (!ORDER_FLOW[order.status]?.includes(dto.status)) throw new BadRequestException(`Transition impossible : ${order.status} → ${dto.status}`);
    // Remise en stock en cas d'annulation.
    if (dto.status === 'cancelled') {
      await Promise.all(order.items.map((it: any) => this.products.updateOne({ _id: it.productId }, { $inc: { stock: it.quantity } })));
    }
    order.status = dto.status;
    order.history.push({ status: dto.status, at: new Date(), by: me.email, note: dto.note });
    await order.save();
    return order.toObject();
  }
}
