import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsString, IsUrl, Length, ValidateNested } from 'class-validator';
import { PushService } from '../common/push.service';
import { ProContext, CurrentPro } from './pro.guard';

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
export class ProPushController {
  constructor(private readonly push: PushService) {}

  @Get('key')
  async key() { return { publicKey: await this.push.publicKey() }; }

  @Post('subscribe')
  @HttpCode(200)
  subscribe(@CurrentPro() me: ProContext, @Body() dto: PushSubscribeDto, @Headers('user-agent') ua?: string) {
    return this.push.subscribe({ type: 'professional', id: me.id }, dto, ua);
  }

  @Post('unsubscribe')
  @HttpCode(200)
  unsubscribe(@CurrentPro() me: ProContext, @Body() dto: PushUnsubscribeDto) {
    return this.push.unsubscribe({ type: 'professional', id: me.id }, dto.endpoint);
  }
}
