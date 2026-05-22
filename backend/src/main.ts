import 'dotenv/config';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

const FRONTEND_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust the first proxy hop so req.ip is the real client IP, not the proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
  app.use(helmet());

  // CORS: always allow localhost dev origins; additional origins via EXTRA_ORIGINS env var.
  // Set EXTRA_ORIGINS=http://192.168.1.100:5173,http://192.168.1.100:3000 instead of hardcoding IPs.
  const extraOrigins = process.env.EXTRA_ORIGINS
    ? process.env.EXTRA_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];
  const allowedOrigins = [
    process.env.FRONTEND_ORIGIN,
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://127.0.0.1:5175',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    ...extraOrigins,
  ].filter(Boolean);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: allowedOrigins, credentials: true });

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
