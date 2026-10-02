
  # Ecommerce Website for Decor

  This is a code bundle for Ecommerce Website for Decor. The original project is available at https://www.figma.com/design/XYduaxMyvRiSVLCTFUUOxA/Ecommerce-Website-for-Decor.

  ## Running the code

  Run `npm i` to install the dependencies (and `cd server && npm i` for the API).

  Run `npm run dev` to start the Next.js dev server on **http://localhost:5173**.
  It proxies `/api/*` to the API, which you run separately with
  `cd server && npm run dev` on **http://localhost:4000** (see `server/README.md`
  for the API's own setup, including Postgres via `server/docker-compose.yml`).

  ## Browser smoke tests (Playwright)

  One-time setup (Postgres running via `cd server && docker compose up -d`):

  - `cd server && docker compose exec postgres createdb -U ecommerce ecommerce_e2e`
  - `npx playwright install chromium`

  Run `npm run e2e`. It resets and re-seeds the separate `ecommerce_e2e`
  database, starts its own API on port 4000 (stop your dev API first — the run
  fails fast if the port is busy, so it can never touch `ecommerce_dev`), and
  starts or reuses the Next.js dev server on port 5173. Failure screenshots and
  traces land in `test-results/`.

  ## API contract

  The API publishes its OpenAPI schema at `server`'s `/api/openapi.json`, with
  an interactive explorer at `/api/docs` (dev only — not mounted when
  `NODE_ENV=production`). The web app never hand-writes request/response
  types: `npm run api:types` regenerates `src/lib/api/schema.d.ts` from that
  schema, and `npm run api:check` (run in CI as part of the `Quality` job) fails
  the build if the committed schema or generated types have drifted from the
  server's zod definitions. After changing an API route's request/response
  shape, run `npm --prefix server run openapi:generate && npm run api:types`
  and commit the results.
  
  ## Continuous integration

  Every pull request and every push to `main` (and `v*` tag) runs
  `.github/workflows/ci.yml`:

  | Job | What it proves |
  |---|---|
  | Quality | ESLint (web + API, zero warnings), `tsc` type-checks, `npm audit` gate on production deps (high+) |
  | Frontend | Vitest unit tests, production build |
  | Backend | Migrations on a fresh Postgres 16, Vitest suites |
  | Browser tests | Playwright + Chromium end-to-end (screenshots/traces uploaded on failure) |
  | Docker | Builds both images — the web image is a Next.js standalone server (port 8080) — Trivy scan (fixable HIGH/CRITICAL fail), smoke-tests the full compose stack |
  | ci-success | One check that is green only if all of the above are — require it in branch protection |
  | Publish images | Only on `main` / `v*` tags: pushes `ghcr.io/radhikax/bansuri-api` and `bansuri-web` |

  CodeQL (`codeql.yml`) scans the code on PRs and weekly; Dependabot opens
  weekly grouped update PRs for npm, Docker base images and Actions.
  CI uses dummy, non-secret values only.

  ## Running the production stack

  1. `cp .env.production.example .env.production` and fill it in (never commit it).
     This includes `REVALIDATE_SECRET` (shared between `api` and `web`, so the API
     can tell the web container to refresh a page after an edit), `WEB_INTERNAL_URL`
     (`http://web:8080`, how the API reaches the web container), and
     `NEXT_PUBLIC_SITE_URL` (the public shop URL — baked into the client bundle at
     *build* time, so it must also be passed as a `docker compose build` arg when you
     build locally, not just set in the env file).
  2. `docker compose -f docker-compose.prod.yml up -d` pulls the published images
     (add `--build` to build locally). The `migrate` service applies migrations
     before `api` starts; the shop is on http://localhost:8080.
  3. First-time data is loaded once, after `migrate` has run, by a throwaway Node
     container on the stack's network using the repo's `server/` folder, with required
     admin credentials (never the defaults). Run from the repo root. The `:?` guards
     below fail your shell immediately if either variable isn't exported — that's what
     actually enforces the credentials in this flow, because the command also passes
     `NODE_ENV=development` (see below), so the seed script's own production check
     doesn't fire here:

     ```bash
     export SEED_ADMIN_EMAIL=you@yourdomain.com
     export SEED_ADMIN_PASSWORD='a-long-unique-password'

     : "${SEED_ADMIN_EMAIL:?export SEED_ADMIN_EMAIL first}"
     : "${SEED_ADMIN_PASSWORD:?export SEED_ADMIN_PASSWORD first}"

     docker run --rm --network bansuri_default \
       -v "$PWD/server:/app" -v /app/node_modules \
       -w /app --env-file .env.production \
       -e NODE_ENV=development \
       -e SEED_ADMIN_EMAIL -e SEED_ADMIN_PASSWORD \
       node:24-bookworm-slim sh -c "npm ci --include=dev && npx prisma generate && npx tsx prisma/seed.ts"
     ```

     Notes on this command:
     - `-v /app/node_modules` is an anonymous volume that shadows the bind-mounted
       path, so `npm ci` installs into a container-private volume instead of
       overwriting your host checkout's `server/node_modules` (which would otherwise
       get replaced with Linux native builds, e.g. `bcrypt`, breaking local
       `npm run dev` / `npm test` afterward).
     - `-e NODE_ENV=development` overrides the `NODE_ENV=production` that
       `--env-file .env.production` would otherwise load. It's needed so `npm ci
       --include=dev` installs devDependencies — including `tsx`, which runs the
       seed script — since npm skips them under `NODE_ENV=production`. The seed
       script itself only refuses the default admin credentials when
       `NODE_ENV==='production'`; because this command passes
       `NODE_ENV=development`, that script-level guard does **not** apply here — the
       `:?` guards above are what actually require `SEED_ADMIN_EMAIL` and
       `SEED_ADMIN_PASSWORD` to be set in this flow.
     - No `DATABASE_URL` override is needed or passed; `--env-file .env.production`
       already supplies the correct one.

     The seed is idempotent (re-running it never changes an existing admin's
     password). Then log in at `/admin` and confirm under Settings → Account.
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
