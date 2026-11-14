import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database.module';
import { AuditService } from './modules/audit/audit.service';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditController } from './modules/audit/audit.controller';
import { AdminGuard } from './modules/auth/guards';
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { AdminsController } from './modules/admins/admins.controller';
import { DashboardController } from './modules/dashboard/dashboard.controller';
import { UsersController } from './modules/people/users.controller';
import { ProfessionalsController } from './modules/people/professionals.controller';
import { CatalogController } from './modules/people/catalog.controller';
import { InterventionsController } from './modules/interventions/interventions.controller';
import { FinanceService } from './modules/finance/finance.service';
import { FinanceController } from './modules/finance/finance.controller';
import { MarketplaceController } from './modules/marketplace/marketplace.controller';
import { DirectoryController } from './modules/directory/directory.controller';
import { ModerationController } from './modules/moderation/moderation.controller';
import { HealthController } from './health.controller';
import { UploadsController } from './modules/uploads/uploads.controller';
import { EventsController } from './modules/events/events.controller';
import { OperationsController } from './modules/events/operations.controller';
import { AccountingController } from './modules/finance/accounting.controller';
import { ClientModule } from './client/client.module';
import { ClientGuard } from './client/client.guard';
import { ProModule } from './pro/pro.module';
import { ProGuard } from './pro/pro.guard';
import { SharedModule } from './shared.module';

/** Back-office administrateur : toutes ses routes sont servies sous /admin. */
@Module({
  controllers: [
    HealthController, AuthController, AdminsController, DashboardController, UsersController,
    ProfessionalsController, CatalogController, InterventionsController, FinanceController,
    MarketplaceController, DirectoryController, ModerationController, AuditController, UploadsController, EventsController, OperationsController, AccountingController,
  ],
  providers: [AuthService, FinanceService],
})
export class AdminModule {}

@Module({
  imports: [
    DatabaseModule,
    SharedModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AdminModule,
    ClientModule,
    ProModule,
    RouterModule.register([
      { path: 'admin', module: AdminModule },
      { path: 'client', module: ClientModule },
      { path: 'pro', module: ProModule },
    ]),
  ],
  providers: [
    // Ordre : limitation de débit, puis sessions (chaque garde ne traite que son espace).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_GUARD, useClass: ClientGuard },
    { provide: APP_GUARD, useClass: ProGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
