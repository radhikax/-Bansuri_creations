export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_e2e';

// Seed credentials, passed explicitly so a SEED_ADMIN_* value in server/.env can't change them.
export const SEED_ADMIN_EMAIL = 'admin@example.com';
export const SEED_ADMIN_PASSWORD = 'changeme123';

export const API_ORIGIN = 'http://localhost:4000';
