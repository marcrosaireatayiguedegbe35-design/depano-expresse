import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CallsService } from '../common/calls.service';
import { OfferDto } from '../common/calls.dto';
import { ConversationsService } from '../common/conversations.service';
import { MessageDto, StartConversationDto } from '../common/conversations.dto';
import { ClientContext, CurrentClient } from './client.guard';

const FAST = { default: { limit: 120, ttl: 60_000 } };

/** Mise en relation hors urgence, côté client : écrire à un pro, discuter, l'appeler. */
@Controller('conversations')
export class ClientConversationsController {
  constructor(private readonly convs: ConversationsService, private readonly calls: CallsService) {}

  @Post() @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(@CurrentClient() me: ClientContext, @Body() dto: StartConversationDto) { return this.convs.start(me.id, dto.professionalId, dto.topic, dto.text); }

  @Get() list(@CurrentClient() me: ClientContext) { return this.convs.list('client', me.id); }
  @Get('unread') @Throttle(FAST) unread(@CurrentClient() me: ClientContext) { return this.convs.unreadTotal('client', me.id); }
  @Get(':id') @Throttle(FAST) get(@CurrentClient() me: ClientContext, @Param('id') id: string) { return this.convs.get('client', me.id, id); }
  @Post(':id/messages') @HttpCode(200) @Throttle({ default: { limit: 30, ttl: 60_000 } })
  send(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: MessageDto) { return this.convs.send('client', me.id, id, dto.text); }
  @Post(':id/close') @HttpCode(200) close(@CurrentClient() me: ClientContext, @Param('id') id: string) { return this.convs.close('client', me.id, id); }
  @Post(':id/call') async call(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: OfferDto) {
    return this.calls.startForConversation('client', await this.convs.assertCallable('client', me.id, id), dto.offer);
  }
}
