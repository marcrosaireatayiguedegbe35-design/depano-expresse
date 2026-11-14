import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CallsService } from '../common/calls.service';
import { AnswerDto, CandidatesDto, EndDto, OfferDto } from '../common/calls.dto';
import { CurrentPro, ProContext } from './pro.guard';

const FAST = { default: { limit: 200, ttl: 60_000 } };

/** Appels audio dans le site, côté professionnel. */
@Controller()
export class ProCallsController {
  constructor(private readonly calls: CallsService) {}
  @Get('calls/ice') ice() { return this.calls.iceServers(); }
  @Get('calls/incoming') @Throttle(FAST) incoming(@CurrentPro() me: ProContext) { return this.calls.incoming('professional', me.id); }
  @Post('interventions/:id/call') start(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: OfferDto) {
    return this.calls.start('professional', me.id, id, dto.offer, me.name);
  }
  @Get('calls/:id') @Throttle(FAST) state(@CurrentPro() me: ProContext, @Param('id') id: string, @Query('since') since?: string) { return this.calls.state('professional', me.id, id, Number(since) || 0); }
  @Post('calls/:id/answer') @HttpCode(200) answer(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: AnswerDto) { return this.calls.answer('professional', me.id, id, dto.answer); }
  @Post('calls/:id/candidates') @HttpCode(200) @Throttle(FAST) cands(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: CandidatesDto) { return this.calls.addCandidates('professional', me.id, id, dto.candidates); }
  @Post('calls/:id/end') @HttpCode(200) end(@CurrentPro() me: ProContext, @Param('id') id: string, @Body() dto: EndDto) { return this.calls.end('professional', me.id, id, dto.reason === 'decline'); }
}
