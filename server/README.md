# Decor E-Commerce API

Express + TypeScript REST API for the storefront: products, categories,
guest checkout orders, Razorpay payments, and an admin panel backend.

## Local development

1. `docker compose up -d` — starts Postgres in Docker.
2. `docker compose exec postgres createdb -U ecommerce ecommerce_test` — one-time test DB creation.
3. Copy `.env.example` to `.env` and fill in real values (Razorpay test keys, Resend key).
4. Copy `.env.example` to `.env.test`, point `DATABASE_URL` at `ecommerce_test` instead of `ecommerce_dev`.
5. `npm install`
6. `npx prisma migrate dev` — applies migrations to the dev database.
7. `npm run prisma:seed` — loads sample categories/products and creates the admin user (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars, defaults to `admin@example.com` / `changeme123` — change this in production).
8. `npm run dev` — starts the API on `http://localhost:4000`.

## Testing

`npm test` runs the full Vitest suite against the `ecommerce_test` Postgres
database (via `.env.test`). Tests reset relevant tables in `beforeEach`
blocks, so they can be run repeatedly without manual cleanup.

## Deployment (free-tier target)

1. Create a Postgres database on Neon or Supabase (free tier) for production.
2. Deploy this `server/` directory to Render or Railway (free tier):
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Environment variables: same keys as `.env.example`, with real production
     values (`DATABASE_URL` from Neon/Supabase, live Razorpay keys, Resend key,
     `FRONTEND_ORIGIN` set to the deployed frontend's URL, `NODE_ENV=production`).
3. Run `npx prisma migrate deploy` against the production `DATABASE_URL` once
   (via the platform's shell/console, or a one-off deploy hook) before first use.
4. Run `npm run prisma:seed` once against production to load initial products
   and create the real admin user — then change the seeded admin password
   via a direct login + a future admin "change password" flow, or by
   re-seeding with different `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
5. In the Razorpay dashboard, configure the webhook URL to
   `https://<your-deployed-api>/api/orders/razorpay-webhook` and set the
   webhook secret to match `RAZORPAY_WEBHOOK_SECRET`.
6. Schedule `node dist/jobs/cancelAbandonedOrders.js` to run hourly using
   the hosting platform's cron/scheduled-job feature (Render Cron Jobs or
   Railway Cron), pointed at the production environment variables.

## Known limitations for cross-origin frontend deployment

If the admin frontend ends up deployed on a different origin from this API
(the topology this deployment section sets up via `FRONTEND_ORIGIN` +
CORS `credentials: true`), two things need to be resolved before the admin
panel will actually work, before wiring up that frontend:

- The `admin_session` cookie is currently set with `sameSite: 'lax'`
  (`src/routes/admin/auth.routes.ts`). Browsers do not attach `Lax` cookies
  to cross-origin `fetch`/XHR requests, only to top-level navigations — so
  a cross-origin admin frontend calling this API with
  `credentials: 'include'` will get a correct login response but no cookie
  on subsequent requests, and every admin route will 401. This needs
  `sameSite: 'none'` + `secure: true` (or a same-origin/proxied topology)
  once the real deployment shape is decided.
- Express 4 (used here) does not forward a rejected promise from an `async`
  route handler to error-handling middleware. Most routes have no
  try/catch, so an unexpected failure (a Prisma error, a Razorpay/Resend
  outage) can hang the request or crash the process instead of returning a
  clean 500. The Razorpay webhook handler was hardened against this; the
  rest of the routes were not.

Neither is a regression from anything already built — both are open
follow-ups for whoever picks up the frontend-integration plan.
