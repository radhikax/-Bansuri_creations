import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E_DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from './env';

export default function globalSetup() {
  // Guard: never reset anything but a dedicated e2e database.
  if (!/\/ecommerce_e2e(\?|$)/.test(E2E_DATABASE_URL)) {
    throw new Error(`Refusing to reset ${E2E_DATABASE_URL}: e2e tests only run against the ecommerce_e2e database.`);
  }
  // Drops, re-migrates and re-seeds, so every run starts from the seed data
  // (the seed's admin upsert never resets an existing password).
  execSync('npx prisma migrate reset --force', {
    cwd: fileURLToPath(new URL('../server', import.meta.url)),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      SEED_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD,
    },
  });
}
