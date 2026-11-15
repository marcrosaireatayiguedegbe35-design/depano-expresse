import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CallsService } from '../common/calls.service';
import { OfferDto } from '../common/calls.dto';
import { ConversationsService } from '../common/conversations.service';
import { MessageDto, RespondConversationDto } from '../common/conversations.dto';
import { CurrentPro, ProContext } from './pro.guard';

const FAST = { default: { limit: 120, ttl: 60_000 } };

/** Demandes de contact des clients (hors urgence), côté professionnel : accepter, décliner, discuter, appeler. */
@Controller('conversations')
export class ProConversationsController {
  constructor(private readonly convs: ConversationsService, private readonly calls: CallsService) {}

  @Get() list(@CurrentPro() me: ProContext) { return this.convs.list('professional', me.id); }
  @Get('unread') @Throttle(FAST) unread(@CurrentPro() me: ProContext) { return this.convs.unreadTotal('professional', me.id); }
  @Get(':id') @Throttle(FAST) get(@CurrentPro() me: ProContext, @Param('id') id: string) { return this.convs.get('professional', me.id, id); }
  @Post(':id/accept') @HttpCode(200) accept(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: RespondConversationDto) { return this.convs.respond(me.id, id, true, dto.text); }
  @Post(':id/decline') @HttpCode(200) decline(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: RespondConversationDto) { return this.convs.respond(me.id, id, false, dto.text); }
  @Post(':id/messages') @HttpCode(200) @Throttle({ default: { limit: 30, ttl: 60_000 } })
  send(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: MessageDto) { return this.convs.send('professional', me.id, id, dto.text); }
  @Post(':id/close') @HttpCode(200) close(@CurrentPro() me: ProContext, @Param('id') id: string) { return this.convs.close('professional', me.id, id); }
  @Post(':id/call') async call(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: OfferDto) {
    return this.calls.startForConversation('professional', await this.convs.assertCallable('professional', me.id, id), dto.offer);
  }
}
