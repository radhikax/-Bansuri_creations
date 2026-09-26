
  # Ecommerce Website for Decor

  This is a code bundle for Ecommerce Website for Decor. The original project is available at https://www.figma.com/design/XYduaxMyvRiSVLCTFUUOxA/Ecommerce-Website-for-Decor.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Browser smoke tests (Playwright)

  One-time setup (Postgres running via `cd server && docker compose up -d`):

  - `cd server && docker compose exec postgres createdb -U ecommerce ecommerce_e2e`
  - `npx playwright install chromium`

  Run `npm run e2e`. It resets and re-seeds the separate `ecommerce_e2e`
  database, starts its own API on port 4000 (stop your dev API first — the run
  fails fast if the port is busy, so it can never touch `ecommerce_dev`), and
  starts or reuses the Vite dev server on port 5173. Failure screenshots and
  traces land in `test-results/`.
  
  ## Continuous integration

  Every pull request and every push to `main` runs `.github/workflows/ci.yml`
  on GitHub Actions, as three parallel jobs:

  - **Frontend** — `npm test` and `npm run build`
  - **Backend** — `prisma migrate deploy`, `npm test` and `tsc --noEmit`
    against a fresh Postgres 16 service container
  - **Browser tests** — `npm run e2e` (Playwright + Chromium) against its own
    Postgres container; failure screenshots/traces are uploaded as the
    `playwright-results` artifact

  CI uses Node from `.nvmrc` and dummy, non-secret environment values — real
  Razorpay/Resend keys are never needed or stored in CI.
