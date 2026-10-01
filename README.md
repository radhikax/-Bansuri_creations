
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

  Every pull request and every push to `main` (and `v*` tag) runs
  `.github/workflows/ci.yml`:

  | Job | What it proves |
  |---|---|
  | Quality | ESLint (web + API, zero warnings), `tsc` type-checks, `npm audit` gate on production deps (high+) |
  | Frontend | Vitest unit tests, production build |
  | Backend | Migrations on a fresh Postgres 16, Vitest suites |
  | Browser tests | Playwright + Chromium end-to-end (screenshots/traces uploaded on failure) |
  | Docker | Builds both images, Trivy scan (fixable HIGH/CRITICAL fail), smoke-tests the full compose stack through nginx |
  | ci-success | One check that is green only if all of the above are — require it in branch protection |
  | Publish images | Only on `main` / `v*` tags: pushes `ghcr.io/radhikax/bansuri-api` and `bansuri-web` |

  CodeQL (`codeql.yml`) scans the code on PRs and weekly; Dependabot opens
  weekly grouped update PRs for npm, Docker base images and Actions.
  CI uses dummy, non-secret values only.

  ## Running the production stack

  1. `cp .env.production.example .env.production` and fill it in (never commit it).
  2. `docker compose -f docker-compose.prod.yml up -d` pulls the published images
     (add `--build` to build locally). The `migrate` service applies migrations
     before `api` starts; the shop is on http://localhost:8080.
  3. First-time data is loaded once, after `migrate` has run, by a throwaway Node
     container on the stack's network using the repo's `server/` folder, with required
     admin credentials (never the defaults). Run from the repo root; it reads values
     from `.env.production` for the DB password and requires the two SEED vars to be
     exported first:

     ```bash
     export SEED_ADMIN_EMAIL=you@yourdomain.com
     export SEED_ADMIN_PASSWORD='a-long-unique-password'
     docker run --rm --network bansuri_default \
       -v "$PWD/server:/app" -w /app \
       --env-file .env.production \
       -e DATABASE_URL="postgresql://ecommerce:<POSTGRES_PASSWORD>@postgres:5432/ecommerce" \
       -e SEED_ADMIN_EMAIL -e SEED_ADMIN_PASSWORD \
       node:24-bookworm-slim sh -c "npm ci && npx prisma generate && npx tsx prisma/seed.ts"
     ```

     Replace `<POSTGRES_PASSWORD>` with the value from `.env.production` (or reuse its
     `DATABASE_URL`, which already points at `postgres:5432`). The seed is idempotent
     (re-running it never changes an existing admin's password); never run it without
     `SEED_ADMIN_PASSWORD` set, or the admin gets the public default. Then log in at
     `/admin` and confirm under Settings → Account.
  4. Schedule the abandoned-order job hourly:
     `docker compose -f docker-compose.prod.yml run --rm api node dist/jobs/cancelAbandonedOrders.js`.
  5. Serve it over HTTPS (host platform or a reverse proxy) — the admin cookie is `secure` in production.

  The API refuses to start if required configuration is missing (it prints the
  variable names, never their values).

  ## Releasing

  - Merging to `main` publishes images tagged `main` and `sha-<commit>`.
  - `git tag v1.0.0 && git push origin v1.0.0` publishes `1.0.0`, `1.0` and `latest`.
  - To deploy a version with compose, set `API_IMAGE`/`WEB_IMAGE` to that tag and run
    `docker compose -f docker-compose.prod.yml up -d`.

  ## One-time GitHub settings (repository owner)

  1. **Branch protection** for `main` (Settings → Branches): require a pull request and
     the `ci-success` status check.
  2. **Secret scanning + push protection** (Settings → Code security): enable both.
  3. **Package visibility**: after the first publish, set the two packages under the
     repository's Packages to public or private as preferred.
