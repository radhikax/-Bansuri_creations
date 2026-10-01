# Next.js Storefront + Brand Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vite single-page app with one Next.js 16 app (server-rendered storefront and browser-rendered admin), restyled in the logo's maroon and beige only, built against an OpenAPI-typed REST contract, with product pages that refresh instantly on admin edits and on sales.

**Architecture:**
- **Next.js App Router:**
  - The root `app/` directory holds routes only.
  - Reusable code lives in `src/` (`src/components`, `src/lib`, `src/admin`, `src/views`, `src/styles`).
  - Storefront pages are server components with ISR and cache tags.
  - Interactive pieces (cart, size picker, admin) are client components.
- **Talking to Express (REST):**
  - Server code calls Express directly at `API_INTERNAL_URL`.
  - The browser calls `/api/*`, which Next.js forwards to Express.
- **New in Express:**
  - an OpenAPI 3.1 document generated from its zod schemas
  - a fire-and-forget call to Next.js's `/internal/revalidate` after every write that changes the catalogue

**Tech Stack:**
- Next.js 16.3.8 (App Router, `output: 'standalone'`), React 18.3.1, TypeScript 5.6.2, Tailwind CSS 4.1.12 (`@tailwindcss/postcss`)
- `openapi-typescript` 7.13.0, `openapi-fetch` 0.17.0
- Express 4.22.3 + `@asteasolutions/zod-to-openapi` 7.3.4 (zod 3.23.8), `swagger-ui-express` 5.0.1
- Vitest + Testing Library + MSW, Playwright 1.63.0

**Spec:** `docs/superpowers/specs/2026-10-01-nextjs-storefront-brand-redesign-design.md`

## Global Constraints

- **Worktree and git:**
  - Work only in `C:\Users\rj816\Downloads\Ecommerce Website for Decor (3)\.claude\worktrees\storefront-data-wiring`, branch `worktree-storefront-data-wiring`.
  - Implementers never push.
  - Every commit message ends with a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never stage `.env*` files (except `*.example` and `deploy/ci.env`), `test-results/`, `playwright-report/`, `.next/` or `.superpowers/`.
- **Pinned versions:**
  - Root: `next` **16.3.8**, `openapi-typescript` **7.13.0**, `openapi-fetch` **0.17.0**, `@next/eslint-plugin-next` **16.3.8** (all exact).
  - Server: `@asteasolutions/zod-to-openapi` **7.3.4**, `swagger-ui-express` **5.0.1**, `@types/swagger-ui-express` **4.1.8**.
  - React stays **18.3.1**.
- **Palette:** the only colours allowed are these tokens. Values come from spec §2.1; implementers may fine-tune only to pass the contrast test.

  | Token | Value |
  |---|---|
  | `--maroon-950` | `#2B0505` |
  | `--maroon-900` | `#3D0707` |
  | `--maroon-800` | `#5A0A0A` (brand) |
  | `--maroon-700` | `#741A1A` |
  | `--maroon-600` | `#8C3A35` |
  | `--maroon-200` | `#E6CFC8` |
  | `--maroon-100` | `#F3E4DF` |
  | `--beige-50` | `#FBF8F3` (page) |
  | `--beige-100` | `#F4EEE4` |
  | `--beige-200` | `#EADFCF` |
  | `--beige-300` | `#DCCDB8` |

  - Contrast: **≥ 4.5:1** for text pairs, **≥ 3:1** for UI pairs.
- **Popup veil:**
  - Every overlay is beige-50 at **45%** opacity, written `bg-(--beige-50)/45` (no blur, no black).
  - One popup at a time.
- **Rendering:**
  - Storefront `revalidate = 300` with cache tags `catalogue`, `category:<slug>`, `product:<slug>`.
  - `generateStaticParams` returns `[]` and `dynamicParams = true`.
  - Unknown slugs return `notFound()`, an HTTP 404.
  - `/admin/*` is client-rendered with `noindex, nofollow`.
- **API paths and environment:**
  - Server code uses `API_INTERNAL_URL` (default `http://localhost:4000`; `http://api:4000` in compose).
  - The browser uses `/api` via the Next.js `rewrites`.
  - **No Next.js Server Actions.**
  - The only Next.js route handler is `app/internal/revalidate/route.ts`.
- **Revalidation:**
  - Header `x-revalidate-secret`, env `REVALIDATE_SECRET`.
  - Express env `WEB_INTERNAL_URL` (compose: `http://web:8080`).
  - Fire-and-forget with a 3 s timeout; it's a no-op when either env var is unset.
- **Low-memory machine (~0.4–1.5 GB free):**
  - Run tests single-worker (`--maxWorkers=1 --minWorkers=1`), in the foreground.
  - If `next build` or the Playwright suite is killed by the memory guard, report that in the report; the controller verifies those in CI.
  - Never loop retries.
- **Test suites before this plan:** frontend **192**, backend **149**, e2e **10**. Every task leaves the suites it touches green.

### Deviations from spec wording (controller rulings)

- **Revalidation path:** spec `/_internal/revalidate` becomes **`/internal/revalidate`**. In the App Router, folders whose names start with `_` are private and never routed. The behaviour (secret header, tags body, 401) is unchanged.
- **Package versions:**
  - The spec names `@asteasolutions/zod-to-openapi` without a version. 9.x requires zod 4, so the plan pins **7.3.4**, which supports the server's zod 3.23.8.
  - `vite` stays as a **dev dependency only**, because Vitest runs on it. It's no longer used to build or serve the app.
- **Admin pages in the visual check:** spec §2.6 lists the logged-in admin pages (products,
  orders, settings). `visual.spec.ts` covers **`/admin/login`** only.
  - Reason: `e2e/admin.spec.ts` changes the seeded admin password earlier in the same run, so a
    later spec can't reliably log in.
  - The inner admin pages are covered by their component tests.
  - The CI artifact screenshots are still reviewed by the owner.
- **Source folders:**
  - `src/app/pages/*` moves to **`src/views/*`**. A folder named `pages` invites confusion with the Next.js Pages Router.
  - `src/app/components` → `src/components`, `src/app/lib` → `src/lib`, `src/app/admin` → `src/admin`, `src/app/types.ts` → `src/types.ts`.

---

## File map

| File(s) | Task | Responsibility |
|---|---|---|
| `server/src/openapi/registry.ts`, `server/scripts/generate-openapi.ts`, `server/openapi.json`, `server/src/app.ts` | 1 | OpenAPI 3.1 document from zod; `GET /api/openapi.json`, `/api/docs` outside production |
| `server/src/services/revalidate.ts`, admin routes, `services/payments.ts` / webhook, `config/env.ts` | 2 | Fire-and-forget revalidation after writes |
| `package.json`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `app/layout.tsx`, `src/**` moves, `src/lib/api/*`, `scripts/check-openapi-drift.mjs` | 3 | Next.js scaffold, source moves, typed API clients, Vitest on Next |
| `src/styles/theme.css`, `src/styles/contrast.test.ts`, `scripts/check-palette.mjs`, `src/components/ui/{sheet,dialog,alert-dialog}.tsx`, components with stray colours | 4 | Brand tokens, veil, enforcement |
| `app/page.tsx`, `app/category/[slug]/page.tsx`, `app/product/[slug]/page.tsx`, `app/{loading,error,not-found}.tsx`, `src/views/*`, `src/lib/catalogue.ts`, `src/lib/useLiveStock.ts`, image components | 5 | Storefront routes, ISR, `next/image`, live stock |
| `src/components/cart/CartProvider.tsx`, `src/components/Cart.tsx`, `src/components/CheckoutDialog.tsx`, `src/components/Header.tsx` | 6 | Persistent cart, one popup at a time |
| `app/sitemap.ts`, `app/robots.ts`, `src/lib/seo.ts`, metadata in pages | 7 | SEO |
| `app/admin/**`, `src/admin/**` | 8 | Admin inside Next.js, noindex, generated client |
| `app/internal/revalidate/route.ts` (+ test) | 9 | Revalidation endpoint |
| `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`, `deploy/ci.env`, `.env.production.example`, `.github/workflows/ci.yml`, `README.md`; delete `vite.config.ts`, `index.html`, `src/main.tsx`, `deploy/nginx/` | 10 | Image, compose, CI, docs |
| `playwright.config.ts`, `e2e/*.spec.ts`, `e2e/visual.spec.ts`, `e2e/seo.spec.ts` | 11 | Browser tests on the Next.js app |

---

### Task 1: OpenAPI 3.1 contract from the zod schemas (backend)

**Files:**
- Create: `server/src/openapi/registry.ts`, `server/scripts/generate-openapi.ts`, `server/openapi.json` (generated), `server/tests/openapi.test.ts`
- Modify:
  - `server/src/app.ts` (serve the document and the docs page)
  - `server/package.json` (dependencies + `openapi:generate` script)
  - each route file that has an inline zod schema: move the schema to an exported const so the registry can import it

**Interfaces:**
- **Produces:**
  - `buildOpenApiDocument(): OpenAPIObject`, exported from `server/src/openapi/registry.ts`
  - `GET /api/openapi.json` → 200 with that document
  - `GET /api/docs` → the Swagger UI page, only when `NODE_ENV !== 'production'`
  - `server/openapi.json` committed, regenerated by `npm run openapi:generate`
  - **Operation ids** (Task 3's typed client keys off paths; these ids are for the docs):

    | Route(s) | operationId |
    |---|---|
    | `GET /api/health` | `getHealth` |
    | `GET /api/categories` | `listCategories` |
    | `GET /api/products` | `listProducts` |
    | `GET /api/products/{slug}` | `getProduct` |
    | `GET /api/settings/shipping` | `getShippingSettings` |
    | `POST /api/orders` | `createOrder` |
    | `GET /api/orders/{orderNumber}` | `getOrder` |
    | `POST /api/admin/login` | `adminLogin` |
    | `POST /api/admin/logout` | `adminLogout` |
    | `POST /api/admin/password` | `adminChangePassword` |
    | `GET` / `PUT /api/admin/settings` | `adminGetSettings` / `adminUpdateSettings` |
    | `GET` / `POST /api/admin/products` | `adminListProducts` / `adminCreateProduct` |
    | `PUT /api/admin/products/{id}` | `adminUpdateProduct` |
    | `PUT /api/admin/products/{id}/variants/{variantId}` | `adminUpdateVariant` |
    | `GET` / `POST /api/admin/categories` | `adminListCategories` / `adminCreateCategory` |
    | `PUT` / `DELETE /api/admin/categories/{id}` | `adminUpdateCategory` / `adminDeleteCategory` |
    | `GET /api/admin/orders` | `adminListOrders` |
    | `PUT /api/admin/orders/{id}/status` | `adminUpdateOrderStatus` |

  - The webhook `POST /api/orders/razorpay-webhook` is documented (`razorpayWebhook`) with a raw JSON body and the `x-razorpay-signature` header.

- [ ] **Step 1: Install**

```bash
cd server && npm install --save-exact @asteasolutions/zod-to-openapi@7.3.4 swagger-ui-express@5.0.1 && npm install --save-dev --save-exact @types/swagger-ui-express@4.1.8 && cd ..
```

- [ ] **Step 2: Write the failing test**

Create `server/tests/openapi.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { buildOpenApiDocument } from '../src/openapi/registry';

const EXPECTED: Array<[string, string]> = [
  ['get', '/api/health'], ['get', '/api/categories'], ['get', '/api/products'], ['get', '/api/products/{slug}'],
  ['get', '/api/settings/shipping'], ['post', '/api/orders'], ['get', '/api/orders/{orderNumber}'],
  ['post', '/api/orders/razorpay-webhook'], ['post', '/api/admin/login'], ['post', '/api/admin/logout'],
  ['post', '/api/admin/password'], ['get', '/api/admin/settings'], ['put', '/api/admin/settings'],
  ['get', '/api/admin/products'], ['post', '/api/admin/products'], ['put', '/api/admin/products/{id}'],
  ['put', '/api/admin/products/{id}/variants/{variantId}'], ['get', '/api/admin/categories'],
  ['post', '/api/admin/categories'], ['put', '/api/admin/categories/{id}'], ['delete', '/api/admin/categories/{id}'],
  ['get', '/api/admin/orders'], ['put', '/api/admin/orders/{id}/status'],
];

describe('OpenAPI document', () => {
  it('is OpenAPI 3.1 and documents every route', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    for (const [method, path] of EXPECTED) {
      expect(doc.paths?.[path], `${method.toUpperCase()} ${path}`).toHaveProperty(method);
    }
  });

  it('marks admin routes as requiring the admin_session cookie', () => {
    const doc = buildOpenApiDocument();
    expect(doc.paths?.['/api/admin/products']?.get?.security).toEqual([{ adminSession: [] }]);
    expect(doc.components?.securitySchemes?.adminSession).toMatchObject({ type: 'apiKey', in: 'cookie', name: 'admin_session' });
  });

  it('is served at GET /api/openapi.json', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
  });

  it('committed server/openapi.json matches the generated document', async () => {
    const committed = (await import('../openapi.json', { with: { type: 'json' } })).default;
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildOpenApiDocument())));
  });
});
```

Run: `cd server && npx vitest run tests/openapi.test.ts --maxWorkers=1`
Expected: FAIL, because the module doesn't exist yet.

- [ ] **Step 3: Implement the registry**

Create `server/src/openapi/registry.ts`. It uses the library's registry API: `extendZodWithOpenApi(z)`, `new OpenAPIRegistry()`, `registry.registerPath({...})`, `registry.registerComponent('securitySchemes', 'adminSession', { type: 'apiKey', in: 'cookie', name: 'admin_session' })`, and `new OpenApiGeneratorV31(registry.definitions).generateDocument({ openapi: '3.1.0', info: { title: 'Bansuri Creations API', version: '1.0.0' }, servers: [{ url: '/' }] })`.

Rules for the registry:
- **Request bodies, query and params:** reuse the **existing** zod schemas from the routes. Export them from their route files (for example `export const checkoutSchema = ...` in `orders.routes.ts`); don't duplicate them.
- **Responses:** define zod response schemas in `server/src/openapi/schemas.ts`, mirroring what each route returns today. That's the Prisma model fields as JSON, with dates as `z.string()`. For example, `CategorySchema` has `id, name, slug, description, imageUrl, icon, createdAt, updatedAt`. Products are returned with `variants[]` and `category`.
- **Errors:** every documented error status uses `ErrorSchema = z.object({ error: z.string(), details: z.unknown().optional() })`.
- **Admin routes:** carry `security: [{ adminSession: [] }]` and a 401 response.
- **`buildOpenApiDocument()`** returns the generated object. It must be a pure function, with no I/O.

Create `server/scripts/generate-openapi.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument } from '../src/openapi/registry';

writeFileSync(resolve(__dirname, '../openapi.json'), JSON.stringify(buildOpenApiDocument(), null, 2) + '\n');
console.log('wrote server/openapi.json');
```

Add the script to `server/package.json`: `"openapi:generate": "tsx scripts/generate-openapi.ts"`.

In `server/src/app.ts`, right after the `/api/health` route, add:

```ts
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi/registry';
// …
const openApiDocument = buildOpenApiDocument();
app.get('/api/openapi.json', (_req, res) => { res.json(openApiDocument); });
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
}
```

If `server/tsconfig.json`'s `include` doesn't cover `scripts/`, `tsx` still runs it. Don't add `scripts/` to the build.

- [ ] **Step 4: Generate the document and verify**

Run:
```bash
cd server
npm run openapi:generate
npx vitest run tests/openapi.test.ts --maxWorkers=1    # expect: 4 passed
npm test -- --maxWorkers=1                              # expect: 153 passed (149 + 4)
npm run lint
npm run typecheck
```

If `import ... with { type: 'json' }` isn't supported by the test runner, read the file with `JSON.parse(readFileSync(...))` instead, and note it in the report.

- [ ] **Step 5: Commit**

```bash
git add server/src/openapi server/scripts/generate-openapi.ts server/openapi.json server/src/app.ts server/src/routes server/package.json server/package-lock.json server/tests/openapi.test.ts
git commit -m "feat(server): OpenAPI 3.1 contract generated from the zod schemas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Instant page refresh from Express (backend)

**Files:**
- Create: `server/src/services/revalidate.ts`, `server/tests/services/revalidate.test.ts`, `server/tests/revalidate-triggers.test.ts`
- Modify:
  - `server/src/routes/admin/products.routes.ts`, `categories.routes.ts`, `settings.routes.ts`
  - the code that marks an order PAID: `server/src/routes/webhook.routes.ts`, or `server/src/services/payments.ts` if it exists
  - `server/src/config/env.ts`

**Interfaces:**
- **Consumes:** nothing new.
- **Produces:**
  - `revalidate(tags: string[]): void`, exported from `server/src/services/revalidate.ts`. It never throws and returns immediately.
  - It POSTs to `${WEB_INTERNAL_URL}/internal/revalidate` with headers `content-type: application/json` and `x-revalidate-secret: ${REVALIDATE_SECRET}`, and body `{ "tags": [...] }`.
  - **Tags:**
    - `catalogue`
    - `product:<slug>` (the product's slug)
    - `category:<slug>` (the category's slug)

- [ ] **Step 1: Write the failing service test**

```ts
// server/tests/services/revalidate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { revalidate } from '../../src/services/revalidate';

describe('revalidate', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is a no-op when WEB_INTERNAL_URL or REVALIDATE_SECRET is unset', () => {
    vi.stubEnv('WEB_INTERNAL_URL', '');
    vi.stubEnv('REVALIDATE_SECRET', 'x');
    revalidate(['catalogue']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the tags with the secret header', () => {
    vi.stubEnv('WEB_INTERNAL_URL', 'http://web:8080');
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    revalidate(['catalogue', 'product:brass-diya']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://web:8080/internal/revalidate');
    expect(init.method).toBe('POST');
    expect(init.headers['x-revalidate-secret']).toBe('s3cret');
    expect(JSON.parse(init.body)).toEqual({ tags: ['catalogue', 'product:brass-diya'] });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('swallows network failures', async () => {
    vi.stubEnv('WEB_INTERNAL_URL', 'http://web:8080');
    vi.stubEnv('REVALIDATE_SECRET', 's3cret');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(() => revalidate(['catalogue'])).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
```

Run: `cd server && npx vitest run tests/services/revalidate.test.ts --maxWorkers=1`
Expected: FAIL, because the module doesn't exist yet.

- [ ] **Step 2: Implement**

```ts
// server/src/services/revalidate.ts
/**
 * Asks the Next.js web app to rebuild cached pages for these tags. Fire-and-forget:
 * never throws, never delays the caller; pages still refresh on their 5-minute timer.
 */
export function revalidate(tags: string[]): void {
  const base = process.env.WEB_INTERNAL_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret || tags.length === 0) return;
  fetch(`${base}/internal/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(3000),
  })
    .then((res) => {
      if (!res.ok) console.error(`revalidate ${tags.join(',')} → HTTP ${res.status}`);
    })
    .catch((err: unknown) => console.error('revalidate failed', err));
}
```

(This uses `AbortSignal.timeout`, which works in Node and in the backend tests. The frontend's jsdom issue doesn't apply here.)

Run the service test: expect 3 passed.

- [ ] **Step 3: Wire up the triggers (test first)**

Create `server/tests/revalidate-triggers.test.ts`:
- `vi.mock('../src/services/revalidate', () => ({ revalidate: vi.fn() }))`.
- Use the existing test helpers (`resetDb`, `loginAsAdmin`, seed-like fixtures created through Prisma in the test).
- Assert, after a successful request, the exact tag arguments for each trigger:

| Request | Expected tags |
|---|---|
| `POST /api/admin/products` | `catalogue`, `product:<new slug>` |
| `PUT /api/admin/products/:id` | `catalogue`, `product:<slug>` (the **old** slug as well, if the slug changed) |
| `PUT /api/admin/products/:id/variants/:variantId` | `catalogue`, `product:<slug>` |
| `POST`, `PUT /api/admin/categories[/:id]` | `catalogue`, `category:<slug>` |
| `DELETE /api/admin/categories/:id` | `catalogue`, `category:<slug>` |
| `PUT /api/admin/settings` | `catalogue` |
| A signed `payment.captured` webhook that marks an order PAID | `product:<slug>` for each product in the order; build the signed request exactly as `server/tests/webhook.test.ts` does |

- Also assert that a **failed** request (400 or 404) does **not** call `revalidate`.

Then add the calls in each route, after the database write succeeds and before sending the response. In the webhook / mark-paid code, call it only when the order was actually claimed as PAID by this request. To get product slugs, include `productVariant: { include: { product: true } }` when loading the order items.

Update `server/src/config/env.ts`:
- `WEB_INTERNAL_URL` is optional (`z.string().url().optional()`, empty string treated as unset).
- `REVALIDATE_SECRET` is optional.
- After successful validation in production, if either is missing, `console.warn('REVALIDATE_SECRET/WEB_INTERNAL_URL not set: pages refresh on their 5-minute timer only')`.
- Add a unit test for that warning to the existing `server/tests/config/env.test.ts`.

- [ ] **Step 4: Verify**

`cd server && npm test -- --maxWorkers=1` (expect all to pass, 153 + the new tests; record the exact total), `npm run lint`, `npm run typecheck`, then `npm run openapi:generate`. If no route shapes changed, `git diff --stat server/openapi.json` is empty.

- [ ] **Step 5: Commit**

```bash
git add server/src server/tests
git commit -m "feat(server): refresh Next.js pages instantly after catalogue writes and sales

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Next.js scaffold, source moves, typed API clients

**Files:**
- Create:
  - `next.config.ts`, `app/layout.tsx`, `app/page.tsx` (temporary placeholder, replaced in Task 5)
  - `src/lib/api/schema.d.ts` (generated), `src/lib/api/client.ts`
  - `scripts/generate-api-types.mjs`, `scripts/check-openapi-drift.mjs`
  - `src/test/next-mocks.ts`
- Move (with `git mv`, so history follows):
  - `src/app/components` → `src/components`
  - `src/app/lib` → `src/lib`
  - `src/app/admin` → `src/admin`
  - `src/app/pages` → `src/views`
  - `src/app/types.ts` → `src/types.ts`
  - Then fix all relative imports.
- Modify: `package.json`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts` (new, split out of `vite.config.ts`), `src/test/setup.ts`, `eslint.config.js`, `.gitignore`.
- Delete in this task: `src/main.tsx` and `src/app/App.tsx`. Their routing is replaced in Tasks 5 and 8; for now the placeholder page renders "Bansuri Creations".

**Interfaces:**
- **Produces:**
  - `serverApi` and `browserApi` (openapi-fetch clients typed by `paths` from `schema.d.ts`), exported from `src/lib/api/client.ts`
  - `API_INTERNAL_URL` handling and the `/api` rewrite, in `next.config.ts`
  - Scripts:
    - `"dev": "next dev -p 5173"`
    - `"build": "next build"`
    - `"start": "next start -p 5173"`
    - `"api:types": "node scripts/generate-api-types.mjs"`
    - `"api:check": "node scripts/check-openapi-drift.mjs"`
    - `test`, `lint`, `typecheck` and `e2e` keep their names
  - Test helpers: `src/test/next-mocks.ts` mocks `next/navigation` (`useRouter`, `usePathname`, `useParams`, `useSearchParams`, `notFound`) and replaces `next/image` with a plain `<img>`, so component tests stay simple

- [ ] **Step 1: Dependencies**

```bash
npm install --save-exact next@16.3.8
npm install --save-dev --save-exact openapi-typescript@7.13.0 @next/eslint-plugin-next@16.3.8
npm install --save-exact openapi-fetch@0.17.0
npm uninstall react-router-dom @vitejs/plugin-react @tailwindcss/vite
npm install --save-dev --save-exact @tailwindcss/postcss@4.1.12 @vitejs/plugin-react@4.7.0
```

(`@vitejs/plugin-react` comes back as a **dev dependency** for Vitest's JSX transform. `vite` stays a dev dependency, because Vitest runs on it.)

- [ ] **Step 2: Next.js config, layout, PostCSS, tsconfig**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const apiInternal = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiInternal}/api/:path*` }];
  },
};

export default config;
```

`postcss.config.mjs` becomes `export default { plugins: { '@tailwindcss/postcss': {} } };`.

`app/layout.tsx` (Task 5 adds the providers, header and footer; for now):

```tsx
import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import '../src/styles/index.css';

const heading = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-heading' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:8080'),
  title: { default: 'Bansuri Creations', template: '%s | Bansuri Creations' },
  description: 'Handmade traditional decor, wedding packing and personalised gifts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

In `src/styles/fonts.css`:
- Remove the Google Fonts `@import`.
- Set `--font-heading` / `--font-body` as the font families wherever the CSS used the old names. Find them with `grep -rn "Cormorant\|Inter" src/styles`.

Update `tsconfig.json`:
- `"jsx": "preserve"`
- add `"plugins": [{ "name": "next" }]`
- `"include": ["next-env.d.ts", "app", "src", "e2e", "playwright.config.ts", "vitest.config.ts", ".next/types/**/*.ts"]`
- keep `strict` and the other existing options
- `paths`: `{"@/*": ["src/*"]}`

Add `.next/` and `next-env.d.ts` to `.gitignore`.

`vitest.config.ts`. Move the `test` block out of `vite.config.ts`, then **delete `vite.config.ts` in Task 10**, once nothing else needs it.

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts', './src/test/next-mocks.ts'],
    css: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 3: Typed API clients**

`scripts/generate-api-types.mjs` runs `openapi-typescript` programmatically on `server/openapi.json` and writes `src/lib/api/schema.d.ts`, starting with the header `// GENERATED from server/openapi.json — do not edit; run npm run api:types`.

`scripts/check-openapi-drift.mjs` does three things:
1. Runs `npm --prefix server run openapi:generate`.
2. Runs `npm run api:types`.
3. Runs `git diff --exit-code -- server/openapi.json src/lib/api/schema.d.ts`. A non-zero exit prints "OpenAPI contract or generated types are out of date. Run npm --prefix server run openapi:generate && npm run api:types and commit."

`src/lib/api/client.ts`:

```ts
import createClient from 'openapi-fetch';
import type { paths } from './schema';

/** Server components / route handlers: talk to Express directly. */
export const serverApi = createClient<paths>({ baseUrl: process.env.API_INTERNAL_URL ?? 'http://localhost:4000' });

/** Browser code: same-origin /api, forwarded to Express by next.config.ts rewrites (keeps the admin cookie first-party). */
export const browserApi = createClient<paths>({ baseUrl: '', credentials: 'include' });
```

Run `npm run api:types`, and commit the generated file.

- [ ] **Step 4: Move sources, test helpers, eslint**

- Do the `git mv` moves listed under Files.
- Fix every import, with `npm run typecheck` as the guide.
- Create `src/test/next-mocks.ts`:

```ts
import { vi } from 'vitest';
import React from 'react';

export const routerMock = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: vi.fn(() => '/'),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
  default: ({ src, alt, fill: _fill, priority: _priority, sizes, ...rest }: Record<string, unknown>) =>
    React.createElement('img', { src: typeof src === 'string' ? src : '', alt, sizes, ...rest }),
}));
```

- **The existing component tests** keep running against moved components. Tests for components still using `react-router` (`Link`, `useParams`, `MemoryRouter`) will break until Tasks 5 to 8 convert them.
  - For **this task only**, mark exactly those test files `describe.skip`, each with the comment `// re-enabled in Task N` naming the task that converts it.
  - List every skipped file in the report.
  - Tasks 5 to 8 must re-enable each one.
- **`eslint.config.js`:**
  - Add `@next/eslint-plugin-next` (its `recommended` + `core-web-vitals` rules) for `app/**` and `src/**`.
  - Add `.next/` to the ignores.
  - Move the vendored ignores to `src/components/ui/**` and `src/components/figma/**`.

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm run lint
npx vitest run --maxWorkers=1 --minWorkers=1   # every non-skipped test passes; record passed/skipped counts
npm run build                                  # if the memory guard kills it, say so in the report
node scripts/check-openapi-drift.mjs           # exit 0
```

- [ ] **Step 6: Commit**

```bash
git add -A app src scripts next.config.ts postcss.config.mjs tsconfig.json vitest.config.ts eslint.config.js package.json package-lock.json .gitignore
git commit -m "build: scaffold the Next.js app, move sources, typed OpenAPI clients

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Check `git status` first, so that only intended changes are staged.)

---

### Task 4: Brand tokens, popup veil, palette enforcement

**Files:**
- Modify: `src/styles/theme.css` (replace the colour tokens; delete the dark theme block), `src/components/ui/sheet.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/alert-dialog.tsx`, every component using a non-token colour class
- Create: `src/styles/palette.ts`, `src/styles/contrast.test.ts`, `scripts/check-palette.mjs`
- Modify: `package.json` (add `"palette:check": "node scripts/check-palette.mjs"` to the `lint` script: `"lint": "eslint . --max-warnings=0 && node scripts/check-palette.mjs"`)

**Interfaces:**
- **Produces:**
  - CSS variables `--maroon-{950,900,800,700,600,200,100}` and `--beige-{50,100,200,300}`.
  - The semantic shadcn variables mapped onto them:

    | Variable | Token |
    |---|---|
    | `--background` | beige-50 |
    | `--foreground` | maroon-900 |
    | `--card` | beige-100 |
    | `--card-foreground` | maroon-900 |
    | `--popover` | beige-100 |
    | `--popover-foreground` | maroon-900 |
    | `--primary` | maroon-800 |
    | `--primary-foreground` | beige-50 |
    | `--secondary` | beige-200 |
    | `--secondary-foreground` | maroon-900 |
    | `--muted` | beige-200 |
    | `--muted-foreground` | maroon-600 |
    | `--accent` | maroon-100 |
    | `--accent-foreground` | maroon-900 |
    | `--destructive` | maroon-800 |
    | `--destructive-foreground` | beige-50 |
    | `--border` | beige-300 |
    | `--input` | beige-300 |
    | `--ring` | maroon-800 |

  - `PALETTE` (name → hex) and `CONTRAST_PAIRS`, exported from `src/styles/palette.ts`.

- [ ] **Step 1: Write the contrast test (failing)**

`src/styles/palette.ts`:

```ts
export const PALETTE = {
  'maroon-950': '#2B0505', 'maroon-900': '#3D0707', 'maroon-800': '#5A0A0A', 'maroon-700': '#741A1A',
  'maroon-600': '#8C3A35', 'maroon-200': '#E6CFC8', 'maroon-100': '#F3E4DF',
  'beige-50': '#FBF8F3', 'beige-100': '#F4EEE4', 'beige-200': '#EADFCF', 'beige-300': '#DCCDB8',
} as const;

export type Token = keyof typeof PALETTE;

/** [foreground, background, minimum ratio] — every pairing the UI actually uses. */
export const CONTRAST_PAIRS: Array<[Token, Token, number]> = [
  ['maroon-900', 'beige-50', 4.5], ['maroon-900', 'beige-100', 4.5], ['maroon-900', 'beige-200', 4.5],
  ['maroon-950', 'beige-50', 4.5], ['maroon-600', 'beige-50', 4.5], ['maroon-600', 'beige-100', 4.5],
  ['beige-50', 'maroon-800', 4.5], ['beige-50', 'maroon-700', 4.5], ['maroon-800', 'beige-50', 4.5],
  ['maroon-900', 'maroon-200', 4.5], ['maroon-900', 'maroon-100', 4.5],
  ['beige-300', 'beige-50', 1.0], // decorative divider only; documented exception, see note
  ['maroon-800', 'beige-200', 3.0], // focus ring / input border on inputs
];
```

(Keep the `beige-300` border row with ratio 1.0, so it's visible that it's decorative. Interactive borders use maroon tokens.)

`src/styles/contrast.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTRAST_PAIRS, PALETTE } from './palette';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('brand palette', () => {
  it.each(CONTRAST_PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    expect(ratio(PALETTE[fg], PALETTE[bg])).toBeGreaterThanOrEqual(min);
  });

  it('theme.css defines exactly the palette tokens with the same values', () => {
    const css = readFileSync(resolve(__dirname, 'theme.css'), 'utf8');
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(css.toLowerCase()).toContain(`--${name}: ${hex.toLowerCase()};`);
    }
    expect(css).not.toMatch(/--accent-(gold|rose|sage)/);
    expect(css).not.toMatch(/\.dark\s*\{/);
  });
});
```

Run: `npx vitest run src/styles/contrast.test.ts --maxWorkers=1`
Expected: the CSS test fails, because `theme.css` still has the old tokens. Any contrast row that fails tells you which value to adjust; adjust it **in both** `palette.ts` and `theme.css`, and record the change.

- [ ] **Step 2: Rewrite `theme.css`**

- Define the 11 tokens in `:root`, then map the semantic variables as in Interfaces.
- Keep any non-colour variables (radius, fonts) as they are.
- Delete `--accent-gold*`, `--accent-rose*`, `--accent-sage*` and the `.dark { … }` block.
- Keep the Tailwind 4 `@theme inline` mapping of semantic tokens to utilities. Also expose `--color-maroon-*` / `--color-beige-*`, so classes like `bg-maroon-800` and `text-beige-50` exist.

- [ ] **Step 3: Palette lint (failing first)**

`scripts/check-palette.mjs`:
- **Scans:** `app/**/*.{ts,tsx,css}` and `src/**/*.{ts,tsx,css}`.
- **Excludes:** `src/styles/theme.css`, `src/styles/palette.ts`, `*.test.*`, `src/components/ui/**`, `src/components/figma/**`, `src/lib/api/schema.d.ts`.
- **Fails (exit 1)**, listing `file:line: offending token`, when it finds any of:
  - a Tailwind colour utility `(bg|text|border|fill|stroke|ring|outline|from|via|to|decoration|placeholder|caret|accent|shadow)-(<name>)` whose name is a Tailwind default palette name: `slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white`
  - `#` followed by 3, 4, 6 or 8 hex digits inside a string or className
  - `rgb(`, `rgba(`, `hsl(` or `oklch(`

Run `node scripts/check-palette.mjs` and record the findings. Today these include `text-yellow-400`, `text-white`, `text-white/90`, `border-white`, `bg-white/10`, `bg-gray-100` and the `accent-gold`/`accent-rose` usages in `Hero`, `ProductCard` and `ProductDetailPage`.

- [ ] **Step 4: Replace stray colours and add the veil**

**Mapping rules (no behaviour change):**

| Old | New |
|---|---|
| Star ratings `text-yellow-400` (filled) | `text-maroon-800`; empty stars `text-maroon-200` |
| Hero text `text-white` / `text-white/90` | `text-beige-50` / `text-beige-50/90` |
| Hero "View Collections" | `border-beige-50 text-beige-50 hover:bg-beige-50/10` |
| Hero "Shop Now" `bg-accent-gold…` | `bg-beige-50 text-maroon-900 hover:bg-beige-100` |
| Hero image overlay `rgba(124, 29, 49, 0.55)` | `rgba(…)` literals are banned, so use a class overlay `<div className="absolute inset-0 bg-maroon-900/55" />` over the image instead of the inline `linear-gradient` |
| Discount badge `bg-accent-rose text-accent-rose-foreground` | `bg-maroon-200 text-maroon-900` |
| `bg-gray-100` | `bg-beige-200` |
| Destructive buttons | stay `variant="destructive"`, which now maps to maroon |
| Delete-confirmation copy and icons | stay as they are |

**The veil:** in `sheet.tsx`, `dialog.tsx` and `alert-dialog.tsx`, replace the overlay's `bg-black/50` (or `bg-black/80`) with `bg-(--beige-50)/45`. Change nothing else in those files.

- [ ] **Step 5: Verify and commit**

Run:
- `npx vitest run --maxWorkers=1 --minWorkers=1`: all non-skipped tests pass, the contrast test passes, and existing tests that asserted old class names are updated to the new token classes (list them)
- `npm run lint`: exit 0, including the palette check
- `npm run typecheck`

```bash
git add src/styles scripts/check-palette.mjs src/components package.json
git commit -m "feat(ui): logo maroon and beige palette, light popup veil, palette lint and contrast test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Storefront routes (ISR, `next/image`, live stock)

**Files:**
- Create:
  - `src/lib/catalogue.ts` (server data access)
  - `app/page.tsx`, `app/category/[slug]/page.tsx`, `app/product/[slug]/page.tsx`
  - `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`
  - `src/lib/useLiveStock.ts` (+ test)
- Modify:
  - `src/views/HomePage.tsx`, `CategoryPage.tsx`, `ProductDetailPage.tsx`: props-driven; no data fetching or `useParams` inside
  - `src/components/{Header,Footer,Hero,ProductCard,CategoryCard,ImageGallery}.tsx`: `next/link`, `next/image`, `'use client'` where they use state or effects
  - `app/layout.tsx`: Header, Footer and Toaster; categories loaded on the server for the nav
- Delete: `src/components/ShimmerImage.tsx`, `src/lib/images.ts`, `src/lib/useApiData.ts` (and their tests). `next/image` and server fetching replace them.
- Re-enable the related `describe.skip` tests from Task 3, converted.

**Interfaces:**
- **Consumes:** `serverApi`, `browserApi` (Task 3); `adaptProduct`, `adaptCategory` (existing `src/lib/adapters.ts`).
- **Produces:**
  - From `src/lib/catalogue.ts` (server-only; starts with `import 'server-only';`):
    - `getCategories(): Promise<AdaptedCategory[]>`
    - `getProducts(): Promise<Product[]>`
    - `getProductBySlug(slug): Promise<{ product: Product; raw: ApiProduct } | null>`
    - `getCategoryBySlug(slug): Promise<AdaptedCategory | null>`
  - Each passes `next: { revalidate: 300, tags: [...] }` through openapi-fetch's `fetch` options:
    - lists use `['catalogue']`
    - a product uses `['catalogue', `product:${slug}`]`
    - a category uses `['catalogue', `category:${slug}`]`
  - A 404 from the API returns `null`; other errors throw (and render `app/error.tsx`).
  - From `src/lib/useLiveStock.ts`: `useLiveStock(slug: string, initial: ProductVariant[]): ProductVariant[]`.

- [ ] **Step 1: Data access + live stock tests first**

`src/lib/useLiveStock.test.tsx`, using MSW. MSW's server already exists; switch its handlers' base URL to `window.location.origin`, matching `browserApi`'s `''` base.
- It returns `initial` immediately.
- It then updates the stock values from `GET /api/products/:slug`.
- It keeps `initial` if the request fails.

Run: expect FAIL.

- [ ] **Step 2: Implement**

`useLiveStock`:
- A `useEffect` calls `browserApi.GET('/api/products/{slug}', { params: { path: { slug } } })`.
- On success it maps the variants to `{ id, label, price: v.price ?? basePrice, stock }`.
- It ignores the result if the component unmounted, and ignores errors.

Pages (server components):

```tsx
// app/product/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/catalogue';
import { ProductDetailPage } from '@/views/ProductDetailPage';

export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getProductBySlug(slug);
  if (!found) notFound();
  return <ProductDetailPage product={found.product} />;
}
```

- `app/category/[slug]/page.tsx` follows the same pattern, passing `category` and `products` filtered by `categorySlug`.
- `app/page.tsx` passes categories and products.
- **Next 16:** `params` is a Promise and must be awaited.
- The cart callbacks come from Task 6's `useCart()`. Until Task 6 lands, `ProductCard` and `ProductDetailPage` call a temporary `useCart` stub exported from `src/components/cart/CartProvider.tsx`. Create that file now with only the `useCart` signature, from Task 6's Interfaces, and an in-memory implementation; Task 6 replaces it.

`ProductDetailPage` becomes a client component (`'use client'`). It calls `useLiveStock(product.slug, product.variants ?? [])` and passes the live variants to `useVariantSelection`.

**Images:**
- `ProductCard`, `CategoryCard` and `ImageGallery` use `next/image` with `fill` inside their existing sized containers, plus the spec's `sizes`:
  - card: `(min-width:1024px) 25vw, (min-width:768px) 50vw, 100vw`
  - gallery: `(min-width:768px) 50vw, 100vw`
  - thumbnails: `96px`
- Use `priority` on the gallery's main image and the hero background (converted from a CSS background to `<Image fill priority>` plus the `bg-maroon-900/55` overlay div from Task 4).

**Links:** convert every `react-router-dom` `Link` / `useNavigate` to `next/link` / `useRouter` from `next/navigation`. Hero anchors (`#featured`, `#categories`) stay plain `<a>`.

**Loading, error and not-found pages:**
- `app/loading.tsx` renders the existing `ProductCardSkeleton` grid.
- `app/error.tsx` (client) shows maroon text, an alert icon, "Something went wrong loading this page." and a Retry button that calls `reset()`.
- `app/not-found.tsx` shows the heading "We couldn't find that page" and a `next/link` "Back to shopping" to `/`.
- `CategoryPage` no longer renders its own "Category not found" text, since the route calls `notFound()`. Update its test to the new props-only API.

- [ ] **Step 3: Verify and commit**

Run:
- the Vitest suite: all non-skipped tests pass; re-enabled storefront tests pass; record the counts
- `npm run lint`, `npm run typecheck`
- `npm run build`: record its route table, which should show `/`, `/category/[slug]` and `/product/[slug]` as ISR (revalidate 5m)

```bash
git add -A app src
git commit -m "feat(storefront): server-rendered pages with ISR, next/image and live stock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Persistent cart, one popup at a time

**Files:**
- Create / complete: `src/components/cart/CartProvider.tsx` (+ test), `src/components/CheckoutDialog.tsx` (extracted from `Cart.tsx`)
- Modify: `src/components/Cart.tsx`, `src/components/Header.tsx` (cart count + open from context), `app/layout.tsx` (wrap in `<CartProvider>`)
- Re-enable and convert `Cart.test.tsx` and the remaining skipped tests.

**Interfaces:**
- **Produces:**
  - `CartProvider` (client component) and `useCart()`, exported from `src/components/cart/CartProvider.tsx`. `useCart()` returns:

    ```ts
    {
      items: CartItem[];
      add(item: Product): void;            // item.id = `${productId}::${variantId}`, item.variantId set
      setQuantity(id: string, quantity: number): void;
      remove(id: string): void;
      clear(): void;
      count: number;
      isOpen: boolean;
      open(): void;
      close(): void;
    }
    ```

  - `CartItem` = `Product & { quantity: number; variantId: string }`.
  - Storage: key `bansuri-cart-v1`, JSON `{ v: 1, items }`. It's loaded in a `useEffect` after mount; invalid or missing data means an empty cart. It's saved on every change.

- [ ] **Step 1: Write the tests first**

`CartProvider.test.tsx`:
- Adding the same item twice increments its quantity.
- The cart survives an unmount and remount (with `localStorage`).
- Corrupt storage (`'{oops'`) gives an empty cart, with no throw.
- `count` is the sum of quantities.
- `variantId` is taken from the item id.

`Cart.test.tsx` adds:
- Clicking **Proceed to Checkout** closes the sheet (the dialog `Shopping Cart` is gone) and opens the checkout dialog.
- The checkout dialog's **Back to cart** button closes it and reopens the sheet.
- Both use `findByRole('dialog', { name: … })`.

Run: expect FAIL.

- [ ] **Step 2: Implement**

- `CartProvider` uses `useReducer` plus the persistence effect described above.
- **`Cart.tsx`:**
  - It reads everything from `useCart()`; no more props from `App`.
  - It fetches shipping settings with `browserApi.GET('/api/settings/shipping')` on first open.
  - It keeps the existing `calculateShipping`, `shippingLabel` and `optimizedImage` → `next/image` usage.
- **`CheckoutDialog`** holds the existing 2-step form (Shipping → Review). The demo Pay button stays.
  - It opens via a `checkoutOpen` state owned by `Cart`.
  - **Proceed to Checkout** calls `close()` (the sheet), then sets `checkoutOpen = true`.
  - **Back to cart** sets `checkoutOpen = false`, then calls `open()`.
- The Header's cart button calls `open()` and shows `count`. The `flyToCart` target attribute is kept.

- [ ] **Step 3: Verify and commit**

Run the Vitest suite (all pass, and **no skipped tests remain** from Task 3), then `npm run lint` and `npm run typecheck`.

```bash
git add -A src app
git commit -m "feat(storefront): cart saved across reloads; checkout replaces the cart drawer instead of stacking

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: SEO (metadata, JSON-LD, sitemap, robots)

**Files:**
- Create: `src/lib/seo.ts` (+ test), `app/sitemap.ts`, `app/robots.ts`
- Modify: `app/page.tsx`, `app/category/[slug]/page.tsx`, `app/product/[slug]/page.tsx` (add `generateMetadata`; product page renders the JSON-LD)

**Interfaces:**
- **Produces**, from `src/lib/seo.ts`:
  - `productJsonLd(p: Product, url: string): Record<string, unknown>`. The `@type` is `Product`; it carries `name`, `image[]` and `description`. Its `offers` has `@type: Offer`, `price` (the lowest variant price) and `priceCurrency: 'INR'`. `availability` is `https://schema.org/InStock` when any variant has stock, otherwise `OutOfStock`.
  - `absoluteUrl(path: string): string`, based on `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 1: Test first:** `seo.test.ts` covers price, availability and the absolute URLs. Run: expect FAIL.

- [ ] **Step 2: Implement**

- Each page exports `generateMetadata`:
  - **Product:** `title = product.name`, `description` = the first 155 characters of the description, canonical `/product/<slug>`. Open Graph has `type: 'website'`, the first image and the title. `other: { 'product:price:amount': String(price), 'product:price:currency': 'INR' }`.
  - **Category:** title and description from the category.
  - **Home:** the default metadata.
- The product page renders `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(...)) }} />`.
- `app/sitemap.ts`:
  - `export const revalidate = 3600`
  - entries for `/`, every category and every active product, via `getCategories` / `getProducts`, with absolute URLs
- `app/robots.ts`: `{ rules: [{ userAgent: '*', allow: '/', disallow: '/admin' }], sitemap: absoluteUrl('/sitemap.xml') }`.

- [ ] **Step 3: Verify and commit**

Run the Vitest suite, lint, typecheck and build.

```bash
git add -A src/lib/seo.ts src/lib/seo.test.ts app
git commit -m "feat(seo): page metadata, product JSON-LD, sitemap and robots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Admin inside Next.js (noindex, generated client)

**Files:**
- Create:
  - `app/admin/layout.tsx`: client boundary with `QueryClientProvider`, the existing `AdminLayout` chrome and `metadata.robots`
  - `app/admin/page.tsx` (dashboard)
  - `app/admin/login/page.tsx`
  - `app/admin/products/page.tsx`, `app/admin/categories/page.tsx`, `app/admin/orders/page.tsx`, `app/admin/settings/page.tsx`
- Modify:
  - `src/admin/**`: replace `react-router` with `next/link` / `next/navigation`
  - `src/admin/lib/adminApi.ts`: implemented on `browserApi` with the generated types
- Delete: `src/admin/AdminApp.tsx` (routing now comes from the folders).
- Re-enable and convert the admin tests.

**Interfaces:**
- **Consumes:** `browserApi` and `paths` (Task 3).
- **Produces:**
  - `adminApi` keeps its **exported function names and signatures** (`adminLogin`, `adminLogout`, `getStoreSettings`, `updateStoreSettings`, `getAdminProducts`, `createAdminProduct`, `updateAdminProduct`, `updateAdminVariant`, `getAdminCategories`, `createAdminCategory`, `updateAdminCategory`, `deleteAdminCategory`, `getAdminOrders`, `updateAdminOrderStatus`, `changePassword`), its error classes (`AdminUnauthorizedError`, `AdminApiError` with `status`) and its 401 rules. The admin pages don't change their calls.
  - The `metadata` in `app/admin/layout.tsx` is `{ title: 'Admin', robots: { index: false, follow: false } }`. The layout file is a server component that exports `metadata` and renders a client `AdminShell` from `src/admin/AdminShell.tsx`.

- [ ] **Step 1: Tests first:** convert the admin page tests to render the page components directly, with `next/navigation` mocked (Task 3 helpers).
  - The redirect-to-login test now asserts that `routerMock.replace('/admin/login')` is called. Today it asserts `window.location` or `MemoryRouter`.
  - Add a test that `app/admin/layout.tsx`'s `metadata.robots` is `{ index: false, follow: false }`.

Run: expect FAIL.

- [ ] **Step 2: Implement**

- Re-implement `adminFetch` on `browserApi`:
  - `credentials: 'include'` is already set on the client.
  - 401 handling stays identical, including the `unauthorizedIsError` special cases for login and password change.
  - Response bodies are typed by `paths`.
- The central 401 handler in the query client calls `router.replace('/admin/login')` instead of setting `window.location.href`. Pass the router in from `AdminShell`.

- [ ] **Step 3: Verify and commit**

Run the full Vitest suite (all pass, no skips), lint, typecheck and build.

```bash
git add -A app/admin src/admin
git commit -m "feat(admin): admin panel served by Next.js, noindex, on the typed API client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `/internal/revalidate` route handler

**Files:**
- Create: `app/internal/revalidate/route.ts`, `app/internal/revalidate/route.test.ts`

**Interfaces:**
- **Consumes:** the request shape from Task 2.
- **Produces:**
  - `POST /internal/revalidate`.
  - Responses:
    - wrong or missing secret → **401** `{ error: 'Unauthorized' }`
    - invalid body → **400**
    - otherwise it calls `revalidateTag(tag)` for each tag → **200** `{ revalidated: string[] }`
  - Any other method → **405** (Next.js's default for unexported methods).

- [ ] **Step 1: Test first**

```ts
// app/internal/revalidate/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: (t: string) => revalidateTag(t) }));
import { POST } from './route';

const req = (body: unknown, secret?: string) =>
  new Request('http://web/internal/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-revalidate-secret': secret } : {}) },
    body: JSON.stringify(body),
  });

describe('POST /internal/revalidate', () => {
  beforeEach(() => { revalidateTag.mockReset(); vi.stubEnv('REVALIDATE_SECRET', 's3cret'); });

  it('rejects a missing or wrong secret', async () => {
    expect((await POST(req({ tags: ['catalogue'] }))).status).toBe(401);
    expect((await POST(req({ tags: ['catalogue'] }, 'nope'))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects when the server has no secret configured', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    expect((await POST(req({ tags: ['catalogue'] }, '')))).toHaveProperty('status', 401);
  });

  it('rejects a bad body', async () => {
    expect((await POST(req({ tags: 'catalogue' }, 's3cret'))).status).toBe(400);
  });

  it('revalidates each tag', async () => {
    const res = await POST(req({ tags: ['catalogue', 'product:brass-diya'] }, 's3cret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: ['catalogue', 'product:brass-diya'] });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });
});
```

Run: expect FAIL.

- [ ] **Step 2: Implement**

```ts
// app/internal/revalidate/route.ts
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';

const ok = (a: string, b: string) =>
  a.length > 0 && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET ?? '';
  if (!ok(request.headers.get('x-revalidate-secret') ?? '', secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = body?.tags;
  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((t) => typeof t === 'string' && t.length <= 128)) {
    return Response.json({ error: 'Body must be { tags: string[] }' }, { status: 400 });
  }
  for (const tag of tags) revalidateTag(tag);
  return Response.json({ revalidated: tags });
}
```

If Next 16's `revalidateTag` signature requires a second argument (a profile), pass the documented default and note it in the report. Check the installed `next/cache` type definitions.

- [ ] **Step 3: Verify and commit**

Run the Vitest suite, lint and typecheck.

```bash
git add app/internal
git commit -m "feat(web): secret-protected /internal/revalidate endpoint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Web image, compose, CI, README; remove Vite and nginx

**Files:**
- Modify:
  - `Dockerfile` (root)
  - `.dockerignore`
  - `docker-compose.prod.yml` (`web` and `api` environment)
  - `deploy/ci.env`, `.env.production.example`
  - `.github/workflows/ci.yml`
  - `README.md`
- Delete: `vite.config.ts`, `index.html`, `deploy/nginx/`, any leftover `src/app/` directory.

**Interfaces:**
- **Consumes:** Next.js `output: 'standalone'` (Task 3); `REVALIDATE_SECRET` / `WEB_INTERNAL_URL` (Task 2); `API_INTERNAL_URL` (Task 3).
- **Produces:**
  - The web image listens on **8080** and runs as a non-root user.
  - The smoke-test requests are unchanged and still pass: `/`, `/api/health`, `/api/categories`, `/admin/settings`.

- [ ] **Step 1: Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY app ./app
COPY src ./src
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
```

**Notes:**
- `API_INTERNAL_URL` must be set **at runtime**, so the `/api` rewrite and the server fetches reach the API. Next.js reads `rewrites()` at build time in standalone mode, so also pass `API_INTERNAL_URL=http://api:4000` as a build argument and environment variable in the build stage:
  - `ARG API_INTERNAL_URL=http://api:4000`
  - `ENV API_INTERNAL_URL=$API_INTERNAL_URL`
- Keep `public/` out; the app has no `public` folder. If one is added later, also copy it.

**`.dockerignore`:**
- add `.next`, `server`, `e2e`, `test-results`, `playwright-report`, `coverage`, `**/*.test.*`, `src/test`, `.superpowers`, `.claude`, `docs`
- remove `index.html` and other Vite-only entries
- do **not** ignore `app/` or `scripts/`

- [ ] **Step 2: Compose + env files**

In `docker-compose.prod.yml`:
- the `web` service gets `environment: { API_INTERNAL_URL: http://api:4000, REVALIDATE_SECRET: ${REVALIDATE_SECRET}, NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:-http://localhost:8080} }`
- `api` takes `WEB_INTERNAL_URL` and `REVALIDATE_SECRET` from the env file

Add to `.env.production.example` (with comments) and to `deploy/ci.env` (dummy values: `REVALIDATE_SECRET=ci-dummy-revalidate-secret`, `WEB_INTERNAL_URL=http://web:8080`, `NEXT_PUBLIC_SITE_URL=http://localhost:8080`):
- `REVALIDATE_SECRET`
- `WEB_INTERNAL_URL=http://web:8080`
- `NEXT_PUBLIC_SITE_URL`

Remove `API_UPSTREAM`, which nginx used.

- [ ] **Step 3: CI**

In `.github/workflows/ci.yml`:
- **`quality`:**
  - after the installs, add `node scripts/check-openapi-drift.mjs` (needs server dependencies, already installed in this job)
  - `npm run lint` now includes the palette check
  - typecheck as before
- **`frontend-test`:** `npm test` then `npm run build` (unchanged commands; they now build Next.js). Add a `cache` step for `.next/cache` with `actions/cache@v4`, keyed on `package-lock.json` and source hashes.
- **`docker`:** unchanged steps; the web image is now Next.js.
- **`e2e`:** unchanged; Task 11 updates `playwright.config.ts`.

- [ ] **Step 4: README + cleanup**

- Delete `vite.config.ts`, `index.html` and `deploy/nginx/`.
- **README:**
  - The "Running the code" section uses `npm run dev`, which is now Next.js on port 5173, with the API on 4000.
  - The CI table describes the Docker job's web image as "Next.js standalone server (port 8080)".
  - The production-stack section drops nginx and `API_UPSTREAM` and adds `REVALIDATE_SECRET`, `WEB_INTERNAL_URL` and `NEXT_PUBLIC_SITE_URL`.
  - Add a short "API contract" section: `/api/openapi.json`, `/api/docs` (dev only), and the `npm run api:types` + drift check.

- [ ] **Step 5: Verify and commit**

Run:
- `npm run lint`, `npm run typecheck`, the Vitest suite
- YAML validation of `ci.yml` and `docker-compose.prod.yml` with `yaml.parse`
- `ENV_FILE=deploy/ci.env docker compose -f docker-compose.prod.yml config --quiet`, only if Docker responds within 10 s
- **Don't** build images locally if free RAM is under 2.5 GB; CI verifies them

```bash
git add -A Dockerfile .dockerignore docker-compose.prod.yml deploy .env.production.example .github README.md
git rm -r --cached --ignore-unmatch vite.config.ts index.html deploy/nginx
git commit -m "build: Next.js standalone web image, compose and CI updates; remove Vite and nginx

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Browser tests on the Next.js app

**Files:**
- Modify: `playwright.config.ts`, `e2e/storefront.spec.ts`, `e2e/ui-fixes.spec.ts`, `e2e/admin.spec.ts` (selectors only where the markup changed)
- Create: `e2e/seo.spec.ts`, `e2e/visual.spec.ts`

**Interfaces:**
- **Consumes:** everything above.
- **Produces:** the e2e count becomes 10 plus the new tests (record the exact number).

- [ ] **Step 1: Config**

The frontend `webServer` becomes:
- `command: 'npm run build && npm run start'`
- `url: 'http://localhost:5173'`
- `reuseExistingServer: !process.env.CI`
- `timeout: 240_000`
- `env: { API_INTERNAL_URL: 'http://localhost:4000' }`

The API `webServer` is unchanged, plus `WEB_INTERNAL_URL: 'http://localhost:5173'` and `REVALIDATE_SECRET: 'e2e-revalidate-secret'`. The frontend webServer env adds `REVALIDATE_SECRET: 'e2e-revalidate-secret'`.

- [ ] **Step 2: Existing specs**

- Run them.
- Fix selectors only where the new markup changed, such as the hero buttons now on beige. Keep every assertion's intent.
- **Always kept:**
  - the 5 MB image-weight check
  - the free-shipping check
  - the phone menu check
  - the admin password check (and its `admin.spec` ordering)

- [ ] **Step 3: New specs**

**`e2e/seo.spec.ts`:**
- **Product HTML without JavaScript:**
  1. Fetch `/product/<first API product slug>` with `request.get`.
  2. The body contains the product name, `₹<price>` and `<script type="application/ld+json">` with `"@type":"Product"`.
- **Sitemap:** `/sitemap.xml` contains `/product/<slug>` for every API product.
- **Robots:** `/robots.txt` contains `Disallow: /admin`.
- **404:** `/product/does-not-exist` returns HTTP **404** (`response.status()`).
- **Instant refresh:**
  1. Log in to the admin through `request`. Use a fresh context with the seed credentials; this spec file sorts before `admin.spec.ts`, so the password change hasn't happened yet. If ordering makes this fragile, create a dedicated test admin by running the seed with different `SEED_ADMIN_*` values instead, and note it in the report.
  2. Change a product's name with `PUT /api/admin/products/:id`.
  3. Within 10 s, `/product/<slug>` HTML shows the new name. Poll every 500 ms.
  4. Restore the old name.

**Cart persistence** (add to `ui-fixes.spec.ts`): add an item, reload, and the cart count is still 1; open the cart and the item is there.

**`e2e/visual.spec.ts`**, for each viewport (390×844, 768×1024, 1366×800):
- Visit, in order:
  1. home
  2. the first category
  3. the first product
  4. cart open
  5. checkout dialog (via Proceed to Checkout)
  6. `/product/does-not-exist`
  7. `/admin/login`
- **On each, assert:**
  - `await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)` is true
  - when a popup is open: the overlay element's computed `background-color` has alpha < 0.6 and isn't `rgb(0, 0, 0)` (read from `[data-slot$="overlay"]`), and the main page heading behind it is still attached and visible
- Save `page.screenshot({ path: test-results/visual/<viewport>-<name>.png, fullPage: true })` for the owner's review.

- [ ] **Step 4: Run the full check**

Stop anything on port 4000 first, then run:

```bash
npm run e2e
npm test -- --maxWorkers=1 --minWorkers=1
npm run lint
npm run typecheck
cd server && npm test -- --maxWorkers=1 && cd ..
```

If the machine's memory guard kills the e2e run, report that; the controller verifies in CI.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test(e2e): Next.js storefront SEO, instant refresh, cart persistence and visual checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Definition of done

- **Spec coverage:**
  - Spec §1 (architecture) → Tasks 3, 5, 6 and 10
  - §1.3 (SEO) → Task 7
  - §2 (brand) → Task 4, plus Task 11's visual check
  - §3.1–3.2 (API paths, live stock) → Tasks 3 and 5
  - §3.3 (revalidation) → Tasks 2 and 9
  - §3.4 (OpenAPI) → Tasks 1 and 3
  - §4 (backend) → Tasks 1 and 2
  - §5 (testing) → every task, plus Task 11
- On PR #5 (pushed by the controller), every CI job is green: quality (lint + palette + typecheck + audit + OpenAPI drift), frontend, backend, e2e, docker (Trivy + smoke) and ci-success.
- The owner has reviewed the screenshots in `test-results/visual/` (CI artifact).
- The living doc is updated:
  - **decision log:** the `/internal/revalidate` path and the zod-to-openapi 7.3.4 pin
  - **HLD:** now current
  - **roadmap:** piece 8 marked done
  - **LLD:** frontend section rewritten for Next.js
