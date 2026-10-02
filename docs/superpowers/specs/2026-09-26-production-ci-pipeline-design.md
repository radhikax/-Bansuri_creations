# Production CI Pipeline — Design Spec

**Date:** 2026-09-26
**Status:** Approved in brainstorming, pending written-spec review
**Branch:** `worktree-storefront-data-wiring` (mirrored to `feature/storefront-admin-hardening`, PR #5)

## Purpose

Turn the basic CI added on 2026-09-26 (`.github/workflows/ci.yml`: frontend tests
and build, backend tests with Postgres, Playwright e2e; green on PR #5) into a
**deploy-ready pipeline**. Every commit on `main` should produce tested, linted,
security-scanned Docker images that can be deployed to any container host.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Hosting | Undecided, so **stay portable**: an API image **and** a frontend image (nginx), plus a production `docker-compose.yml` |
| Registry | **GitHub Container Registry**, using the built-in `GITHUB_TOKEN`. Images are published only from `main` and `v*` tags. |
| Gate strictness | **Strict.** Every existing lint and type error gets fixed. High or critical vulnerabilities in production dependencies fail CI. |
| Workflow layout | One main `ci.yml` with a job graph, plus `codeql.yml` and `.github/dependabot.yml` |

## Out of scope

- **CD and deployment** (stage 9): choosing a host, HTTPS/TLS, deploying on
  merge, production database provisioning, backups. They get their own spec once a
  host is picked.
- **Format enforcement (Prettier).** It would reformat nearly every file in one
  diff; that's a separate small change later.
- **Changing GitHub repository settings.** Branch protection, secret scanning and
  push protection are documented as steps for the owner; CI doesn't configure them.
- The checkout feature (its brainstorm is paused and resumes after this).

---

## 1. Quality and security gates

### Linting (ESLint 9, flat config)

- **Frontend: root `eslint.config.js`**
  - Rules: `@eslint/js` recommended, `typescript-eslint` recommended,
    `eslint-plugin-react-hooks` recommended.
  - Ignores: `dist/`, `coverage/`, `test-results/`, `playwright-report/`,
    `server/` (it has its own config), `src/app/components/ui/**` and
    `src/app/components/figma/**`. The last two are the vendored shadcn/Figma
    template, which the coverage config already excludes for the same reason.
- **Backend: `server/eslint.config.js`** with `@eslint/js` recommended and
  `typescript-eslint` recommended. It ignores `dist/` and `coverage/`.
- **Scripts:** `"lint": "eslint ."` in the root and in `server/package.json`.
- **Every existing lint error is fixed as part of this work.** Lint errors fail CI.
  A rule may be switched off only with a one-line comment in the config
  explaining why. Inline `eslint-disable` comments need a reason.

### Frontend type-check

- Add dev dependency `typescript` (same major as `server/`).
- **Root `tsconfig.json` settings:**
  - `strict`, `noEmit`, `skipLibCheck`, `isolatedModules`
  - `target` `ES2022`, `module` `ESNext`, `moduleResolution` `bundler`, `jsx` `react-jsx`
  - `lib` `["ES2022","DOM","DOM.Iterable"]`
  - `types` `["vite/client","vitest/globals","@testing-library/jest-dom"]`
  - `paths` `{"@/*":["src/*"]}`
  - `include` `["src","e2e","playwright.config.ts","vite.config.ts"]`
- **Script:** `"typecheck": "tsc --noEmit"`. The backend gets `"typecheck": "tsc --noEmit"` too.
- **Fix the 7 existing type errors** found in brainstorming, in
  `src/main.tsx`, `src/app/pages/ProductDetailPage.tsx`,
  `src/app/components/ProductCard.tsx` and `src/app/components/ui/refs.test.tsx`,
  plus anything else the final config surfaces.

### Dependency security

- **Upgrades now:**
  - `express` to the latest **4.x**. This fixes the body-parser, cookie and path-to-regexp advisories without Express 5's breaking changes.
  - `react-router-dom` to the latest **7.x**.
  - Every existing test suite must still pass afterwards.
- **Gate:** `npm audit --omit=dev --audit-level=high` for the root and for
  `server/` fails CI on high or critical advisories in production dependencies.
  Dev-dependency advisories print as a non-blocking report
  (`npm audit --audit-level=high || true`, in a separate step).
- **`.github/workflows/codeql.yml`:** GitHub CodeQL for `javascript-typescript`
  on pull requests, pushes to `main`, and weekly (Monday 03:00 UTC).
  Permissions: `security-events: write`, `contents: read`.
- **`.github/dependabot.yml`:** weekly updates for `npm` (`/`), `npm`
  (`/server`), `docker` (`/` and `/server`) and `github-actions` (`/`).
  Minor and patch updates are grouped into one PR per ecosystem and directory,
  and each ecosystem has at most 5 open PRs.

---

## 2. Docker images and the production stack

### API image: `server/Dockerfile` (multi-stage)

1. **`deps`:** `node:24-bookworm-slim`, `apt-get install -y openssl`, then `npm ci`.
2. **`build`:** copy the source, run `npx prisma generate` and `npm run build`
   (`tsc` → `dist/`).
3. **`runtime`:** a fresh `node:24-bookworm-slim` with `openssl`.
   - `npm ci --omit=dev`, then copy in `dist/`, `prisma/` (schema and
     migrations) and the generated Prisma client (`node_modules/.prisma`)
     from `build`.
   - `ENV NODE_ENV=production`, `USER node`, `EXPOSE 4000`.
   - `HEALTHCHECK` using `node -e` to fetch `http://localhost:4000/api/health`.
   - `CMD ["node","dist/index.js"]`.
- **`prisma` moves from `devDependencies` to `dependencies`.** Production needs
  the CLI for `prisma migrate deploy`.
- **Migrations never run on container start.** They run as a one-off step (see
  compose `migrate` below; on managed hosts, their release command).
- **The same image runs the abandoned-order job:**
  `node dist/jobs/cancelAbandonedOrders.js`.
- **Seeding is not baked in** (the seed script needs dev-only `tsx`). The first
  production seed is a documented one-off command run from a dev machine
  against the production `DATABASE_URL`.

### Frontend image: root `Dockerfile` (multi-stage)

1. **`build`:** `node:24-bookworm-slim`, `npm ci`, `npm run build`, with
   `VITE_API_BASE_URL` unset so the app calls `/api` on its own origin.
2. **`runtime`:** `nginxinc/nginx-unprivileged:1.27-alpine` (non-root, port 8080),
   serving `dist/` with `deploy/nginx/default.conf.template`:
   - `location /api/` → `proxy_pass ${API_UPSTREAM}` (env var, default
     `http://api:4000`), passing `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`.
   - SPA fallback: `try_files $uri $uri/ /index.html`.
   - `/assets/` → `Cache-Control: public, max-age=31536000, immutable`.
     `index.html` → `no-cache`.
   - gzip for text, JS, CSS and JSON.
   - Headers: `X-Content-Type-Options: nosniff`,
     `Referrer-Policy: strict-origin-when-cross-origin`,
     `X-Frame-Options: SAMEORIGIN`.
   - `HEALTHCHECK` with `wget -qO- http://localhost:8080/`.

### `.dockerignore` files (root and `server/`)

Exclude `node_modules`, `dist`, `coverage`, `test-results`, `playwright-report`,
`.env*` (except `.env*.example`), `.git`, `.github`, `.claude`, `.superpowers`,
`e2e`, `**/*.test.ts(x)`, `server/tests`, and the other project's directory. The
root context excludes `server/`; the server context has no access to the root.

### `docker-compose.prod.yml` (root)

| Service | Image | Notes |
|---|---|---|
| `postgres` | `postgres:16-alpine` | named volume `pgdata-prod`, health check `pg_isready` |
| `migrate` | `${API_IMAGE:-ghcr.io/radhikax/bansuri-api:latest}` | `command: npx prisma migrate deploy`, `restart: "no"`, depends on a healthy `postgres` |
| `api` | same as `migrate` | depends on `migrate` completing successfully; `env_file: .env.production` |
| `web` | `${WEB_IMAGE:-ghcr.io/radhikax/bansuri-web:latest}` | `ports: ["8080:8080"]`, `API_UPSTREAM=http://api:4000`, depends on a healthy `api` |

- Each app service has a `build:` section too, so
  `docker compose -f docker-compose.prod.yml up -d --build` works without the registry.
- **`.env.production.example` (committed)** lists every variable with a comment:
  `DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `FRONTEND_ORIGIN`,
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
  `RESEND_API_KEY`, `STORE_EMAIL_FROM`, `STORE_OWNER_EMAIL`.
- **`.env.production` is never committed.** The root `.gitignore` already
  ignores `.env` and `.env.*.local`; add `.env.production`.

---

## 3. Pipeline flow, startup check and releases

### `ci.yml` job graph

These jobs run in parallel:

- **`quality`:**
  - `npm ci` (root and `server/`)
  - `npm run lint` and `npm run typecheck` in both
  - the production `npm audit` gates, plus the non-blocking dev-dependency report
- **`frontend-test`:** `npm test`, `npm run build` (as today).
- **`backend-test`:** Postgres service, `prisma generate`, `prisma migrate deploy`,
  `npm test` (as today).
- **`e2e`:** Playwright against the dev servers (as today), with an artifact
  upload on failure.
- **`docker`:**
  - Build both images with `docker/build-push-action` and the `type=gha` layer
    cache, loaded locally, not pushed.
  - **Trivy** (`aquasecurity/trivy-action`) scans both images with
    `severity: HIGH,CRITICAL`, `ignore-unfixed: true` and `exit-code: 1`.
  - **Smoke test:** `docker compose -f docker-compose.prod.yml up -d` using the
    just-built image tags and a CI env file with dummy values (`NODE_ENV` is
    production, so the startup check runs with valid dummies). Then wait until
    `web` is healthy (at most 120 s) and check:
    1. `GET http://localhost:8080/` → 200 and HTML
    2. `GET http://localhost:8080/api/health` → `{"status":"ok"}`, through the nginx proxy
    3. `GET http://localhost:8080/api/categories` → 200 JSON array (proves migrations ran)
    4. `GET http://localhost:8080/admin/settings` → 200 HTML (SPA fallback)

    On failure it prints `docker compose logs`. It always runs `down -v`.

Then:

- **`ci-success`:** needs all five jobs above; one stable check name for branch protection.
- **`publish`:** `needs: ci-success`, and runs only when
  `github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))`.
  - `permissions: { contents: read, packages: write }`. All other jobs have
    `contents: read` only.
  - It logs in to `ghcr.io` with `GITHUB_TOKEN` and builds and pushes both images
    (reusing the GHA cache) as `ghcr.io/radhikax/bansuri-api` and
    `ghcr.io/radhikax/bansuri-web`. The names are lowercase because the repo name
    `-Bansuri_creations` isn't a valid image name.
  - Tags come from `docker/metadata-action`:
    - on `main`: `sha-<short>` and `main`
    - on a `vX.Y.Z` tag: `X.Y.Z`, `X.Y` and `latest`
  - OCI labels link each image to the repository.
- **Triggers:** add `tags: ['v*']` to `on.push`, next to `branches: [main]`, and
  keep `pull_request`. `concurrency` is unchanged.

### Startup environment check: `server/src/config/env.ts`

- A zod schema, validated in `server/src/index.ts` before `app.listen`.
- **Always required:** `DATABASE_URL` (non-empty) and `JWT_SECRET` (non-empty).
- **When `NODE_ENV === 'production'`, also required:**
  - `JWT_SECRET` of at least 32 characters
  - `FRONTEND_ORIGIN` as a URL
  - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, all non-empty
- **Optional:** `RESEND_API_KEY`, `STORE_EMAIL_FROM`, `STORE_OWNER_EMAIL`, `PORT`.
- **On failure:** print `Invalid environment configuration:` followed by one line
  per problem, naming the variable and the rule and **never the value**, then
  `process.exit(1)`.
- Exported as `validateEnv(env = process.env)` for unit tests. `app.ts` doesn't
  import it, so the existing supertest suites are unaffected.

### Releases (README "Releasing" section)

- Merging to `main` publishes the `main` and `sha-…` images.
- `git tag vX.Y.Z && git push origin vX.Y.Z` publishes `X.Y.Z`, `X.Y` and `latest`.
- Deploying means pulling a tag. For compose, set `API_IMAGE`/`WEB_IMAGE` to the
  tag, then run `docker compose -f docker-compose.prod.yml up -d`.

### Owner steps after merge (documented, not automated)

1. **Branch protection** on `main`: require the `ci-success` check and PRs before merging.
2. **Secret scanning and push protection:** Settings → Code security → enable both.
3. **GHCR package visibility:** the first publish creates the packages. Set them to
   public or private under the repo's Packages.

---

## 4. Testing

- **Unit tests for `validateEnv`:**
  - development with only `DATABASE_URL` and `JWT_SECRET` passes
  - a missing `DATABASE_URL` fails and names it
  - production with a short `JWT_SECRET` fails
  - production with a missing Razorpay key fails
  - the error output never contains a variable's value
- **The pipeline tests itself:**
  - the PR run must show `quality`, `frontend-test`, `backend-test`, `e2e`,
    `docker` and `ci-success` green
  - `publish` is skipped on the PR
- **Local check before pushing:** `docker compose -f docker-compose.prod.yml up -d --build`
  with a local `.env.production` built from the example, then the same four
  smoke-test requests.

## Definition of done

- All `ci.yml` jobs are green on PR #5, including lint, type-check, both audit
  gates, Trivy and the compose smoke test. `codeql.yml` is green.
- The existing suites still pass: frontend 192, backend 142 plus the new
  `validateEnv` tests, e2e 10.
- The README covers CI stages, running the production stack locally, releasing,
  and the owner's GitHub settings steps.
- After merge, the first push to `main` publishes both images to GHCR (checked
  by the owner, since publishing can't run on a PR).
