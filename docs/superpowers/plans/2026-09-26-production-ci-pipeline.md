# Production CI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CI produce lint-clean, type-checked, tested, security-scanned Docker images (API + web) that are smoke-tested in CI and published to GHCR from `main` and `v*` tags.

**Architecture:**
- **Gates:** ESLint and TypeScript checks for both packages, plus `npm audit` gates, after upgrading the vulnerable dependencies.
- **Images:** a multi-stage `server/Dockerfile` (API) and a root `Dockerfile` (Vite build served by unprivileged nginx, with an `/api` proxy and SPA fallback), wired together by `docker-compose.prod.yml`.
- **Workflows:** `ci.yml` grows `quality`, `docker` (Trivy + compose smoke test), `ci-success` and `publish` jobs. `codeql.yml` and `dependabot.yml` are added.
- **Startup check:** a zod env check stops the API from booting when it's misconfigured.

**Tech Stack:** GitHub Actions, Docker (buildx), nginx 1.29 (unprivileged), Trivy, CodeQL, Dependabot, ESLint 9 (flat config), typescript-eslint 8, TypeScript 5.6, zod, Node 24.

**Spec:** `docs/superpowers/specs/2026-09-26-production-ci-pipeline-design.md`

## Global Constraints

- **Worktree and git:**
  - Work only in `C:\Users\rj816\Downloads\Ecommerce Website for Decor (3)\.claude\worktrees\storefront-data-wiring`, branch `worktree-storefront-data-wiring`.
  - **Implementers never push.** The controller pushes to `feature/storefront-admin-hardening` (PR #5).
  - Every commit message ends with a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never stage `test-results/`, `playwright-report/`, `.superpowers/` or any `.env` file other than `*.example` / `deploy/ci.env`.
- **Test suites before this plan:** frontend **192**, backend **142**, e2e **10**. They must stay green. The e2e suite needs port 4000 free: stop the dev API there, and the controller restarts it.
- **Exact versions to pin:**
  - `express` **4.22.3** (server, exact)
  - `react-router-dom` **^7.18.4** (root)
  - `eslint` / `@eslint/js` **9.39.5**
  - `typescript-eslint` **8.70.1**
  - `eslint-plugin-react-hooks` **7.1.1**
  - `globals` **17.12.0**
  - root `typescript` **5.6.2** (same as `server/`)
- **Base images:**
  - `node:24-bookworm-slim` (API and web build stages)
  - `nginxinc/nginx-unprivileged:1.29-alpine` (web runtime)
  - `postgres:16-alpine`
- **Action versions:**
  - keep the existing `actions/checkout@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v4`
  - new: `docker/setup-buildx-action@v4`, `docker/build-push-action@v7`, `docker/metadata-action@v6`, `docker/login-action@v4`, `aquasecurity/trivy-action@v0.36.0`, `github/codeql-action/*@v4`
- **Image names:** `ghcr.io/radhikax/bansuri-api` and `ghcr.io/radhikax/bansuri-web`.
- **Strict gates:**
  - lint errors **and warnings** fail (`--max-warnings=0`)
  - type errors fail
  - `npm audit --omit=dev --audit-level=high` fails on high or critical
  - Trivy fails on fixable HIGH or CRITICAL
- **Secrets:** never real ones in the repo or in CI. `deploy/ci.env` holds only obvious dummies.

### Deviations from spec wording (controller rulings)

- `nginx-unprivileged:1.27-alpine` → **`1.29-alpine`**. The spec's pin was stale, and 1.29 is the current line.
- `server/eslint.config.js` → **`server/eslint.config.mjs`**. `server/` is a CommonJS package (no `"type":"module"`), so an ESM flat config needs the `.mjs` extension.
- **npm is deleted from the API runtime image**, which keeps Trivy from flagging npm's bundled packages. The `migrate` service therefore runs `./node_modules/.bin/prisma migrate deploy` instead of `npx prisma migrate deploy`. The behaviour is the same.
- **Smoke-test configuration** comes from a committed `deploy/ci.env` of dummy values, selected with `ENV_FILE`. The spec only said "a CI env file with dummy values".

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `server/package.json`, `package.json` (+ lockfiles) | 1 | Security upgrades |
| `tsconfig.json` (new), `package.json`, `server/package.json`, 4 src files | 2 | Frontend type-check and fixes; `typecheck` scripts |
| `eslint.config.js`, `server/eslint.config.mjs` (new), any files with lint errors | 3 | Lint configs, `lint` scripts, zero errors |
| `server/src/config/env.ts` (+ test, new), `server/src/index.ts`, `server/package.json` | 4 | Startup env check; `prisma` moved to dependencies |
| `server/Dockerfile`, `server/.dockerignore`, `Dockerfile`, `.dockerignore`, `deploy/nginx/default.conf.template`, `docker-compose.prod.yml`, `.env.production.example`, `deploy/ci.env`, `.gitignore` | 5 | Images and the production stack |
| `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/dependabot.yml`, `README.md` | 6 | Pipeline, scanning, updates, docs |

---

### Task 1: Clear the high-severity production dependency advisories

**Files:** `server/package.json`, `server/package-lock.json`, `package.json`, `package-lock.json`

**Interfaces:**
- **Consumes:** nothing.
- **Produces:** `npm audit --omit=dev --audit-level=high` exits 0 in both the root and `server/` (Task 6 gates on this).

- [ ] **Step 1: Record the RED state**

Run in the root, then in `server/`: `npm audit --omit=dev --audit-level=high; echo "exit=$?"`.
Expected: a non-zero exit. The root reports `react-router`; the server reports `body-parser`, `cookie`, `path-to-regexp` (via express).

- [ ] **Step 2: Upgrade**

```bash
cd server && npm install --save-exact express@4.22.3 && cd ..
npm install react-router-dom@^7.18.4
```

- [ ] **Step 3: Re-check the audit**

Run the Step 1 commands again. Expected: `exit=0` in both.

If a **different** high or critical production advisory remains:
- upgrade that direct dependency to the lowest version that fixes it (`npm view <pkg> versions`)
- record it in the report
- never use `npm audit fix --force`, and never downgrade

If a fix needs a major-version bump of a direct dependency, stop and report NEEDS_CONTEXT.

- [ ] **Step 4: Full regression**

Run:
- `npm test` → 192 passed
- `npm run build` → clean
- `cd server && npm test && npx tsc --noEmit` → 142 passed, clean

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json server/package.json server/package-lock.json
git commit -m "fix(deps): upgrade express to 4.22.3 and react-router-dom to 7.18.4 for high-severity advisories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend type-check

**Files:**
- Create: `tsconfig.json` (root)
- Modify:
  - `package.json` (dev deps and script)
  - `server/package.json` (script)
  - `src/main.tsx`, `src/app/pages/ProductDetailPage.tsx`, `src/app/components/ProductCard.tsx`, `src/app/components/ui/refs.test.tsx`
  - any other file the final config flags

**Interfaces:**
- **Consumes:** nothing.
- **Produces:** `npm run typecheck` in the root and in `server/`, each exiting 0 (Task 6 runs them).

- [ ] **Step 1: Add TypeScript and the config**

```bash
npm install --save-dev --save-exact typescript@5.6.2
```

If `node_modules/@types/node` is missing in the root, also run `npm install --save-dev --save-exact @types/node@20.14.9` (the same version as `server/`). `vite.config.ts` uses `path` and `__dirname`.

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "e2e", "playwright.config.ts", "vite.config.ts"]
}
```

Add scripts:
- root `package.json`: `"typecheck": "tsc --noEmit"`
- `server/package.json`: `"typecheck": "tsc --noEmit"`

- [ ] **Step 2: Record the RED state**

Run: `npm run typecheck`
Expected: FAIL. Brainstorming measured **7 errors** in `src/main.tsx` (2), `src/app/pages/ProductDetailPage.tsx` (2), `src/app/components/ProductCard.tsx` (2) and `src/app/components/ui/refs.test.tsx` (1). The final config may surface a few more. Record the full list.

- [ ] **Step 3: Fix every error, changing types and not behaviour**

Rules for each fix:
- Prefer correct types to casts.
- Never use `any`, `@ts-ignore` or `@ts-expect-error` unless a one-line comment explains why no typed fix exists.
- Don't change runtime behaviour.
- A missing module declaration for an asset import (e.g. `*.png`) is fixed by `vite/client` types; if it isn't, add `src/vite-env.d.ts` containing `/// <reference types="vite/client" />`.
- For `refs.test.tsx`, the known mismatch is that `CardTitle`'s ref is cast to `HTMLDivElement` while the component is typed `HTMLHeadingElement`. Cast to `HTMLHeadingElement`.

Record each fix (file, error code, what changed) in the report.

- [ ] **Step 4: Verify**

Run:
- `npm run typecheck` → exit 0
- `cd server && npm run typecheck` → exit 0
- `npm test` → 192
- `npm run build` → clean

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json package.json package-lock.json server/package.json src
git commit -m "build: type-check the frontend with a strict root tsconfig and fix existing type errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Make sure `git add src` stages only intentional changes. Check `git status` first.)

---

### Task 3: ESLint for both packages, with zero findings

**Files:**
- Create: `eslint.config.js` (root), `server/eslint.config.mjs`
- Modify: `package.json`, `server/package.json` (dev deps and scripts), and every source file with a lint finding

**Interfaces:**
- **Consumes:** Task 2's `tsconfig.json` (not required by this config, but must stay green).
- **Produces:** `npm run lint` in the root and in `server/`, each exiting 0 with **no warnings** (Task 6 runs them).

- [ ] **Step 1: Install**

```bash
npm install --save-dev --save-exact eslint@9.39.5 @eslint/js@9.39.5 typescript-eslint@8.70.1 eslint-plugin-react-hooks@7.1.1 globals@17.12.0
cd server && npm install --save-dev --save-exact eslint@9.39.5 @eslint/js@9.39.5 typescript-eslint@8.70.1 globals@17.12.0 && cd ..
```

- [ ] **Step 2: Add the configs and scripts**

Create `eslint.config.js` (root, ESM, since the root package is `"type": "module"`):

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'server/',
      '.claude/',
      '.superpowers/',
      // Vendored shadcn/ui kit and Figma template, already excluded from coverage.
      'src/app/components/ui/**',
      'src/app/components/figma/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['e2e/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
);
```

Create `server/eslint.config.mjs`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
  },
);
```

Add scripts:
- root `package.json`: `"lint": "eslint . --max-warnings=0"`
- `server/package.json`: `"lint": "eslint . --max-warnings=0"`

- [ ] **Step 3: Record the RED state**

Run `npm run lint`, then `cd server && npm run lint`. Record the counts per rule and per file.

- [ ] **Step 4: Fix every finding**

Rules:
- Fix the code rather than silencing it.
- An inline `// eslint-disable-next-line <rule> -- <reason>` is allowed only where the pattern is intentional. For example, `useApiData`'s run-once-on-mount effect already carries a disable comment; make sure it names the rule and gives a reason.
- If a rule is wrong for this codebase as a whole (for example `@typescript-eslint/no-require-imports` on a CommonJS-only file), turn it off in the config for the narrowest file glob, with a comment explaining why. Record every such override in the report.
- `@typescript-eslint/no-explicit-any` findings in tests may become `unknown` plus narrowing, or a precise type.
- Unused variables get removed, not renamed with `_`, unless they're required positional parameters. In that case keep the `_`-prefix and set `argsIgnorePattern: '^_'` for `@typescript-eslint/no-unused-vars` in that config (both configs, if both need it).
- **No behaviour changes.**

- [ ] **Step 5: Verify**

Run:
- `npm run lint` and `cd server && npm run lint`: both exit 0
- `npm run typecheck` in both packages
- `npm test` → 192
- `cd server && npm test` → 142
- `npm run build` → clean

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js server/eslint.config.mjs package.json package-lock.json server/package.json server/package-lock.json src server/src server/tests server/prisma e2e playwright.config.ts vite.config.ts
git commit -m "build: add ESLint 9 flat configs for web and API and fix all findings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Check `git status` first and stage only files you intentionally changed. Not every listed path will have changes.)

---

### Task 4: Startup environment check; `prisma` becomes a runtime dependency

**Files:**
- Create: `server/src/config/env.ts`, `server/tests/config/env.test.ts`
- Modify: `server/src/index.ts`, `server/package.json` (+ lockfile)

**Interfaces:**
- **Consumes:** `zod` (already a server dependency).
- **Produces:**
  - `validateEnv(env: NodeJS.ProcessEnv = process.env): void`, exported from `server/src/config/env.ts`, which throws `EnvValidationError`
  - `EnvValidationError extends Error` with `readonly problems: string[]`
  - `server/src/index.ts` exits with code 1 and prints the problems when validation fails

- [ ] **Step 1: Write the failing tests**

Create `server/tests/config/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateEnv, EnvValidationError } from '../../src/config/env';

const devBase = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'dev-secret',
};

const prodBase = {
  ...devBase,
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(32),
  FRONTEND_ORIGIN: 'https://shop.example.com',
  RAZORPAY_KEY_ID: 'rzp_live_id',
  RAZORPAY_KEY_SECRET: 'super-secret-value',
  RAZORPAY_WEBHOOK_SECRET: 'whsec-value',
};

function problemsOf(env: Record<string, string>): string[] {
  try {
    validateEnv(env);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(EnvValidationError);
    return (err as EnvValidationError).problems;
  }
}

describe('validateEnv', () => {
  it('accepts a minimal development environment', () => {
    expect(problemsOf(devBase)).toEqual([]);
  });

  it('names a missing DATABASE_URL', () => {
    const problems = problemsOf({ JWT_SECRET: 'dev-secret' });
    expect(problems.some((p) => p.startsWith('DATABASE_URL'))).toBe(true);
  });

  it('names an empty JWT_SECRET', () => {
    const problems = problemsOf({ ...devBase, JWT_SECRET: '' });
    expect(problems.some((p) => p.startsWith('JWT_SECRET'))).toBe(true);
  });

  it('accepts a complete production environment', () => {
    expect(problemsOf(prodBase)).toEqual([]);
  });

  it('rejects a production JWT_SECRET shorter than 32 characters', () => {
    const problems = problemsOf({ ...prodBase, JWT_SECRET: 'short' });
    expect(problems.some((p) => p.startsWith('JWT_SECRET'))).toBe(true);
  });

  it('requires the Razorpay keys and FRONTEND_ORIGIN in production', () => {
    const { RAZORPAY_KEY_SECRET: _omit, ...withoutSecret } = prodBase;
    const problems = problemsOf({ ...withoutSecret, FRONTEND_ORIGIN: 'not a url' });
    expect(problems.some((p) => p.startsWith('RAZORPAY_KEY_SECRET'))).toBe(true);
    expect(problems.some((p) => p.startsWith('FRONTEND_ORIGIN'))).toBe(true);
  });

  it('never includes a variable value in its problems or message', () => {
    try {
      validateEnv({ ...prodBase, JWT_SECRET: 'leaky-secret' });
      throw new Error('expected validation to fail');
    } catch (err) {
      const e = err as EnvValidationError;
      expect(e.message).not.toContain('leaky-secret');
      expect(e.problems.join(' ')).not.toContain('leaky-secret');
    }
  });
});
```

(If the Task 3 lint config flags `_omit` as unused, the `argsIgnorePattern` / `varsIgnorePattern` from Task 3 covers it. If it doesn't, use `const withoutSecret = { ...prodBase } as Record<string, string>; delete withoutSecret.RAZORPAY_KEY_SECRET;` instead.)

Run: `cd server && npx vitest run tests/config/env.test.ts`
Expected: FAIL, because the module doesn't exist yet.

- [ ] **Step 2: Implement**

Create `server/src/config/env.ts`:

```ts
import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

const nonEmpty = z.string().min(1, 'is required');

const baseSchema = z.object({
  DATABASE_URL: nonEmpty,
  JWT_SECRET: nonEmpty,
});

const productionSchema = baseSchema.extend({
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters in production'),
  FRONTEND_ORIGIN: z.string().url('must be a URL'),
  RAZORPAY_KEY_ID: nonEmpty,
  RAZORPAY_KEY_SECRET: nonEmpty,
  RAZORPAY_WEBHOOK_SECRET: nonEmpty,
});

/**
 * Fails fast on a misconfigured deployment. Problems name the variable and the
 * rule, never the value, so secrets can't leak into logs.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const schema = env.NODE_ENV === 'production' ? productionSchema : baseSchema;
  const result = schema.safeParse(env);
  if (result.success) return;
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    const rule = issue.code === 'invalid_type' ? 'is required' : issue.message;
    return `${name} ${rule}`;
  });
  throw new EnvValidationError(problems);
}
```

Replace `server/src/index.ts` with:

```ts
import 'dotenv/config';
import { validateEnv, EnvValidationError } from './config/env';

try {
  validateEnv();
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

// Imported after validation so a misconfigured process never builds the app.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate late import after env validation
const { default: app } = require('./app') as typeof import('./app');

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
```

(`server/` compiles to CommonJS, so `require` is valid. If the Task 3 config reports a different rule for this line, use that rule's name in the disable comment.)

Run: `cd server && npx vitest run tests/config/env.test.ts`
Expected: 7 passed.

- [ ] **Step 3: Move `prisma` to dependencies**

In `server/package.json`, move `"prisma": "5.20.0"` from `devDependencies` to `dependencies` (the exact version is unchanged), then run `cd server && npm install` to update the lockfile.

- [ ] **Step 4: Verify startup behaviour by hand**

```bash
cd server
npm run build
DATABASE_URL= JWT_SECRET= node -e "process.env.DATABASE_URL='';process.env.JWT_SECRET='';require('./dist/index.js')"; echo "exit=$?"
```

Expected: it prints `Invalid environment configuration:` with `DATABASE_URL is required` and `JWT_SECRET is required`, then `exit=1`.

`dotenv` doesn't override variables that are already set, so the empty values win. If `server/.env` still supplies them in your shell, run it from a temporary directory that has no `.env`, and note that in the report. Delete `server/dist/` afterwards, since it's gitignored and must not be committed.

- [ ] **Step 5: Full verify**

Run `cd server && npm test`, `npm run lint`, `npm run typecheck`. Expected: 142 + 7 = **149** tests, lint clean, types clean.

- [ ] **Step 6: Commit**

```bash
git add server/src/config/env.ts server/tests/config/env.test.ts server/src/index.ts server/package.json server/package-lock.json
git commit -m "feat(server): fail fast on missing or unsafe environment configuration; prisma is a runtime dependency

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Docker images and the production compose stack

**Files (all new, except `.gitignore`):**
- `server/Dockerfile`
- `server/.dockerignore`
- `Dockerfile`
- `.dockerignore`
- `deploy/nginx/default.conf.template`
- `docker-compose.prod.yml`
- `.env.production.example`
- `deploy/ci.env`
- `.gitignore` (modified)

**Interfaces:**
- **Consumes:**
  - `validateEnv` (Task 4). The image runs with `NODE_ENV=production`, so the env file must satisfy the production schema.
  - `prisma` as a runtime dependency (Task 4).
- **Produces (used by Task 6):**
  - Compose honours `API_IMAGE`, `WEB_IMAGE` and `ENV_FILE`.
  - `web` listens on host port **8080**.
  - `deploy/ci.env` is valid for the production schema.

- [ ] **Step 1: API image**

Create `server/.dockerignore`:

```
node_modules
dist
coverage
tests
.env
.env.*
!.env.example
.claude
*.log
```

Create `server/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Production deps only; generate the Prisma client for this platform, then drop
# npm itself so the final image carries no package manager.
RUN npm ci --omit=dev \
 && ./node_modules/.bin/prisma generate \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Web image**

Create `.dockerignore`:

```
node_modules
dist
coverage
test-results
playwright-report
server
e2e
.git
.github
.claude
.superpowers
docs
**/*.test.ts
**/*.test.tsx
src/test
.env
.env.*
!.env.example
!.env.production.example
*.log
```

Create `deploy/nginx/default.conf.template`. The nginx image fills in `${API_UPSTREAM}` from the environment, and leaves nginx's own `$`-variables untouched because they aren't set as env vars.

```nginx
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    location /api/ {
        proxy_pass ${API_UPSTREAM};
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        try_files $uri =404;
    }

    location / {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        try_files $uri $uri/ /index.html;
    }
}
```

(The security headers are repeated inside each `location` that sets its own `add_header`, because nginx drops inherited `add_header`s in any block that defines one.)

Create `Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts postcss.config.mjs tsconfig.json ./
COPY src ./src
# VITE_API_BASE_URL stays unset: the app calls /api on its own origin (nginx proxies it).
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
ENV API_UPSTREAM=http://api:4000
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
```

(If the build needs another root file, such as a `public/` folder or other config referenced by `vite.config.ts`, add a `COPY` for it and note it in the report. Check what's in the root before building.)

- [ ] **Step 3: Compose stack and env files**

Create `docker-compose.prod.yml`:

```yaml
# Production stack. Configuration comes from ${ENV_FILE:-.env.production}
# (copy .env.production.example). Images default to GHCR; `--build` builds locally.
name: bansuri

services:
  postgres:
    image: postgres:16-alpine
    env_file: ${ENV_FILE:-.env.production}
    volumes:
      - pgdata-prod:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 20
    restart: unless-stopped

  migrate:
    image: ${API_IMAGE:-ghcr.io/radhikax/bansuri-api:latest}
    build: ./server
    env_file: ${ENV_FILE:-.env.production}
    command: ["./node_modules/.bin/prisma", "migrate", "deploy"]
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  api:
    image: ${API_IMAGE:-ghcr.io/radhikax/bansuri-api:latest}
    build: ./server
    env_file: ${ENV_FILE:-.env.production}
    depends_on:
      migrate:
        condition: service_completed_successfully
    restart: unless-stopped

  web:
    image: ${WEB_IMAGE:-ghcr.io/radhikax/bansuri-web:latest}
    build: .
    environment:
      API_UPSTREAM: http://api:4000
    ports:
      - "8080:8080"
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata-prod:
```

Create `.env.production.example`:

```bash
# Copy to .env.production (never commit it) and fill in real values.
# Used by every service in docker-compose.prod.yml.

# --- Postgres container (first start creates this user and database) ---
POSTGRES_USER=ecommerce
POSTGRES_PASSWORD=change-me-strong-password
POSTGRES_DB=ecommerce

# --- API ---
NODE_ENV=production
PORT=4000
# Must match the POSTGRES_* values above; host "postgres" is the compose service name.
DATABASE_URL=postgresql://ecommerce:change-me-strong-password@postgres:5432/ecommerce
# At least 32 random characters, e.g. `openssl rand -hex 32`.
JWT_SECRET=
# Public URL the shop is served from, e.g. https://shop.example.com
FRONTEND_ORIGIN=
# Razorpay live (or test) keys from dashboard.razorpay.com → Settings → API Keys.
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
# Set when creating the webhook (URL: https://<your-domain>/api/orders/razorpay-webhook).
RAZORPAY_WEBHOOK_SECRET=
# Optional: order emails are skipped when empty.
RESEND_API_KEY=
STORE_EMAIL_FROM=orders@yourdomain.com
STORE_OWNER_EMAIL=owner@example.com
```

Create `deploy/ci.env` (committed, **dummy values only**, used by the CI smoke test):

```bash
# DUMMY values for the CI smoke test only. Nothing here is a real credential.
POSTGRES_USER=ecommerce
POSTGRES_PASSWORD=ci-smoke-password
POSTGRES_DB=ecommerce
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://ecommerce:ci-smoke-password@postgres:5432/ecommerce
JWT_SECRET=ci-smoke-jwt-secret-0123456789abcdef0123456789
FRONTEND_ORIGIN=http://localhost:8080
RAZORPAY_KEY_ID=rzp_test_ci_dummy
RAZORPAY_KEY_SECRET=ci-dummy-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=ci-dummy-webhook-secret
RESEND_API_KEY=
STORE_EMAIL_FROM=orders@example.com
STORE_OWNER_EMAIL=owner@example.com
```

Append to `.gitignore`:

```
.env.production
```

(Check that `git check-ignore -v .env.production.example deploy/ci.env` prints nothing, meaning both stay tracked.)

- [ ] **Step 4: Local verification (only if the machine can take it)**

Check free memory first. PowerShell: `(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB`.
- If under **2.5 GB free**, **skip** the local Docker build. Say so in the report; the controller verifies in CI.
- Otherwise, run:

```bash
docker build -t bansuri-api:local ./server
docker build -t bansuri-web:local .
API_IMAGE=bansuri-api:local WEB_IMAGE=bansuri-web:local ENV_FILE=deploy/ci.env docker compose -f docker-compose.prod.yml up -d --no-build
# wait up to 2 minutes for web to be healthy
for i in $(seq 1 60); do docker compose -f docker-compose.prod.yml ps web | grep -q healthy && break; sleep 2; done
curl -fsS http://localhost:8080/ | head -c 200; echo
curl -fsS http://localhost:8080/api/health; echo
curl -fsS http://localhost:8080/api/categories; echo
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:8080/admin/settings
docker compose -f docker-compose.prod.yml logs --tail 30
docker compose -f docker-compose.prod.yml down -v
```

Expected:
- HTML
- `{"status":"ok"}`
- `[]`
- `200`

Always run `down -v`. Port 8080 must be free, and the dev stack's port 5433 is unaffected, since the prod postgres publishes no port.

- [ ] **Step 5: Commit**

```bash
git add server/Dockerfile server/.dockerignore Dockerfile .dockerignore deploy/nginx/default.conf.template docker-compose.prod.yml .env.production.example deploy/ci.env .gitignore
git commit -m "build: Docker images for API and web plus a production compose stack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pipeline jobs, CodeQL, Dependabot and docs

**Files:**
- Modify: `.github/workflows/ci.yml`, `README.md`
- Create: `.github/workflows/codeql.yml`, `.github/dependabot.yml`

**Interfaces:**
- **Consumes:**
  - `npm run lint` / `npm run typecheck` in both packages (Tasks 2–3)
  - the audit gates passing (Task 1)
  - `validateEnv` (Task 4)
  - the Dockerfiles, `docker-compose.prod.yml` (`API_IMAGE` / `WEB_IMAGE` / `ENV_FILE`) and `deploy/ci.env` (Task 5)
- **Produces:**
  - Check names `Quality`, `Frontend (unit tests + build)`, `Backend (tests + type-check)`, `Browser tests (Playwright)`, `Docker (build, scan, smoke test)`, `ci-success`
  - A `Publish images` job that runs only on a push to `main` or a `v*` tag

- [ ] **Step 1: Rewrite `.github/workflows/ci.yml`**

Replace the file with:

```yaml
name: CI

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

# A newer push to the same branch/PR cancels the run still in progress.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

# Dummy, non-secret values: the test suites mock Razorpay and Resend, and the
# e2e server never takes a real payment. Real keys never belong in CI config.
env:
  JWT_SECRET: ci-jwt-secret-not-for-production
  RAZORPAY_KEY_ID: ''
  RAZORPAY_KEY_SECRET: ''
  RAZORPAY_WEBHOOK_SECRET: ci-webhook-secret
  RESEND_API_KEY: ''
  STORE_EMAIL_FROM: orders@example.com
  STORE_OWNER_EMAIL: owner@example.com
  FRONTEND_ORIGIN: http://localhost:5173
  API_IMAGE_NAME: ghcr.io/radhikax/bansuri-api
  WEB_IMAGE_NAME: ghcr.io/radhikax/bansuri-web

jobs:
  quality:
    name: Quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: |
            package-lock.json
            server/package-lock.json
      - run: npm ci
      - run: npm ci
        working-directory: server
      - run: npx prisma generate
        working-directory: server
      - name: Lint (web)
        run: npm run lint
      - name: Lint (API)
        run: npm run lint
        working-directory: server
      - name: Type-check (web)
        run: npm run typecheck
      - name: Type-check (API)
        run: npm run typecheck
        working-directory: server
      - name: Audit production dependencies (web)
        run: npm audit --omit=dev --audit-level=high
      - name: Audit production dependencies (API)
        run: npm audit --omit=dev --audit-level=high
        working-directory: server
      - name: Report dev-dependency advisories (non-blocking)
        run: |
          npm audit --audit-level=high || true
          (cd server && npm audit --audit-level=high) || true

  frontend-test:
    name: Frontend (unit tests + build)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build

  backend-test:
    name: Backend (tests + type-check)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: ecommerce
          POSTGRES_PASSWORD: ecommerce
          POSTGRES_DB: ecommerce_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U ecommerce"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_test
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: server/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npm test
      - run: npx tsc --noEmit

  e2e:
    name: Browser tests (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 25
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: ecommerce
          POSTGRES_PASSWORD: ecommerce
          POSTGRES_DB: ecommerce_e2e
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U ecommerce"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      E2E_DATABASE_URL: postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_e2e
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: |
            package-lock.json
            server/package-lock.json
      - run: npm ci
      - run: npm ci
        working-directory: server
      - run: npx prisma generate
        working-directory: server
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - name: Upload screenshots and traces
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: |
            test-results/
            playwright-report/
          retention-days: 7

  docker:
    name: Docker (build, scan, smoke test)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v4
      - name: Build API image
        uses: docker/build-push-action@v7
        with:
          context: ./server
          load: true
          tags: bansuri-api:ci
          cache-from: type=gha,scope=api
          cache-to: type=gha,mode=max,scope=api
      - name: Build web image
        uses: docker/build-push-action@v7
        with:
          context: .
          load: true
          tags: bansuri-web:ci
          cache-from: type=gha,scope=web
          cache-to: type=gha,mode=max,scope=web
      - name: Scan API image (fixable HIGH/CRITICAL fail)
        uses: aquasecurity/trivy-action@v0.36.0
        with:
          image-ref: bansuri-api:ci
          severity: HIGH,CRITICAL
          ignore-unfixed: true
          exit-code: '1'
      - name: Scan web image (fixable HIGH/CRITICAL fail)
        uses: aquasecurity/trivy-action@v0.36.0
        with:
          image-ref: bansuri-web:ci
          severity: HIGH,CRITICAL
          ignore-unfixed: true
          exit-code: '1'
      - name: Smoke test the production stack
        env:
          API_IMAGE: bansuri-api:ci
          WEB_IMAGE: bansuri-web:ci
          ENV_FILE: deploy/ci.env
        run: |
          set -euo pipefail
          docker compose -f docker-compose.prod.yml up -d --no-build
          for i in $(seq 1 60); do
            if docker compose -f docker-compose.prod.yml ps web | grep -q '(healthy)'; then break; fi
            sleep 2
          done
          docker compose -f docker-compose.prod.yml ps
          curl -fsS http://localhost:8080/ | grep -qi '<html'
          test "$(curl -fsS http://localhost:8080/api/health)" = '{"status":"ok"}'
          curl -fsS http://localhost:8080/api/categories | grep -q '^\['
          curl -fsS -o /dev/null http://localhost:8080/admin/settings
          echo "Smoke test passed"
      - name: Stack logs on failure
        if: failure()
        run: docker compose -f docker-compose.prod.yml logs --no-color --tail 200
        env:
          ENV_FILE: deploy/ci.env
      - name: Tear down
        if: always()
        run: docker compose -f docker-compose.prod.yml down -v
        env:
          ENV_FILE: deploy/ci.env

  ci-success:
    name: ci-success
    runs-on: ubuntu-latest
    needs: [quality, frontend-test, backend-test, e2e, docker]
    if: always()
    steps:
      - name: All required jobs passed
        run: |
          if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') || contains(needs.*.result, 'skipped') }}" = "true" ]; then
            echo "A required job did not succeed: ${{ toJSON(needs) }}"
            exit 1
          fi

  publish:
    name: Publish images
    runs-on: ubuntu-latest
    needs: ci-success
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta-api
        uses: docker/metadata-action@v6
        with:
          images: ${{ env.API_IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') }}
      - id: meta-web
        uses: docker/metadata-action@v6
        with:
          images: ${{ env.WEB_IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') }}
      - uses: docker/build-push-action@v7
        with:
          context: ./server
          push: true
          tags: ${{ steps.meta-api.outputs.tags }}
          labels: ${{ steps.meta-api.outputs.labels }}
          cache-from: type=gha,scope=api
      - uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: ${{ steps.meta-web.outputs.tags }}
          labels: ${{ steps.meta-web.outputs.labels }}
          cache-from: type=gha,scope=web
```

- [ ] **Step 2: CodeQL and Dependabot**

Create `.github/workflows/codeql.yml`:

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 3 * * 1'

permissions:
  contents: read

jobs:
  analyze:
    name: Analyze (javascript-typescript)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v4
        with:
          languages: javascript-typescript
          build-mode: none
      - uses: github/codeql-action/analyze@v4
        with:
          category: /language:javascript-typescript
```

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
    groups:
      web-minor-patch:
        update-types: [minor, patch]
  - package-ecosystem: npm
    directory: /server
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
    groups:
      api-minor-patch:
        update-types: [minor, patch]
  - package-ecosystem: docker
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
  - package-ecosystem: docker
    directory: /server
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
    groups:
      actions:
        patterns: ['*']
```

- [ ] **Step 3: Validate the YAML locally**

```bash
for f in .github/workflows/ci.yml .github/workflows/codeql.yml .github/dependabot.yml docker-compose.prod.yml; do
  node -e "require('yaml').parse(require('fs').readFileSync('$f','utf8')); console.log('ok $f')"
done
```

Expected: `ok` for all four. The `yaml` package is already present transitively. If it isn't, report it and skip this step.

- [ ] **Step 4: README**

In `README.md`, replace the whole existing `## Continuous integration` section with the following, keeping the file's two-space indentation style:

```markdown
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
  3. First-time data: run `npm run prisma:seed` from `server/` on a dev machine
     with `DATABASE_URL` pointed at the production database, then change the
     admin password under Settings → Account.
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
```

- [ ] **Step 5: Commit (the controller pushes)**

```bash
git add .github/workflows/ci.yml .github/workflows/codeql.yml .github/dependabot.yml README.md
git commit -m "ci: quality gates, Docker build/scan/smoke test, GHCR publishing, CodeQL and Dependabot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Do not push.** The controller pushes the branch to PR #5 and watches the run. A failing job comes back to you as a fix round, together with the job's log.

---

## Definition of done

- On PR #5, these are green: `Quality`, `Frontend`, `Backend`, `Browser tests`, `Docker (build, scan, smoke test)` and `ci-success`, plus `CodeQL`. `Publish images` is **skipped** on the PR.
- Test suites: frontend **192**, backend **149** (142 + 7 env tests), e2e **10**.
- The README documents the CI stages, running the production stack, releasing, and the owner's GitHub settings.
- After merge, the first push to `main` publishes both images to GHCR. The owner confirms this, because it can't run on a PR.
