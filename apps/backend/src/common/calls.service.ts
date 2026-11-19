import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectM } from '../database.module';

export type Side = 'client' | 'professional';
const other = (s: Side): Side => (s === 'client' ? 'professional' : 'client');
const RING_SECONDS = 45;
const CALLABLE = ['accepted', 'en_route', 'on_site', 'in_progress', 'completed', 'contested'];

/**
 * Signalisation des appels audio WebRTC : l'API ne transporte que l'offre, la réponse et les candidats réseau ;
 * la voix circule directement entre les deux navigateurs (chiffrée par WebRTC).
 */
@Injectable()
export class CallsService {
  constructor(
    @InjectM('Call') private readonly calls: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
  ) {}

  /** Serveurs STUN/TURN transmis aux navigateurs (TURN facultatif, configuré par variables d'environnement). */
  iceServers() {
    const servers: any[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
    if (process.env.TURN_URL) servers.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
    return { iceServers: servers };
  }

  private async mine(side: Side, userId: string, callId: string) {
    const c = Types.ObjectId.isValid(callId) ? await this.calls.findById(new Types.ObjectId(callId)) : null;
    if (!c) throw new NotFoundException('Appel introuvable');
    const owner = side === 'client' ? c.clientId : c.professionalId;
    if (String(owner) !== userId) throw new ForbiddenException('Appel non autorisé');
    return c;
  }

  private async expire() {
    await this.calls.updateMany({ status: 'ringing', createdAt: { $lt: new Date(Date.now() - RING_SECONDS * 1000) } }, { status: 'missed', endedAt: new Date() });
  }

  async start(side: Side, userId: string, interventionId: string, offer: string, callerName: string) {
    const i = !Types.ObjectId.isValid(interventionId) ? null : await this.interventions.findById(new Types.ObjectId(interventionId)).select('clientId professionalId status reference').lean<any>();
    if (!i) throw new NotFoundException('Intervention introuvable');
    if (String(side === 'client' ? i.clientId : i.professionalId) !== userId) throw new ForbiddenException('Intervention non autorisée');
    if (!CALLABLE.includes(i.status)) throw new BadRequestException('L’appel n’est possible que pendant une intervention.');
    await this.expire();
    if (await this.calls.exists({ interventionId: i._id, status: { $in: ['ringing', 'active'] } })) throw new ConflictException('Un appel est déjà en cours pour cette intervention.');
    const c = await this.calls.create({ interventionId: i._id, clientId: i.clientId, professionalId: i.professionalId, caller: side, offer, candidates: { client: [], professional: [] } });
    // Pas de notification ni d'alerte back-office : l'appareil de l'appelé détecte la sonnerie en interrogeant /calls/incoming.
    void callerName;
    return { id: String(c._id) };
  }

  /** Appel dans le cadre d'une mise en relation acceptée (hors intervention). */
  async startForConversation(side: Side, conv: { _id: any; clientId: any; professionalId: any }, offer: string) {
    await this.expire();
    if (await this.calls.exists({ conversationId: conv._id, status: { $in: ['ringing', 'active'] } })) throw new ConflictException('Un appel est déjà en cours.');
    const c = await this.calls.create({ conversationId: conv._id, clientId: conv.clientId, professionalId: conv.professionalId, caller: side, offer, candidates: { client: [], professional: [] } });
    return { id: String(c._id) };
  }

  /** Appel entrant qui sonne pour cet utilisateur (avec l'offre WebRTC). */
  async incoming(side: Side, userId: string) {
    await this.expire();
    const field = side === 'client' ? 'clientId' : 'professionalId';
    const c = await this.calls.findOne({ [field]: new Types.ObjectId(userId), caller: other(side), status: 'ringing' })
      .sort({ createdAt: -1 }).populate('interventionId', 'reference problem').populate(side === 'client' ? 'professionalId' : 'clientId', 'firstName lastName businessName').lean<any>();
    if (!c) return null;
    const who = side === 'client' ? c.professionalId : c.clientId;
    return { id: String(c._id), offer: c.offer, from: who?.businessName || [who?.firstName, who?.lastName].filter(Boolean).join(' '), intervention: c.interventionId };
  }

  async state(side: Side, userId: string, callId: string, since = 0) {
    const c = await this.mine(side, userId, callId);
    if (c.status === 'ringing' && c.createdAt.getTime() < Date.now() - RING_SECONDS * 1000) { c.status = 'missed'; c.endedAt = new Date(); await c.save(); }
    const theirs: string[] = c.candidates?.[other(side)] ?? [];
    return { status: c.status, answer: side === c.caller ? c.answer ?? null : null, candidates: theirs.slice(since), total: theirs.length, endedBy: c.endedBy };
  }

  async answer(side: Side, userId: string, callId: string, sdp: string) {
    const c = await this.mine(side, userId, callId);
    if (c.caller === side) throw new BadRequestException('Vous êtes l’appelant');
    const r = await this.calls.updateOne({ _id: c._id, status: 'ringing' }, { status: 'active', answer: sdp, answeredAt: new Date() });
    if (!r.modifiedCount) throw new ConflictException('L’appel n’est plus disponible.');
    return { ok: true };
  }

  async addCandidates(side: Side, userId: string, callId: string, list: string[]) {
    const c = await this.mine(side, userId, callId);
    if (['ended', 'missed', 'declined'].includes(c.status)) return { ok: true };
    await this.calls.updateOne({ _id: c._id }, { $push: { [`candidates.${side}`]: { $each: list.slice(0, 40) } } });
    return { ok: true };
  }

  async end(side: Side, userId: string, callId: string, decline = false) {
    const c = await this.mine(side, userId, callId);
    if (['ended', 'missed', 'declined'].includes(c.status)) return { ok: true };
    const status = decline && c.status === 'ringing' ? 'declined' : c.status === 'ringing' && side === c.caller ? 'missed' : 'ended';
    await this.calls.updateOne({ _id: c._id }, { status, endedAt: new Date(), endedBy: side });
    return { ok: true };
  }
}
