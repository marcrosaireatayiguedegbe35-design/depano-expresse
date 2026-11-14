import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { config } from './config';

async function bootstrap() {
  const app = setupApp(await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] }));
  app.enableShutdownHooks();
  await app.listen(config.port);
  Logger.log(`API prête sur http://localhost:${config.port} (/admin, /client, /pro) (base : ${config.mongoDb})`, 'Bootstrap');
}

bootstrap();
