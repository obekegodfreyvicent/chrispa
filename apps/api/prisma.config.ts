import { defineConfig } from 'prisma/config';

// Prisma's config-file mode disables its old auto-dotenv-loading — load .env
// ourselves via Node's built-in loader (Node 20.6+) instead of adding a
// `dotenv` dependency just for this.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file (e.g. CI, where DATABASE_URL is set directly) — fine.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node -r ts-node/register prisma/seed.ts',
  },
});
