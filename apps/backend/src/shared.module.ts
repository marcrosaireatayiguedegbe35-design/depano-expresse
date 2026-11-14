import { Global, Module } from '@nestjs/common';
import { AuditService } from './modules/audit/audit.service';
import { MailService } from './common/mail.service';
import { VerificationService } from './common/verification.service';
import { NotificationsService } from './common/notifications.service';
import { AccountDeletionService } from './common/account-deletion.service';

/** Services transverses disponibles dans tous les espaces. */
@Global()
@Module({
  providers: [AuditService, MailService, VerificationService, NotificationsService, AccountDeletionService],
  exports: [AuditService, MailService, VerificationService, NotificationsService, AccountDeletionService],
})
export class SharedModule {}
