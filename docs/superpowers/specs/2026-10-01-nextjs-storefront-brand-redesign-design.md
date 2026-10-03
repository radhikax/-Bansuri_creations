# Next.js Storefront + Brand Redesign — Design Spec

**Date:** 2026-10-01
**Status:** Approved in brainstorming, pending written-spec review
**Branch:** `worktree-storefront-data-wiring` (continues PR #5)
**Living doc:** "Bansuri Creations — Architecture & Design (living doc)", where the decision log
and roadmap record every choice below

## Purpose

This is sub-project 1 of the 2026-10-01 re-architecture. The current Vite single-page app is
replaced with one **Next.js 16** app that holds both the storefront and the admin panel. The UI is
restyled to the **logo's maroon and beige only**, and the dark "blank page" behind every popup is
replaced by a light veil. Two small backend pieces are added:

- an **OpenAPI contract**, so the new frontend uses a typed client
- **instant page refresh**, so cached product pages update when the admin edits something or a
  sale reduces stock

Why (from the decision log):

- Customers find the shop through Google and shared WhatsApp/Instagram links, which needs
  server-rendered pages.
- The redesign touches every page, so doing it during the migration means every page is styled once.

## Decisions taken in brainstorming

| Topic | Decision |
|---|---|
| Frontend framework | Next.js 16.3.8, App Router, **React 18.3.1** (Next 16 supports React ≥ 18.2; no React 19 upgrade) |
| Backend | Stays **one Express API**. Modularisation is sub-project 3; no microservices. |
| API style | **REST only**, plus an OpenAPI 3.1 contract generated from the existing zod schemas. GraphQL can be added later over the same services. No gRPC. |
| Admin panel | Moves inside the Next.js app at `/admin`, rendered in the browser, `noindex` |
| Palette | Logo **maroon** + logo **beige/ivory** only, in step scales. No gold, rose, sage, red or Tailwind default colours. |
| Popups | A light ivory veil (about 45% opacity) behind every drawer and dialog; one popup at a time |
| Freshness | Pages are cached and refreshed every 5 minutes, refreshed instantly on admin edits and on sales, and the product page checks live stock in the browser |
| Scope | The OpenAPI contract and the revalidation hook are built **in this sub-project** |

## Out of scope

- **Checkout payment wiring** (sub-project 2, built on the new app once this lands). The cart's
  checkout form is migrated and restyled as is: the Pay button stays a demo.
- **Backend reorganisation into modules, database review, GraphQL** (sub-project 3).
- **Deployment to a real host** (sub-project 4).
- Real product photos (the owner adds them later through the admin panel).

---

## 1. App architecture

### 1.1 Project layout

The Next.js app replaces the Vite app **at the repo root**. `server/` is unchanged apart from §4.

```
app/                        # Next.js App Router
  layout.tsx                # <html>, fonts, CartProvider, Header, Footer, Toaster
  page.tsx                  # Home (ISR)
  category/[slug]/page.tsx  # Category (ISR)
  product/[slug]/page.tsx   # Product (ISR + live stock)
  not-found.tsx             # Branded 404 (HTTP 404)
  error.tsx                 # Branded error with Retry
  loading.tsx               # Skeleton (per segment where useful)
  sitemap.ts, robots.ts
  _internal/revalidate/route.ts   # POST, secret-protected (§3.3)
  admin/                    # Client-rendered admin (layout + pages), noindex
src/                        # Existing components, lib and ui kit, moved/adapted
  components/  lib/  styles/  admin/
next.config.ts              # rewrites, images.remotePatterns, output: 'standalone'
```

- **Migrated as-is (logic unchanged):** existing components (`ProductCard`, `CategoryCard`,
  `ImageGallery`, `Header`, `Footer`, `Hero`, `Cart`) and libs (`adapters`, `shipping`,
  `useVariantSelection`, `flyToCart`).
- **Server vs client components:** components that use state or effects are marked
  `'use client'`; page shells are server components.
- **Removed:**
  - `react-router-dom`. Routing becomes file-based, links become `next/link`, and `useParams`
    is replaced by the page's `params`.
  - Vite itself: `vite.config.ts`, `index.html`, `src/main.tsx`, the Vite proxy.
  - The nginx web image: `deploy/nginx/`.

### 1.2 Rendering per route

| Route | Mode | Notes |
|---|---|---|
| `/` | Static, ISR `revalidate = 300` | Tag `catalogue` |
| `/category/[slug]` | Static per slug, ISR 300, `dynamicParams = true` | Tags `catalogue`, `category:<slug>`. Unknown slug → `notFound()` (HTTP 404). |
| `/product/[slug]` | Static per slug, ISR 300, `dynamicParams = true` | Tags `catalogue`, `product:<slug>`. Unknown or inactive → `notFound()`. A client component fetches live variant stock on mount (§3.2). |
| `/admin/*` | Client-rendered | `robots: noindex, nofollow` in the admin layout metadata. Cookie auth and TanStack Query as today. |
| `/sitemap.xml` | Generated, ISR 3600 | Home, every category, every active product |
| `/robots.txt` | Static | Allow `/`, disallow `/admin`, link the sitemap |

- **Builds never call the API.** `generateStaticParams` returns `[]`, so pages render on first
  request and are then cached. A deploy can't fail because the API is unavailable.

### 1.3 SEO

- **Every storefront page sets** `generateMetadata`: title, description, canonical URL and Open
  Graph data (title, description, image, `og:type`).
- **Product pages also carry structured data:**
  - Open Graph `product:price:amount` / `currency`
  - JSON-LD `Product`: name, images, description, `offers.price` and `priceCurrency: INR`,
    `availability` (InStock or OutOfStock from the variants)
- **Site URL:** `NEXT_PUBLIC_SITE_URL` sets `metadataBase` (default `http://localhost:8080`).

### 1.4 Cart

- A `CartProvider` (React context) in the root layout holds the cart, persisted to `localStorage`
  under `bansuri-cart-v1`. It's loaded after mount, which avoids hydration mismatches.
- The cart survives reloads and navigation. Items keep the `productId::variantId` id and gain an
  explicit `variantId` field (needed by checkout in sub-project 2).
- The shipping calculation is unchanged: `calculateShipping` plus settings from
  `GET /api/settings/shipping`, fetched on the client.

### 1.5 Images

- `next/image` replaces `<img>`, `ShimmerImage` and the Unsplash helper `lib/images.ts`, for
  any host listed in `images.remotePatterns`: `images.unsplash.com` now, the owner's photo host
  later. This closes the "resize self-hosted photos" follow-up.
- Each image sets `sizes` to match its layout:
  - card: `(min-width:1024px) 25vw, (min-width:768px) 50vw, 100vw`
  - gallery main: `(min-width:768px) 50vw, 100vw`
- Hero and product main images use `priority`; everything else lazy-loads.
- The Playwright image-weight test (home under 5 MB) stays.

### 1.6 Deployment shape

- **Web image** (root `Dockerfile`):
  - Built with `output: 'standalone'` on `node:24-bookworm-slim`.
  - Runs as a non-root user on port **8080**, with health check `GET /`.
  - Environment: `API_INTERNAL_URL` (default `http://api:4000`), `REVALIDATE_SECRET`,
    `NEXT_PUBLIC_SITE_URL`.
- **Compose:**
  - The `web` service gets those env vars.
  - The `api` service gets `WEB_INTERNAL_URL=http://web:8080` and `REVALIDATE_SECRET`.
  - `deploy/ci.env` gets dummy values for both.
- **CI:**
  - Same jobs and the same smoke-test requests.
  - The `frontend-test` job runs `next build`. Lint, typecheck and audit cover the new app.
  - Trivy scans the new web image.
- **README:** the CI and production-stack sections are updated.

---

## 2. Brand design system

### 2.1 Palette (the only colours allowed)

The values are a starting point, to be fine-tuned against the logo during implementation. Every
pair must pass §2.3.

| Token | Value | Role |
|---|---|---|
| `--maroon-950` | `#2B0505` | Strongest text (headings) |
| `--maroon-900` | `#3D0707` | Body text |
| `--maroon-800` | `#5A0A0A` | **Brand**: primary buttons, links, prices, focus ring |
| `--maroon-700` | `#741A1A` | Hover and pressed states |
| `--maroon-600` | `#8C3A35` | Secondary text (muted) |
| `--maroon-200` | `#E6CFC8` | Badges, selected size pill background |
| `--maroon-100` | `#F3E4DF` | Subtle maroon tint (hover rows) |
| `--beige-50` | `#FBF8F3` | Page background |
| `--beige-100` | `#F4EEE4` | Cards, drawer and dialog surfaces |
| `--beige-200` | `#EADFCF` | Sections, inputs, skeletons |
| `--beige-300` | `#DCCDB8` | Borders, dividers |

The semantic tokens (`--background`, `--foreground`, `--primary`, `--muted`, `--border`,
`--ring`, `--card`, ...) map onto these.

**Removed** from `theme.css` and every usage replaced with an approved token:

- `--accent-gold`, `--accent-rose`, `--accent-sage` and red `--destructive`
- the dark theme block, since the shop has one brand look
- Tailwind default colour classes, which today appear as `text-yellow-400` (stars),
  `text-white`, `bg-gray-100`, `border-white` and `bg-black/50`

### 2.2 States without extra colours

- **Errors:** maroon text plus an alert icon (`lucide-react`) plus plain wording; input borders
  switch to `--maroon-800`.
- **Success** (toasts, saved): a check icon plus wording on `--beige-100`.
- **Discount badges and star ratings:** maroon on maroon-200 or beige.
- **Disabled:** `--maroon-600` text on `--beige-200` at reduced opacity. Contrast doesn't apply
  to disabled controls, but disabled controls must still be readable.

### 2.3 Enforcement (CI)

- **Contrast test** (`src/styles/contrast.test.ts`) computes the WCAG 2.1 contrast ratio for
  each declared pair:
  - **≥ 4.5:1** for text pairs: body text on background, muted text on background, button text
    on primary, text on card, text on badge
  - **≥ 3:1** for UI pairs: border on background, focus ring on background
- **Palette lint** (`scripts/check-palette.mjs`, run in the `quality` job) fails on:
  - any Tailwind colour utility outside the token names, across `bg|text|border|fill|stroke|ring|from|to|via`
  - hex or rgb literals in `app/`, `src/components/` or `src/admin/` (only `src/styles/theme.css`
    may define colours)

### 2.4 Popups (veil + one at a time)

- `SheetOverlay`, `DialogOverlay` and `AlertDialogOverlay` use beige-50 at 45% opacity
  (Tailwind 4: `bg-(--beige-50)/45`), with **no blur and no black**. The page stays visible, softened.
- **Proceed to Checkout** closes the cart sheet and then opens the checkout dialog, so overlays
  never stack. The dialog has a **Back to cart** button that reopens the sheet.
- The drawers and dialogs themselves sit on a `--beige-100` surface with a `--beige-300` border
  and a soft shadow.

### 2.5 Typography and layout

- Fonts stay as they are: Cormorant Garamond for headings, Inter for body, loaded with
  `next/font`, which removes the Google Fonts `@import`.
- The sticky header reserves its height (`scroll-margin-top` on anchors).
- No page scrolls sideways at 390, 768 or 1366 px.

### 2.6 Visual quality gate

- **Playwright spec** `e2e/visual.spec.ts` screenshots home, category, product, cart open,
  checkout dialog, 404, `/admin` login, products, orders and settings at **390 / 768 / 1366**
  widths.
- **It asserts:**
  - no horizontal overflow: `document.documentElement.scrollWidth <= innerWidth`
  - popups show the veil: the overlay's computed background has alpha < 0.6 and isn't black
  - the page content is still visible underneath
- The screenshots are saved as CI artifacts. The owner reviews them once before sign-off; these
  are not pixel-diff snapshots.

---

## 3. API usage from the frontend

### 3.1 Two paths, one REST API

| Who calls | Path | Used for |
|---|---|---|
| Next.js server (server components, sitemap) | `API_INTERNAL_URL` + `/api/...`, directly | Catalogue reads during rendering, with `fetch` cache tags and `revalidate` |
| Browser | `/api/*` → Next.js `rewrites` → `API_INTERNAL_URL` | Live stock, shipping settings, the checkout form, all admin calls (keeps the cookie first-party) |

- **No Next.js Server Actions and no Next-side API routes** that duplicate business logic. The
  only Next route handler is `/_internal/revalidate`.

### 3.2 Live stock check

- Product pages render variants from the cached page, then a client hook calls
  `GET /api/products/:slug` on mount and updates each size's stock and in-stock state.
- If the call fails, the cached values stay on screen; checkout's server-side 409 remains the
  final guard.

### 3.3 Instant refresh (revalidation hook)

- **Next.js side:** `POST /_internal/revalidate`
  - Header `x-revalidate-secret` must equal `REVALIDATE_SECRET`, or it returns **401**.
  - Body `{ tags: string[] }`. It calls `revalidateTag` for each tag and returns
    `{ revalidated: tags }`.
- **Express side:** a new `services/revalidate.ts` with `revalidate(tags)`.
  - It POSTs to `WEB_INTERNAL_URL/_internal/revalidate` with a 3 s timeout.
  - It is fire-and-forget: failures are logged and never fail the request.
  - It is a no-op when `WEB_INTERNAL_URL` or `REVALIDATE_SECRET` is unset (local dev and tests).
- **Triggers** (after a successful database write):

| Trigger | Tags |
|---|---|
| Admin product create or update, variant update | `catalogue`, `product:<slug>` |
| Admin category create, update or delete | `catalogue`, `category:<slug>` |
| Admin settings update | `catalogue` |
| Order marked PAID (webhook stock decrement) | `product:<slug>` for each product in the order |

- **Startup check:** `validateEnv` treats `REVALIDATE_SECRET` as optional. It logs a warning in
  production when it's unset, because pages then fall back to the 5-minute refresh.

### 3.4 OpenAPI contract and typed client

- **Backend:**
  - `@asteasolutions/zod-to-openapi` registers every route's request and response zod schemas.
  - Responses that today have no zod schema get one.
  - A generator writes `server/openapi.json` (OpenAPI 3.1), served at `GET /api/openapi.json`.
  - Swagger UI is served at `/api/docs` when `NODE_ENV !== 'production'`.
- **Frontend:**
  - `openapi-typescript` generates `src/lib/api/schema.d.ts` from `server/openapi.json`.
  - `openapi-fetch` creates two clients: `serverApi` (base `API_INTERNAL_URL`, used in server
    components) and `browserApi` (base `''`, so `/api`).
  - The hand-written types in today's `lib/api.ts` and `admin/lib/adminApi.ts` are replaced.
    Admin keeps its 401 handling and its wrong-password special case.
- **CI drift check:** the `quality` job regenerates both files and fails if `git diff` shows a
  change. A backend change that breaks the frontend therefore fails `typecheck`.
- **GraphQL-ready rule:** Express route handlers stay thin and call service functions. This spec
  doesn't restructure modules (sub-project 3), but new code follows the rule.
- **Versioning:** `/api` stays unprefixed. A future breaking change ships as `/api/v2/...`, with
  `deprecated: true` on the old operation.

---

## 4. Backend changes (this sub-project only)

| File | Change |
|---|---|
| `server/src/openapi/registry.ts` (new) + `scripts/generate-openapi.ts` (new) | Route and schema registration; writes `server/openapi.json` |
| `server/src/app.ts` | `GET /api/openapi.json`; `/api/docs` outside production |
| `server/src/services/revalidate.ts` (new) | `revalidate(tags)`, fire-and-forget |
| Admin product, category and settings routes; `services/payments` or the webhook | Call `revalidate(...)` after successful writes (§3.3) |
| `server/src/config/env.ts` | Optional `WEB_INTERNAL_URL`, `REVALIDATE_SECRET` (a production warning when the secret is unset) |
| `server/package.json` | `@asteasolutions/zod-to-openapi`, `swagger-ui-express`; scripts `openapi:generate` |

No database or schema changes.

---

## 5. Testing

- **Unit and component tests (Vitest):**
  - The existing 192 tests are migrated to the Next.js layout. Router-based tests use
    `next/navigation` mocks; MSW stays.
  - Components keep their tests, including the ref-warning guard.
  - **New tests:**
    - the contrast test
    - `CartProvider` persistence: survives a remount and ignores corrupt storage
    - the checkout dialog closes the sheet, and "Back to cart" reopens it
    - the live stock hook
    - the revalidate route handler: 401 without the secret, and it calls `revalidateTag`
- **Backend:**
  - The existing 149 tests stay.
  - **New tests:**
    - `revalidate()` is a no-op without config, swallows failures, and sends the correct tags
      and secret
    - every trigger in §3.3 calls it with the right tags (service mocked)
    - `GET /api/openapi.json` returns valid OpenAPI 3.1 that includes every route
- **End-to-end (Playwright):**
  - The existing 10 specs are retargeted to `next build && next start` on port 5173.
  - New `visual.spec.ts` (§2.6).
  - New SEO checks:
    - the product page HTML (fetched without JavaScript) contains the product name, price
      and JSON-LD
    - `/sitemap.xml` lists products
    - an unknown product returns HTTP 404
  - New check: the cart survives a reload.
- **CI:** all jobs green, including the palette lint, contrast test, OpenAPI drift check,
  Docker build, Trivy and the compose smoke test.

## Definition of done

- One Next.js app serves the storefront and the admin panel, and the Vite app, react-router and
  nginx image are gone.
- Storefront HTML is server-rendered with SEO metadata, JSON-LD, sitemap, robots and real 404s.
- Only maroon and beige tokens are used, enforced by the palette lint and the contrast test.
  Every popup uses the light veil, with one popup at a time.
- Product pages refresh within seconds of an admin edit or a sale. Stock is checked live.
- The frontend uses a client generated from the OpenAPI contract. CI fails on contract drift.
- All suites pass in CI.
- The owner has reviewed the visual screenshots.
- The living doc's decision log, HLD and roadmap are updated.
