import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { InjectM } from '../database.module';
import { NotificationsService } from './notifications.service';
import { currentEngagement } from './pro-lock';

const OPEN_INTERVENTION = { status: { $nin: ['completed', 'cancelled'] } };
const UNSETTLED_INVOICE = { status: { $in: ['submitted', 'approved', 'contested'] } };

/**
 * Suppression d'un compte par son titulaire (clients et professionnels).
 * Les données personnelles sont effacées ou anonymisées ; les factures, paiements et commissions
 * déjà émis sont conservés (obligations comptables) mais ne portent plus de données identifiantes.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    @InjectM('User') private readonly users: Model<any>,
    @InjectM('Professional') private readonly pros: Model<any>,
    @InjectM('ClientSession') private readonly clientSessions: Model<any>,
    @InjectM('ProSession') private readonly proSessions: Model<any>,
    @InjectM('Vehicle') private readonly vehicles: Model<any>,
    @InjectM('Conversation') private readonly conversations: Model<any>,
    @InjectM('Notification') private readonly notifications: Model<any>,
    @InjectM('VerificationCode') private readonly codes: Model<any>,
    @InjectM('ServiceRequest') private readonly requests: Model<any>,
    @InjectM('ServiceResponse') private readonly responses: Model<any>,
    @InjectM('Intervention') private readonly interventions: Model<any>,
    @InjectM('Invoice') private readonly invoices: Model<any>,
    @InjectM('Commission') private readonly commissions: Model<any>,
    @InjectM('ProfessionalDocument') private readonly documents: Model<any>,
    private readonly notify: NotificationsService,
  ) {}

  private async checkPassword(model: Model<any>, id: string, password: string) {
    const doc = await model.findById(id).select('+passwordHash');
    if (!doc?.passwordHash || !(await bcrypt.compare(password ?? '', doc.passwordHash))) throw new UnauthorizedException('Mot de passe incorrect');
    return doc;
  }

  async deleteClient(id: string, password: string) {
    const user = await this.checkPassword(this.users, id, password);
    const uid = new Types.ObjectId(id);
    if (await this.interventions.exists({ clientId: uid, ...OPEN_INTERVENTION })) {
      throw new BadRequestException('Une intervention est en cours : attendez qu’elle soit terminée avant de supprimer votre compte.');
    }
    if (await this.invoices.exists({ clientId: uid, ...UNSETTLED_INVOICE })) {
      throw new BadRequestException('Une facture attend votre confirmation, votre paiement ou un litige : réglez-la avant de supprimer votre compte.');
    }
    // Demandes encore ouvertes : annulées, les professionnels sont prévenus.
    const open = await this.requests.find({ clientId: uid, status: { $in: ['sent', 'pending', 'response_received'] } }).select('recipients').lean<any[]>();
    if (open.length) {
      await this.requests.updateMany({ _id: { $in: open.map((r) => r._id) } }, { status: 'cancelled' });
      await this.responses.updateMany({ requestId: { $in: open.map((r) => r._id) } }, { status: 'closed' });
      await this.notify.notify(open.flatMap((r) => (r.recipients ?? []).map((p: Types.ObjectId) => ({ recipientType: 'professional' as const, recipientId: p, type: 'request.cancelled', title: 'Demande annulée (compte client supprimé)' }))));
    }
    await Promise.all([
      this.vehicles.deleteMany({ userId: uid }),
      this.conversations.deleteMany({ clientId: uid }),
      this.notifications.deleteMany({ recipientType: 'client', recipientId: uid }),
      this.clientSessions.deleteMany({ userId: uid }),
      this.codes.deleteMany({ destination: user.email }),
      this.requests.updateMany({ clientId: uid }, { $unset: { phone: 1, photos: 1 } }),
    ]);
    await this.users.updateOne({ _id: uid }, {
      $set: { firstName: 'Client', lastName: 'supprimé', email: `supprime-${id}@compte-supprime.invalid`, status: 'deleted', deletedAt: new Date(), emailVerified: false },
      $unset: { passwordHash: 1, phone: 1, commune: 1, quartier: 1, lockedUntil: 1, deletionRequestedAt: 1 },
    });
    this.notify.emit('client.deleted', `Compte client supprimé par son titulaire`, 1, { actorType: 'client', actorId: id, refType: 'user', refId: id });
  }

  async deletePro(id: string, password: string) {
    const pro = await this.checkPassword(this.pros, id, password);
    const pid = new Types.ObjectId(id);
    const busy = await currentEngagement(this.pros, this.interventions, pid);
    if (busy || (await this.interventions.exists({ professionalId: pid, ...OPEN_INTERVENTION }))) {
      throw new BadRequestException('Une intervention est en cours : terminez-la avant de supprimer votre compte.');
    }
    if (await this.invoices.exists({ professionalId: pid, ...UNSETTLED_INVOICE })) {
      throw new BadRequestException('Une facture n’est pas encore réglée par le client : attendez son paiement (ou la fin du litige) avant de supprimer votre compte.');
    }
    const owed = await this.commissions.aggregate([{ $match: { professionalId: pid, payoutId: null, collection: { $ne: 'cash' } } }, { $group: { _id: null, net: { $sum: '$professionalNet' } } }]);
    if ((owed[0]?.net ?? 0) > 0) {
      throw new BadRequestException(`${owed[0].net} FCFA doivent encore vous être reversés : contactez l’assistance pour recevoir ce reversement avant de supprimer votre compte.`);
    }
    await this.responses.updateMany({ professionalId: pid, status: { $in: ['pending', 'info_requested', 'proposed'] } }, { status: 'declined', message: 'Compte professionnel supprimé', respondedAt: new Date() });
    await Promise.all([
      this.documents.deleteMany({ professionalId: pid }),
      this.conversations.deleteMany({ professionalId: pid }),
      this.notifications.deleteMany({ recipientType: 'professional', recipientId: pid }),
      this.proSessions.deleteMany({ professionalId: pid }),
      this.codes.deleteMany({ destination: pro.email }),
    ]);
    await this.pros.updateOne({ _id: pid }, {
      $set: { firstName: 'Professionnel', lastName: 'supprimé', email: `supprime-${id}@compte-supprime.invalid`, availability: 'unavailable', verificationStatus: 'suspended', deletedAt: new Date(), emailVerified: false, services: [] },
      $unset: { passwordHash: 1, phone: 1, businessName: 1, photoUrl: 1, description: 1, hours: 1, indicativeRates: 1, address: 1, quartier: 1, payoutAccount: 1, activeInterventionId: 1, lockedUntil: 1 },
    });
    this.notify.emit('pro.deleted', `Compte professionnel supprimé par son titulaire`, 1, { actorType: 'professional', actorId: id, refType: 'professional', refId: id });
  }
}
