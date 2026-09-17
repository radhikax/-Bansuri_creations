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
