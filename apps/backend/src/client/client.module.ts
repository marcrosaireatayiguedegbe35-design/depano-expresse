import { ClientPushController } from './push.controller';
import { Module } from '@nestjs/common';
import { ClientAuthController } from './auth.controller';
import { ClientAccountController } from './account.controller';
import { ClientServicesController } from './services.controller';
import { ClientShopController } from './shop.controller';
import { ClientCallsController } from './calls.controller';
import { ClientConversationsController } from './conversations.controller';

/** Espace clients (site web et application mobile) : toutes ses routes sont servies sous /client. */
@Module({
  controllers: [ClientAuthController, ClientAccountController, ClientServicesController, ClientShopController, ClientCallsController, ClientConversationsController, ClientPushController],
})
export class ClientModule {}
