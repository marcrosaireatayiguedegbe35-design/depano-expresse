import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import webpush from 'web-push';
import { InjectM } from '../database.module';

export type PushOwner = { type: 'client' | 'professional'; id: string };

/**
 * Services de notification des navigateurs (Chrome/Android/Opera/Samsung : FCM ; Firefox : Mozilla ;
 * Safari/iPhone : Apple ; Edge : Windows). Toute autre adresse est refusée : sans cette liste, un compte
 * pourrait faire envoyer par le serveur des requêtes vers des adresses internes (SSRF).
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];

export function isPushEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && !u.username && !u.password && PUSH_HOSTS.some((rx) => rx.test(u.hostname.toLowerCase()));
  } catch {
    return false;
  }
}

export interface PushMessage {
  recipientType: 'client' | 'professional';
  recipientId: Types.ObjectId | string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Notifications sur le téléphone (Web Push) : elles s'affichent dans la liste des notifications
 * du téléphone même quand le site est fermé.
 *
 * Les clés VAPID viennent de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY si elles sont définies ;
 * sinon elles sont créées une seule fois et gardées en base (aucune clé à saisir sur Render).
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger('Push');
  private ready: Promise<string | null> = Promise.resolve(null);

  constructor(
    @InjectM('PushSubscription') private readonly subs: Model<any>,
    @InjectM('SystemSetting') private readonly settings: Model<any>,
  ) {}

  onModuleInit() {
    this.ready = this.init().catch((err) => {
      this.logger.error(`Notifications téléphone indisponibles : ${(err as Error).message}`);
      return null;
    });
  }

  private async init(): Promise<string> {
    let publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    let privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    if (!publicKey || !privateKey) {
      // Créées une seule fois ; $setOnInsert garde la première paire si deux instances démarrent ensemble.
      const generated = webpush.generateVAPIDKeys();
      await this.settings.updateOne({ key: 'push.vapid' }, { $setOnInsert: { value: generated } }, { upsert: true });
      const saved = await this.settings.findOne({ key: 'push.vapid' }).lean<any>();
      publicKey = saved.value.publicKey;
      privateKey = saved.value.privateKey;
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:contact@depanno-expresse.bj', publicKey!, privateKey!);
    return publicKey!;
  }

  /** Clé publique transmise au navigateur pour l'abonnement. */
  publicKey() {
    return this.ready;
  }

  async subscribe(owner: PushOwner, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    if (!isPushEndpoint(sub.endpoint)) throw new BadRequestException('Service de notification non reconnu');
    await this.subs.updateOne(
      { endpoint: sub.endpoint },
      { $set: { ownerType: owner.type, ownerId: new Types.ObjectId(owner.id), keys: sub.keys, userAgent: userAgent?.slice(0, 300) } },
      { upsert: true },
    );
    return { ok: true };
  }

  async unsubscribe(owner: PushOwner, endpoint: string) {
    await this.subs.deleteOne({ endpoint, ownerType: owner.type, ownerId: new Types.ObjectId(owner.id) });
    return { ok: true };
  }

  /** Supprime tous les abonnements d'un compte (déconnexion de tous les appareils, suppression du compte). */
  async forget(owner: PushOwner) {
    await this.subs.deleteMany({ ownerType: owner.type, ownerId: new Types.ObjectId(owner.id) });
  }

  /** Annonce envoyée à tous les téléphones abonnés d'un espace (nouvelle publication). */
  async broadcast(ownerType: 'client' | 'professional', msg: { title: string; body?: string; link?: string; tag: string }) {
    if (!(await this.ready)) return;
    const payload = JSON.stringify({ title: msg.title, body: msg.body ?? '', url: msg.link || '/', tag: msg.tag });
    const cursor = this.subs.find({ ownerType }).lean().cursor();
    for await (const s of cursor as AsyncIterable<any>) {
      if (!isPushEndpoint(s.endpoint)) continue;
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3 * 24 * 3600 }).catch(async (err: any) => {
        if (err?.statusCode === 404 || err?.statusCode === 410) await this.subs.deleteOne({ _id: s._id });
      });
    }
  }

  /** Envoie les notifications sur les téléphones abonnés. N'échoue jamais : la notification interne reste enregistrée. */
  async send(list: PushMessage[]) {
    if (!list.length || !(await this.ready)) return;
    await Promise.all(list.map(async (n) => {
      try {
        const subs = (await this.subs.find({ ownerType: n.recipientType, ownerId: new Types.ObjectId(String(n.recipientId)) }).lean<any[]>()).filter((s) => isPushEndpoint(s.endpoint));
        if (!subs.length) return;
        const payload = JSON.stringify({ title: n.title, body: n.body ?? '', url: n.link || '/', tag: n.type });
        await Promise.all(subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 24 * 3600, urgency: 'high' });
          } catch (err: any) {
            // Abonnement expiré ou retiré par l'utilisateur : on l'oublie.
            if (err?.statusCode === 404 || err?.statusCode === 410) await this.subs.deleteOne({ _id: s._id });
            else this.logger.warn(`Envoi refusé (${err?.statusCode ?? '?'}) : ${err?.body ?? err?.message}`);
          }
        }));
      } catch (err) {
        this.logger.error(`Notification téléphone non envoyée : ${(err as Error).message}`);
      }
    }));
  }
}
