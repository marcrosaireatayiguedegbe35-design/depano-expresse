import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';

/**
 * Point d'entrée Vercel : l'application Nest est créée une seule fois par instance
 * (connexion MongoDB réutilisée entre les requêtes), puis chaque requête lui est transmise.
 */
let server: express.Express | null = null;
let booting: Promise<express.Express> | null = null;

async function getServer() {
  if (server) return server;
  if (!booting) {
    booting = (async () => {
      const instance = express();
      const app = setupApp(await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(instance), { logger: ['error', 'warn'] }));
      await app.init();
      server = instance;
      return instance;
    })().catch((e) => { booting = null; throw e; });
  }
  return booting;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getServer();
  app(req as any, res as any);
}
