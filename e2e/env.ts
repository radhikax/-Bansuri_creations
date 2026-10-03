export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_e2e';

// Seed credentials, passed explicitly so a SEED_ADMIN_* value in server/.env can't change them.
export const SEED_ADMIN_EMAIL = 'admin@example.com';
export const SEED_ADMIN_PASSWORD = 'changeme123';

// admin.spec.ts changes the seed password to this value and never changes it back (by
// design — it proves the old password stops working). Playwright doesn't guarantee
// admin.spec.ts and seo.spec.ts run in a particular order relative to each other
// (both workers: 1 and alphabetical order would in fact run admin.spec.ts first), so
// seo.spec.ts's own admin login tries SEED_ADMIN_PASSWORD then falls back to this,
// rather than assuming a fragile cross-file run order.
export const CHANGED_ADMIN_PASSWORD = 'e2e-new-password-1';

export const API_ORIGIN = 'http://localhost:4000';

// Shared by both webServers in playwright.config.ts and by seo.spec.ts, which
// calls POST /internal/revalidate itself.
export const E2E_REVALIDATE_SECRET = 'e2e-revalidate-secret';
