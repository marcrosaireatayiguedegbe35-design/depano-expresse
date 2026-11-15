import { Global, Module } from '@nestjs/common';
import { AuditService } from './modules/audit/audit.service';
import { MailService } from './common/mail.service';
import { VerificationService } from './common/verification.service';
import { NotificationsService } from './common/notifications.service';
import { AccountDeletionService } from './common/account-deletion.service';
import { CallsService } from './common/calls.service';
import { ConversationsService } from './common/conversations.service';

/** Services transverses disponibles dans tous les espaces. */
@Global()
@Module({
  providers: [AuditService, MailService, VerificationService, NotificationsService, AccountDeletionService, CallsService, ConversationsService],
  exports: [AuditService, MailService, VerificationService, NotificationsService, AccountDeletionService, CallsService, ConversationsService],
})
export class SharedModule {}
