import { mkdirSync } from 'fs';
import { join } from 'path';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

// Not shared with ProfileService — it computes the same path independently
// to avoid importing from main.ts (would create a module load cycle back
// through AppModule).
const UPLOADS_DIR = join(process.cwd(), 'uploads');

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  // @fastify/cors defaults `methods` to 'GET,HEAD,POST' (narrower than the
  // Express `cors` package's default) — without this, every PATCH/PUT/DELETE
  // request from the browser fails its CORS preflight app-wide.
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Local disk storage for user-uploaded files (avatars, product media,
  // etc.) — no object-storage/CDN integration exists yet, so the API serves
  // its own uploads directory statically. 5MB cap matches both use cases.
  mkdirSync(join(UPLOADS_DIR, 'avatars'), { recursive: true });
  mkdirSync(join(UPLOADS_DIR, 'products'), { recursive: true });
  // Casts: @nestjs/platform-fastify pins its own nested `fastify` copy
  // (5.11.0) separate from this workspace's (5.11.3) — structurally
  // identical, but TS sees two distinct FastifyInstance types and rejects
  // the plugin's type without this. Harmless at runtime.
  await app.register(fastifyMultipart as never, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(fastifyStatic as never, { root: UPLOADS_DIR, prefix: '/uploads/' });

  const port = config.get<number>('port')!;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`ChrisPa API listening on http://localhost:${port}/api/v1`);
}
bootstrap();
