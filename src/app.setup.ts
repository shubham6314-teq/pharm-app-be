import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import {
  getUploadsRoot,
  UPLOADS_PUBLIC_PREFIX,
} from './storage/storage.constants.js';

export const API_PREFIX = 'api';
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

export function parseFrontendOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : [DEFAULT_FRONTEND_ORIGIN];
}

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
  app.use(cookieParser());
  app.enableCors({
    origin: parseFrontendOrigins(config.get<string>('FRONTEND_ORIGIN')),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const uploadsRoot = getUploadsRoot(config.get<string>('UPLOADS_DIR'));
  mkdirSync(uploadsRoot, { recursive: true });

  (app as NestExpressApplication).useStaticAssets(uploadsRoot, {
    prefix: `${UPLOADS_PUBLIC_PREFIX}/`,
  });
}
