import { Controller, Get, MessageEvent, Query, Sse } from '@nestjs/common';
import { Model } from 'mongoose';
import { interval, map, merge, Observable, of } from 'rxjs';
import { InjectM } from '../../database.module';
import { Perm } from '../../common/http';
import { NotificationsService } from '../../common/notifications.service';

/** Opérations en temps réel pour l'alerte sonore du back-office. */
@Controller('events')
export class EventsController {
  constructor(
    private readonly notifications: NotificationsService,
    @InjectM('OperationLog') private readonly store: Model<any>,
  ) {}

  @Sse('stream')
  @Perm('dashboard.read')
  stream(): Observable<MessageEvent> {
    // Nest envoie lui-même les en-têtes du flux (text/event-stream, no-cache).
    return merge(
      // Premier message immédiat : ouvre le flux même derrière un proxy qui attend le premier octet.
      of({ type: 'hello', data: { at: new Date().toISOString() } } as MessageEvent),
      this.notifications.ops$.pipe(map((e) => ({ type: 'op', data: e }) as MessageEvent)),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: { at: new Date().toISOString() } }) as MessageEvent)),
    );
  }

  /** Secours si la connexion temps réel est coupée : opérations depuis une date. */
  @Get('recent')
  @Perm('dashboard.read')
  async recent(@Query('since') since?: string) {
    const from = since && !isNaN(Date.parse(since)) ? new Date(since) : new Date(Date.now() - 60_000);
    const rows = await this.store
      .find({ at: { $gt: from } })
      .sort({ at: 1 })
      .limit(50)
      .select('type title body amount at')
      .lean<any[]>();
    return rows.map((r) => ({ type: r.type, title: r.title, body: r.body, amount: r.amount, at: r.at }));
  }
}
