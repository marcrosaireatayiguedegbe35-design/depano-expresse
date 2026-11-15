import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectM } from '../database.module';
import { NotificationsService } from './notifications.service';

export type Side = 'client' | 'professional';
const MAX_MESSAGES = 500;
const PRO_PUBLIC = 'firstName lastName businessName photoUrl trade commune quartier rating reviewsCount availability';
const oid = (id: string) => { if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Conversation introuvable'); return new Types.ObjectId(id); };

/**
 * Mise en relation hors urgence : le client écrit à un professionnel précis ; celui-ci accepte ou décline.
 * Une fois acceptée, les deux échangent des messages, s'appellent dans le site et voient le numéro de l'autre.
 */
@Injectable()
export class ConversationsService {
  constructor(
    @InjectM('Conversation') private readonly convs: Model<any>,
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('User') private readonly users: Model<any>,
    private readonly notify: NotificationsService,
  ) {}

  private field(side: Side) { return side === 'client' ? 'clientId' : 'professionalId'; }

  private async load(side: Side, userId: string, id: string) {
    const c = await this.convs.findById(oid(id));
    if (!c || String(c[this.field(side)]) !== userId) throw new NotFoundException('Conversation introuvable');
    return c;
  }

  private unread(c: any, side: Side) {
    const readAt = side === 'client' ? c.clientReadAt : c.proReadAt;
    const otherSide: Side = side === 'client' ? 'professional' : 'client';
    return (c.messages ?? []).filter((m: any) => m.from === otherSide && (!readAt || m.at > readAt)).length;
  }

  /** Le client écrit à un professionnel : nouvelle demande, ou message dans la conversation déjà acceptée. */
  async start(clientId: string, professionalId: string, topic: string, text: string) {
    if (!Types.ObjectId.isValid(professionalId)) throw new BadRequestException('Professionnel introuvable');
    const pro = await this.pros.findOne({ _id: new Types.ObjectId(professionalId), verificationStatus: 'validated', deletedAt: null }).select('_id firstName businessName').lean<any>();
    if (!pro) throw new BadRequestException('Ce professionnel n’est pas disponible');
    const open = await this.convs.findOne({ clientId: new Types.ObjectId(clientId), professionalId: pro._id, status: { $in: ['pending', 'accepted'] } });
    if (open?.status === 'pending') throw new ConflictException('Votre demande est déjà envoyée : le professionnel ne l’a pas encore acceptée.');
    if (open) { await this.send('client', clientId, String(open._id), text); return { id: String(open._id), existing: true }; }
    const now = new Date();
    const c = await this.convs.create({ clientId, professionalId: pro._id, topic: topic.trim(), messages: [{ from: 'client', text: text.trim(), at: now }], lastMessageAt: now, clientReadAt: now });
    const client = await this.users.findById(clientId).select('firstName lastName').lean<any>();
    await this.notify.notify({ recipientType: 'professional', recipientId: pro._id, type: 'conversation.request', title: 'Nouvelle demande de contact', body: `${client?.firstName ?? 'Un client'} : ${topic.trim()}`, link: `/messages/${c._id}` }, { silent: true });
    return { id: String(c._id), existing: false };
  }

  async list(side: Side, userId: string) {
    const rows = await this.convs.find({ [this.field(side)]: new Types.ObjectId(userId) }).sort({ lastMessageAt: -1 }).limit(100)
      .populate(side === 'client' ? { path: 'professionalId', select: PRO_PUBLIC } : { path: 'clientId', select: 'firstName lastName' }).lean<any[]>();
    return rows.map((c) => {
      const last = c.messages?.[c.messages.length - 1];
      return { _id: c._id, topic: c.topic, status: c.status, lastMessageAt: c.lastMessageAt, last: last ? { from: last.from, text: last.text.slice(0, 140), at: last.at } : null, unread: this.unread(c, side), peer: side === 'client' ? c.professionalId : c.clientId };
    });
  }

  async unreadTotal(side: Side, userId: string) {
    const rows = await this.convs.find({ [this.field(side)]: new Types.ObjectId(userId), status: { $in: ['pending', 'accepted'] } }).select('messages.from messages.at clientReadAt proReadAt status').lean<any[]>();
    const pending = side === 'professional' ? rows.filter((c) => c.status === 'pending').length : 0;
    return { unread: rows.reduce((n, c) => n + this.unread(c, side), 0), pending };
  }

  /** Détail ; le numéro de l'autre n'est visible qu'une fois la demande acceptée. Marque les messages comme lus. */
  async get(side: Side, userId: string, id: string) {
    const c = await this.load(side, userId, id);
    c[side === 'client' ? 'clientReadAt' : 'proReadAt'] = new Date();
    await c.save();
    const accepted = c.status === 'accepted';
    const peer = side === 'client'
      ? await this.pros.findById(c.professionalId).select(`${PRO_PUBLIC}${accepted ? ' phone' : ''}`).lean()
      : await this.users.findById(c.clientId).select(`firstName lastName commune quartier${accepted ? ' phone' : ''}`).lean();
    const o = c.toObject();
    return { _id: o._id, topic: o.topic, status: o.status, messages: o.messages, acceptedAt: o.acceptedAt, createdAt: o.createdAt, peer };
  }

  async send(side: Side, userId: string, id: string, text: string) {
    const c = await this.load(side, userId, id);
    if (c.status !== 'accepted') {
      throw new BadRequestException(c.status === 'pending' ? 'Le professionnel doit d’abord accepter votre demande.' : 'Cette conversation est terminée.');
    }
    if ((c.messages?.length ?? 0) >= MAX_MESSAGES) throw new BadRequestException('Conversation trop longue : ouvrez-en une nouvelle.');
    const now = new Date();
    c.messages.push({ from: side, text: text.trim(), at: now });
    c.lastMessageAt = now;
    c[side === 'client' ? 'clientReadAt' : 'proReadAt'] = now;
    await c.save();
    await this.notify.notify(side === 'client'
      ? { recipientType: 'professional', recipientId: c.professionalId, type: 'conversation.message', title: 'Nouveau message d’un client', body: text.trim().slice(0, 120), link: `/messages/${c._id}` }
      : { recipientType: 'client', recipientId: c.clientId, type: 'conversation.message', title: 'Nouveau message d’un professionnel', body: text.trim().slice(0, 120), link: `/compte/messages/${c._id}` }, { silent: true });
    return { ok: true };
  }

  async respond(proId: string, id: string, accept: boolean, text?: string) {
    const c = await this.load('professional', proId, id);
    if (c.status !== 'pending') throw new BadRequestException('Cette demande a déjà reçu une réponse.');
    const now = new Date();
    c.status = accept ? 'accepted' : 'declined';
    c[accept ? 'acceptedAt' : 'declinedAt'] = now;
    if (text?.trim()) { c.messages.push({ from: 'professional', text: text.trim(), at: now }); c.lastMessageAt = now; }
    c.proReadAt = now;
    await c.save();
    await this.notify.notify({ recipientType: 'client', recipientId: c.clientId, type: accept ? 'conversation.accepted' : 'conversation.declined', title: accept ? 'Demande acceptée' : 'Demande déclinée', body: accept ? 'Le professionnel a accepté : écrivez-lui ou appelez-le.' : 'Le professionnel n’est pas disponible pour cette demande.', link: `/compte/messages/${c._id}` }, { silent: true });
    return { ok: true, status: c.status };
  }

  async close(side: Side, userId: string, id: string) {
    const c = await this.load(side, userId, id);
    if (c.status === 'closed') return { ok: true };
    if (side === 'client' && c.status === 'declined') return { ok: true };
    c.status = 'closed'; c.closedAt = new Date();
    await c.save();
    return { ok: true };
  }

  /** Pour l'appel dans le site : la conversation doit être acceptée. */
  async assertCallable(side: Side, userId: string, id: string) {
    const c = await this.load(side, userId, id);
    if (c.status !== 'accepted') throw new ForbiddenException('L’appel est possible une fois la demande acceptée.');
    return { clientId: c.clientId, professionalId: c.professionalId, _id: c._id };
  }
}
