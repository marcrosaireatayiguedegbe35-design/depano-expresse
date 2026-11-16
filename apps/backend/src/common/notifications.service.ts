import { Injectable, Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Subject } from 'rxjs';
import { InjectM } from '../database.module';
import { PushService } from './push.service';

export interface NotificationInput {
  recipientType: 'client' | 'professional';
  recipientId: Types.ObjectId | string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/** Détails d'une opération pour le journal des opérations. */
export interface OpsMeta {
  /** Action faite depuis le back-office : on prévient le destinataire sans relancer l'alerte des administrateurs. */
  silent?: boolean;
  actorType?: 'client' | 'professional' | 'admin' | 'system';
  actorId?: string;
  refType?: string;
  refId?: string;
  amount?: number;
  /** Libellé détaillé (remplace le texte de la notification dans le journal). */
  body?: string;
}

/** Opération diffusée en temps réel au back-office (alerte sonore, rechargement des pages). */
export interface OpsEvent {
  type: string;
  title: string;
  body?: string;
  count: number;
  amount?: number;
  at: string;
}

export const OPS_LABELS: Record<string, string> = {
  'request.new': 'Nouvelle demande d’intervention',
  'request.selected': 'Professionnel choisi par un client',
  'request.cancelled': 'Demande annulée',
  'quotation.accepted': 'Devis accepté',
  'quotation.rejected': 'Devis refusé',
  'invoice.confirmed': 'Facture confirmée par un client',
  'invoice.contested': 'Facture contestée – litige ouvert',
  'payment.confirmed': 'Paiement reçu',
  'payment.cash_declared': 'Paiement en espèces annoncé',
  'payment.cash_received': 'Paiement en espèces confirmé',
  'order.created': 'Nouvelle commande marketplace',
  'order.received': 'Réception de commande confirmée par le client',
  'order.issue': 'Problème de livraison signalé par un client',
  'client.registered': 'Nouveau client inscrit',
  'pro.registered': 'Nouveau professionnel inscrit – à vérifier',
  'pro.document': 'Document déposé par un professionnel',
  'request.proposed': 'Proposition d’un professionnel',
  'request.declined': 'Demande déclinée par un professionnel',
  'request.info_requested': 'Un professionnel demande des précisions',
  'intervention.status': 'Intervention mise à jour',
  'intervention.step_confirmed': 'Étape confirmée par le client',
  'intervention.step_rejected': 'Étape contestée par le client',
  'intervention.step_admin': 'Étape validée par l’administration',
  'quotation.submitted': 'Devis soumis au client',
  'invoice.submitted': 'Facture soumise au client',
  'company.applied': 'Nouvelle entreprise à valider',
  'pro.validated': 'Professionnel validé',
  'client.deleted': 'Compte client supprimé',
  'call.incoming': 'Appel dans l’application',
  'pro.deleted': 'Compte professionnel supprimé',
  'pro.rejected': 'Professionnel refusé',
  'pro.suspended': 'Professionnel suspendu',
  'pro.in_review': 'Professionnel en vérification',
  'pro.pending': 'Professionnel remis en attente',
};

/** Notifications internes centralisées (CDC §17) + journal des opérations. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  /** Flux des opérations pour le back-office (Server-Sent Events). */
  readonly ops$ = new Subject<OpsEvent>();

  constructor(
    @InjectM('Notification') private readonly notifications: Model<any>,
    @InjectM('OperationLog') private readonly opLogs: Model<any>,
    private readonly push: PushService,
  ) {}

  async notify(input: NotificationInput | NotificationInput[], meta: OpsMeta = {}) {
    const list = Array.isArray(input) ? input : [input];
    if (!list.length) return;
    try {
      await this.notifications.insertMany(list.map((n) => ({ ...n, recipientId: new Types.ObjectId(String(n.recipientId)) })));
    } catch (err) {
      this.logger.error(`Notification non enregistrée : ${(err as Error).message}`);
    }
    // Aussi sur le téléphone (même site fermé), sans attendre l'envoi.
    void this.push.send(list);
    if (meta.silent) return;
    // Une seule opération par action, même si plusieurs destinataires sont notifiés.
    const first = list.find((n) => !n.type.endsWith('.closed')) ?? list[0];
    await this.emit(first.type, meta.body ?? first.body, list.length, meta);
  }

  /** Enregistre l'opération dans le journal et la diffuse au back-office. */
  async emit(type: string, body?: string, count = 1, meta: OpsMeta = {}) {
    const at = new Date();
    const title = OPS_LABELS[type] ?? 'Nouvelle opération';
    try {
      await this.opLogs.create({ type, title, body, actorType: meta.actorType ?? 'system', actorId: meta.actorId, refType: meta.refType, refId: meta.refId, amount: meta.amount, at });
    } catch (err) {
      this.logger.error(`Opération non journalisée : ${(err as Error).message}`);
    }
    this.ops$.next({ type, title, body, count, amount: meta.amount, at: at.toISOString() });
  }
}
