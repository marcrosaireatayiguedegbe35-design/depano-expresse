import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { firewall } from './common/firewall';
import { config } from './config';

/** Configuration de l'application (sécurité, analyse des requêtes, validation). */
export function setupApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(firewall()); // avant tout le reste : adresse réelle via le relais, puis refus des robots et sondes
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true } }));
  app.use(cookieParser());
  app.enableCors({ origin: [config.adminOrigin, config.clientOrigin, config.proOrigin], credentials: true });
  app.useBodyParser('json', { limit: '200kb' });
  app.useBodyParser('urlencoded', { limit: '50kb', extended: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
  return app;
}
