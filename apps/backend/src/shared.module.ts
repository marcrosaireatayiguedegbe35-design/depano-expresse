import { Global, Module } from '@nestjs/common';
import { AuditService } from './modules/audit/audit.service';
import { MailService } from './common/mail.service';
import { VerificationService } from './common/verification.service';
import { NotificationsService } from './common/notifications.service';
import { AccountDeletionService } from './common/account-deletion.service';
import { CallsService } from './common/calls.service';
import { ConversationsService } from './common/conversations.service';
import { ShopService } from './common/shop.service';
import { PushService } from './common/push.service';
import { GeoService } from './common/geo.service';

/** Services transverses disponibles dans tous les espaces. */
@Global()
@Module({
  providers: [AuditService, MailService, VerificationService, NotificationsService, AccountDeletionService, CallsService, ConversationsService, ShopService, PushService, GeoService],
  exports: [AuditService, MailService, VerificationService, NotificationsService, AccountDeletionService, CallsService, ConversationsService, ShopService, PushService, GeoService],
})
export class SharedModule {}
