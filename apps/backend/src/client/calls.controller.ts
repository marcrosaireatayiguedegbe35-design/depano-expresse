import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CallsService } from '../common/calls.service';
import { AnswerDto, CandidatesDto, EndDto, OfferDto } from '../common/calls.dto';
import { ClientContext, CurrentClient } from './client.guard';

const FAST = { default: { limit: 200, ttl: 60_000 } };

/** Appels audio dans le site, côté client. */
@Controller()
export class ClientCallsController {
  constructor(private readonly calls: CallsService) {}
  @Get('calls/ice') ice() { return this.calls.iceServers(); }
  @Get('calls/incoming') @Throttle(FAST) incoming(@CurrentClient() me: ClientContext) { return this.calls.incoming('client', me.id); }
  @Post('interventions/:id/call') start(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: OfferDto) {
    return this.calls.start('client', me.id, id, dto.offer, `${me.firstName} ${me.lastName}`.trim());
  }
  @Get('calls/:id') @Throttle(FAST) state(@CurrentClient() me: ClientContext, @Param('id') id: string, @Query('since') since?: string) { return this.calls.state('client', me.id, id, Number(since) || 0); }
  @Post('calls/:id/answer') @HttpCode(200) answer(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: AnswerDto) { return this.calls.answer('client', me.id, id, dto.answer); }
  @Post('calls/:id/candidates') @HttpCode(200) @Throttle(FAST) cands(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: CandidatesDto) { return this.calls.addCandidates('client', me.id, id, dto.candidates); }
  @Post('calls/:id/end') @HttpCode(200) end(@CurrentClient() me: ClientContext, @Param('id') id: string, @Body() dto: EndDto) { return this.calls.end('client', me.id, id, dto.reason === 'decline'); }
}
