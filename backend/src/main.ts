import 'dotenv/config';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

const FRONTEND_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

async function bootstrap() {
  // Disable NestJS built-in body parser so our custom 60 MB limit is the only one active.
  // Without this, NestJS adds its own 1 MB parser AFTER ours and that parser rejects large uploads.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const express = require('express');
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ limit: '60mb', extended: true }));

  // Trust the first proxy hop so req.ip is the real client IP, not the proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
  app.use(helmet());

  // CORS: always allow localhost dev origins; additional origins via EXTRA_ORIGINS env var.
  // Set EXTRA_ORIGINS=http://192.168.1.100:5173,http://192.168.1.100:3000 instead of hardcoding IPs.
  const extraOrigins = process.env.EXTRA_ORIGINS
    ? process.env.EXTRA_ORIGINS.split(',').map(o => o.trim()).filter(o => /^https?:\/\//.test(o))
    : [];
  const allowedOrigins = [
    process.env.FRONTEND_ORIGIN,
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://127.0.0.1:5175',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    ...extraOrigins,
  ].filter(o => !!o && /^https?:\/\//.test(o));   // only valid HTTP(S) origins

  if (!allowedOrigins.length) {
    console.warn('[SECURITY] No valid FRONTEND_ORIGIN set — CORS will block all cross-origin requests');
  }

  app.setGlobalPrefix('api');
  app.enableCors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true });

  // SPA fallback: GET requests that aren't API routes → index.html for React Router deep links.
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.use((_req: any, res: any, next: any) => {
    if (_req.method !== 'GET') return next();
    if (_req.path.startsWith('/api')) return next();
    res.sendFile(join(FRONTEND_DIST, 'index.html'));
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
