import { Module } from '@nestjs/common';
import { ProAuthController } from './auth.controller';
import { ProWorkController } from './work.controller';
import { ProCallsController } from './calls.controller';
import { ProConversationsController } from './conversations.controller';

/** Espace professionnels (site pro) : toutes ses routes sont servies sous /pro. */
@Module({ controllers: [ProAuthController, ProWorkController, ProCallsController, ProConversationsController] })
export class ProModule {}
