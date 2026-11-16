import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsString, IsUrl, Length, ValidateNested } from 'class-validator';
import { PushService } from '../common/push.service';
import { ClientContext, CurrentClient } from './client.guard';

class PushKeysDto {
  @IsString() @Length(10, 200) p256dh: string;
  @IsString() @Length(8, 100) auth: string;
}

class PushSubscribeDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false }) @Length(10, 1000) endpoint: string;
  @ValidateNested() @Type(() => PushKeysDto) keys: PushKeysDto;
}

class PushUnsubscribeDto {
  @IsString() @Length(10, 1000) endpoint: string;
}

/** Notifications sur le téléphone (Web Push) : abonnement du navigateur. */
@Controller('push')
export class ClientPushController {
  constructor(private readonly push: PushService) {}

  @Get('key')
  async key() { return { publicKey: await this.push.publicKey() }; }

  @Post('subscribe')
  @HttpCode(200)
  subscribe(@CurrentClient() me: ClientContext, @Body() dto: PushSubscribeDto, @Headers('user-agent') ua?: string) {
    return this.push.subscribe({ type: 'client', id: me.id }, dto, ua);
  }

  @Post('unsubscribe')
  @HttpCode(200)
  unsubscribe(@CurrentClient() me: ClientContext, @Body() dto: PushUnsubscribeDto) {
    return this.push.unsubscribe({ type: 'client', id: me.id }, dto.endpoint);
  }
}
