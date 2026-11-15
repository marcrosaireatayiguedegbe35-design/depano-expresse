import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { ShopService } from '../common/shop.service';
import { CurrentPro, ProContext } from './pro.guard';

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

class DeliveryIssueDto {
  @IsString() @Length(3, 500) reason: string;
}

/** Boutique de l'espace professionnel : même catalogue que les clients, commandes au nom du professionnel. */
@Controller()
export class ProShopController {
  constructor(private readonly shop: ShopService) {}

  private buyer(me: ProContext) { return { type: 'professional' as const, id: me.id }; }

  @Get('product-categories')
  productCategories() { return this.shop.productCategories(); }

  @Get('products')
  listProducts(@Query() q: Record<string, unknown>) { return this.shop.listProducts(q); }

  @Get('products/:id')
  product(@Param('id') id: string) { return this.shop.product(id); }

  @Get('ads')
  listAds(@Query() q: Record<string, unknown>) { return this.shop.listAds(q); }

  @Post('ads/:id/:event')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  track(@Param('id') id: string, @Param('event') event: string) { return this.shop.trackAd(id, event); }

  @Post('orders')
  createOrder(@CurrentPro() me: ProContext, @Body() dto: OrderDto) { return this.shop.createOrder(this.buyer(me), dto); }

  @Get('orders')
  myOrders(@CurrentPro() me: ProContext, @Query() q: Record<string, unknown>) { return this.shop.myOrders(this.buyer(me), q); }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancelOrder(@CurrentPro() me: ProContext, @Param('id') id: string) { return this.shop.cancelOrder(this.buyer(me), id); }

  @Post('orders/:id/received')
  @HttpCode(200)
  confirmReceived(@CurrentPro() me: ProContext, @Param('id') id: string) { return this.shop.confirmReceived(this.buyer(me), id); }

  @Post('orders/:id/not-received')
  @HttpCode(200)
  reportNotReceived(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: DeliveryIssueDto) { return this.shop.reportNotReceived(this.buyer(me), id, dto.reason); }
}
