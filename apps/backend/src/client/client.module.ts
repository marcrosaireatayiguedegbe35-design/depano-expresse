import { Module } from '@nestjs/common';
import { ClientAuthController } from './auth.controller';
import { ClientAccountController } from './account.controller';
import { ClientServicesController } from './services.controller';
import { ClientShopController } from './shop.controller';

/** Espace clients (site web et application mobile) : toutes ses routes sont servies sous /client. */
@Module({
  controllers: [ClientAuthController, ClientAccountController, ClientServicesController, ClientShopController],
})
export class ClientModule {}
