# Storefront & Admin Hardening — Design Spec

**Date:** 2026-09-24
**Status:** Approved in brainstorming, pending written-spec review
**Branch:** `worktree-storefront-data-wiring` (builds on HEAD `41815a4`)

## Purpose

Close the known gaps left after the storefront data wiring, the admin UI, and
their final reviews, so the branch is safe to merge and deploy:

1. The admin can't change the seeded password (`changeme123`).
2. The admin session cookie is sent only to the same site, so admin login breaks when
   the frontend and API are deployed on different domains, as the server
   README's deployment section sets up.
3. Minor issues from the storefront final review
   (`.superpowers/sdd/2026-09-18-storefront-data-wiring/final-review.md`).
4. Nobody has seen the storefront or admin run in a real browser.

## Out of scope

- **Checkout wiring.** Cart → `POST /api/orders` → Razorpay Checkout →
  confirmation. The "Place order" button in `Cart.tsx` still fires a demo
  `alert`. This gets its own spec next.
- **Razorpay keys.** `RAZORPAY_KEY_ID` is empty in `server/.env`, which makes
  `POST /api/orders` return 500 after committing a `PENDING` order. That only
  matters once checkout is wired, so it belongs to the checkout spec.
- **Final-review M6** (building the adapted arrays once with `useMemo` in
  `App.tsx`). The reviewer judged the cost negligible at 17 products, so it's
  deliberately skipped.
- Picking a frontend hosting provider.

---

## 1. Admin password change

### Schema

Add a nullable column to `AdminUser` in one new migration:

```prisma
model AdminUser {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  passwordChangedAt DateTime?
  createdAt         DateTime  @default(now())
}
```

### API: `POST /api/admin/password`

- Protected by the existing `adminAuth` middleware.
- Body is validated with zod: `{ currentPassword: string, newPassword: string }`.
- Responses:

| Condition | Status | Body |
|---|---|---|
| Body fails validation | 400 | `{ error: 'Invalid payload' }` |
| `newPassword.length < 8` | 400 | `{ error: 'New password must be at least 8 characters' }` |
| `newPassword === currentPassword` | 400 | `{ error: 'New password must be different from the current password' }` |
| `currentPassword` doesn't match the stored hash | 401 | `{ error: 'Current password is incorrect' }` |
| Success | 200 | `{ success: true }` |

- **On success:**
  - Hash `newPassword` with bcrypt (cost 10, same as the seed).
  - Set `passwordChangedAt` to now, rounded down to the whole second.
  - Issue a fresh `admin_session` cookie with the same JWT payload and cookie options as login. That way this browser stays logged in.
- **Reusing the cookie code:** move the cookie-setting code from `POST /login` into a shared helper (`setAdminSessionCookie(res, adminId)`), used by both login and password change.

### Invalidating other sessions

`adminAuth` currently only verifies the JWT. After this change it will:

1. Verify the JWT, as today.
2. Load the `AdminUser` by `adminId`. If it's missing, return 401.
3. If `passwordChangedAt` is set and `jwt.iat` (seconds) is less than
   `passwordChangedAt` in whole seconds, return 401 `{ error: 'Not authenticated' }`.

Why the rounding and the `<` comparison matter: `iat` has one-second
resolution. The fresh cookie from step "On success" is issued in the same
second as `passwordChangedAt`, so `iat` equals it rather than being less
than it, and the new session stays valid. Any session issued in an earlier
second is rejected.

This adds one indexed primary-key lookup per admin request, which is
acceptable at this scale.

### Admin UI

- **`adminApi.ts`:** add `changePassword(currentPassword, newPassword): Promise<void>`. It follows the existing request helper's error handling: a 401 from this endpoint is a wrong-password error, not an expired session, so it must not trigger the "logged out" redirect. It's the same special case the login call already makes.
- **`SettingsPage.tsx`:** add an "Account" card with three password fields: current, new, confirm.
  - Client-side checks, before any request: all fields filled, new password at least 8 characters, confirm matches new.
  - Server errors show inline under the form.
  - On success: clear the fields and show a success toast (`sonner`, as used elsewhere).

### Tests

- **Backend (`server/tests/admin/password.test.ts`):**
  - no cookie → 401
  - wrong current password → 401
  - too short → 400
  - same as current → 400
  - success → 200 with a `Set-Cookie`
  - an old cookie issued before the change is rejected by another admin route
  - the new cookie is accepted
  - log in with the old password → 401, with the new one → 200
- **Backend (`adminAuth`):** a token whose `iat` is in the same second as `passwordChangedAt` is accepted.
- **Frontend (`SettingsPage.test.tsx`):** client-side checks block the request, a server error renders inline, and success clears the form.

---

## 2. Same-origin `/api`

### Frontend

- `src/app/lib/api.ts` and `src/app/admin/lib/adminApi.ts`: change the
  default `API_BASE_URL` from `'http://localhost:4000'` to `''`, so requests
  go to relative `/api/...`. `VITE_API_BASE_URL` still overrides it.
- `vite.config.ts`: add
  ```ts
  server: { proxy: { '/api': 'http://localhost:4000' } }
  ```
  With this, local dev behaves like production: same origin, and the cookie is first-party.
- Unit tests that mock absolute `http://localhost:4000/api/...` URLs are
  updated to the relative paths.

### Server

- The cookie stays `sameSite: 'lax'`, with `secure` in production, unchanged.
- The CORS setup stays as it is, so an explicit cross-origin `VITE_API_BASE_URL` still works for API reads.

### README (`server/README.md`, deployment + known limitations)

- Add a deployment step: the frontend host must rewrite `/api/*` to the
  deployed API. Include two short examples:
  - Vercel `vercel.json`:
    `{ "rewrites": [{ "source": "/api/:path*", "destination": "https://<api-host>/api/:path*" }] }`
  - Netlify `_redirects`: `/api/*  https://<api-host>/api/:splat  200`
- Rewrite "Known limitations for cross-origin frontend deployment":
  - Remove the `sameSite` item. The proxy setup replaces it; say why a `SameSite=None` cookie was rejected: browsers are phasing out third-party cookies.
  - Remove the Express async-error item. It's already fixed: every route uses `asyncHandler`, and the webhook has its own handling.
- Don't commit any host config file, since the host isn't chosen yet.

---

## 3. Final-review fixes

| ID | Change | Test |
|---|---|---|
| M1 + name-match minor | `adaptProduct` adds `categorySlug` (from `api.category.slug`) to the adapted product. `CategoryPage` filters products by `categorySlug === slug` instead of display name. When no category matches the route slug, it renders "Category not found" with a link to `/`. | `CategoryPage.test.tsx`: an unknown slug shows "Category not found"; filtering uses the slug, shown with two categories that share a display name. `adapters.test.ts`: `categorySlug` is mapped. |
| M2 | The app-level error message changes to "Couldn't load products or categories. Please try again." | Update the existing App error-state test. |
| M3 | Add a JSDoc comment on `useApiData` saying the fetcher runs once on mount and later changes to `fetcher` are ignored on purpose. | None (comment only). |
| M4 | `fetchJson` in `api.ts` aborts after 10 000 ms (`AbortSignal.timeout(10_000)`). A timeout rejects like any other fetch failure, so `useApiData` shows its existing error state. | `api.test.ts` (or the existing api test file): a request that never resolves rejects once the timeout passes, using fake timers or a short injected timeout. |
| M5 | Root `.gitignore` adds `.env`, `.env.local` and `.env.*.local`. `.env.example` stays tracked. | None. |
| I2 residual | `adaptProduct.inStock = api.variants.some(v => v.stock > 0)`. | `adapters.test.ts`: first variant out of stock but another in stock gives `inStock: true`. All out of stock gives `false`. |

---

## 4. Playwright smoke tests

### Setup

- Add dev dependency `@playwright/test`. Only Chromium is installed
  (`npx playwright install chromium`).
- Add root script `"e2e": "playwright test"`, with `playwright.config.ts` at the root and tests in `e2e/`.
- Make sure Vitest's `include: ['src/**/*.test.{ts,tsx}']` doesn't pick up `e2e/` (it already doesn't), and exclude `e2e/` from anything else that globs tests.
- **Separate database: `ecommerce_e2e`.**
  - A Playwright `globalSetup` runs `npx prisma migrate reset --force` against `ecommerce_e2e` (from `server/`), which drops it, re-migrates and re-seeds.
  - This matters because the seed's admin `upsert` never resets an existing password, and the admin test changes it.
- **`webServer`** (two entries):
  - API: `npm run dev` in `server/` with `DATABASE_URL` set to the `ecommerce_e2e` URL, waiting on `http://localhost:4000/api/health`, with **`reuseExistingServer: false`**.
    - A dev API that's already running would be pointed at `ecommerce_dev`, and the admin test would change the dev admin's password.
    - With reuse off, Playwright fails fast with "port already in use" instead. The README tells developers to stop their dev API before running `npm run e2e`.
  - Frontend: `npm run dev -- --port 5173`, waiting on `http://localhost:5173`, with `reuseExistingServer: !process.env.CI`. The frontend holds no data, so reusing it is safe.
- Keep screenshots and traces on failure (`screenshot: 'only-on-failure'`, `trace: 'retain-on-failure'`).
- README one-time steps:
  `docker compose exec postgres createdb -U ecommerce ecommerce_e2e`, then
  `npx playwright install chromium`.
- Add `test-results/` and `playwright-report/` to `.gitignore`.

### Tests (`e2e/`)

1. **`storefront.spec.ts`: home page.** 5 category cards whose names match `GET /api/categories`, and at least one product card whose name matches a product from `GET /api/products`. The test fetches those names through Playwright's `request` fixture, not from hardcoded lists.
2. **`storefront.spec.ts`: cart.**
   - Click "Add to Cart" on a product card: the cart drawer opens and shows that product's name and price.
   - Increase the quantity: the line total and cart total both double.
3. **`storefront.spec.ts`: category navigation.** Clicking a category card goes to `/category/<slug>`, and every product shown belongs to that category (checked against `GET /api/products?category=<slug>`). Browser Back returns to `/` with categories still shown.
4. **`storefront.spec.ts`: unknown category.** `/category/does-not-exist` shows "Category not found".
5. **`storefront.spec.ts`: API down.** `page.route('**/api/**', r => r.abort())` before loading `/`: the error message is shown, and the page isn't blank or crashed.
6. **`admin.spec.ts`: password change and session invalidation.**
   1. Context B logs in with the seed credentials.
   2. Context A logs in with the seed credentials, changes the password on Settings, and sees the success toast.
   3. Context A reloads an admin page and stays logged in.
   4. Context B navigates to an admin page and ends up on the login screen.
   5. Logging in with the old password fails, and logging in with the new password succeeds.

---

## Definition of done

- `npm test` (frontend), `cd server && npm test` (backend), and `npm run e2e` all pass.
- `npm run build` is clean.
- `server/README.md` and the root README cover the proxy deployment step and the one-time e2e setup.
- The final-review items M1–M5, the I2 residual, and the name-match minor are resolved as described in Section 3.
