# Storefront Data Wiring — Design Spec

**Date:** 2026-09-18
**Status:** Approved, pending implementation plan

## Context

The React storefront (`src/app/*`) currently renders from a hardcoded
`products`/`categories` array in `App.tsx`. A separate backend API
(`server/`, Express + Prisma + Postgres + Razorpay) now exists — merged
via PR #3 — exposing `GET /api/categories` and `GET /api/products`
(optionally filtered by `?category=<slug>`) among other endpoints.

This is the first of three independent sub-projects that together make
up "frontend integration," decomposed because each is separately
shippable and testable:

1. **Storefront data wiring** (this spec) — replace hardcoded data with
   real API calls. No checkout, no payments, no admin UI.
2. **Checkout flow** (future spec) — Cart → a new `CheckoutPage` →
   `POST /api/orders` → Razorpay Checkout widget → a new
   `OrderConfirmationPage`.
3. **Admin UI** (future spec) — login + product/category/order/settings
   management screens against the existing admin API.

This spec covers only #1. Cart *adding/removing/updating quantity*
stays exactly as it works today (local component state) — nothing
here talks to the backend for cart or checkout purposes.

## Goals

- The storefront (home page, category pages) shows real data from the
  live API instead of hardcoded mock data.
- No visual/behavioral regression: existing components render the
  same way they do today, given equivalent data.
- Establish the API-calling conventions (env var, client shape, error
  handling) that the checkout and admin sub-projects will reuse.

## Non-goals

- Checkout, payment, order creation, or order lookup.
- Admin authentication or admin screens.
- Variant selection UI (size/quantity pickers beyond what exists today).
- A data-fetching library (React Query/SWR) — explicitly deferred; can
  be introduced later if a future sub-project's needs justify it.

## Architecture

Three new modules under `src/app/lib/`:

- **`api.ts`** — a small typed HTTP client: `getCategories(): Promise<ApiCategory[]>`
  and `getProducts(categorySlug?: string): Promise<ApiProduct[]>`, built
  on plain `fetch` against `import.meta.env.VITE_API_BASE_URL` (default
  `http://localhost:4000` for local dev). Throws on a non-2xx response
  or network failure; callers handle the rejection.
- **`useApiData.ts`** — a small generic hook: `useApiData<T>(fetcher: () => Promise<T>): { data: T | null; loading: boolean; error: string | null }`.
  Runs the fetcher once on mount. No caching, no refetch-on-focus, no
  retry — deliberately minimal per the project's current style.
- **`adapters.ts`** — pure mapping functions: `adaptCategory(api: ApiCategory): Category`
  and `adaptProduct(api: ApiProduct): Product`. This is where the shape
  mismatch between the backend and the existing frontend types gets
  absorbed, so every downstream component keeps working unmodified.

`ApiCategory`/`ApiProduct` types (matching the backend's actual JSON
shape) live alongside the client in `api.ts` or a small `apiTypes.ts` —
kept separate from the frontend's own `Product`/category types in
`types.ts`, which stay exactly as they are except for one field change
below.

## Type changes

`src/app/types.ts`'s `Product.id` changes from `number` to `string`, to
hold the backend's real Prisma cuid IDs. This is the one breaking change
to the existing type. `id` is never displayed, formatted as a number, or
arithmetic'd on anywhere in the current codebase — it's purely an opaque
key used for equality checks (`Cart`'s item matching, `find`/`filter` by
id) — so the change is mechanical: `Cart.tsx`'s `CartItem`/`item.id`
comparisons, `App.tsx`'s `handleUpdateQuantity`/`handleRemoveItem`
(`productId: number` → `string`), and any other `Product['id']`
consumers follow the type through (TypeScript will flag every call site
that needs updating).

No other field on `Product` changes — the adapter absorbs `basePrice`→`price`,
`imageUrl`→`image`, `category.name`→`category`, and variant collapsing
(below), so `ProductCard`, `HomePage`, `CategoryPage`, etc. need no
changes at all.

## Variant handling

Backend products can have multiple `ProductVariant`s at different prices
(e.g. "Kanha Ji Dress": Small/Medium/Large). The adapter collapses each
backend `Product` to **one** frontend `Product`, using the first/default
variant's `price ?? basePrice` for `price` and `stock > 0` for `inStock`.
This intentionally undersells the real catalog richness (no size
selector) — that's in scope for the checkout sub-project, not this one.
`originalPrice` maps from the backend's `originalPrice` field directly
(unrelated to variants).

## Data flow

`App.tsx`:
- Calls `useApiData(getCategories)` and `useApiData(() => getProducts())`
  once on mount (two independent hook calls, two independent loading/error
  states).
- Maps each result through the corresponding adapter before passing down
  to `HomePage`/`CategoryPage` — same prop shapes as today.
- Renders a skeleton grid while either is loading, and an inline
  "Couldn't load products/categories" message in place of the grid on
  error, with the rest of the page (header, footer) intact.

`CategoryPage`'s `?category=<slug>` filtering **stays client-side**,
filtering the already-fetched full product list — no second network
call per category click. This trades a slightly larger initial payload
(14 products) for simplicity and one fewer loading state to handle; a
future sub-project can switch to server-side filtering if the catalog
grows large enough to matter.

**Found during design review, folded into this sub-project's scope:**
`CategoryPage` currently has its own hardcoded `categoryMap` (URL slug →
display name) it uses to both render the page title and filter
`products` by `p.category === categoryName`. It happens to exactly match
the 5 real seeded categories today, but it's duplicated, driftable mock
data — the same category of problem this whole sub-project exists to
remove. `App.tsx` now passes the real fetched (adapted) `categories`
list down to `CategoryPage` as a new prop; `CategoryPage` looks up the
matching category by slug from that list for both the display name and
the filter key, and the hardcoded `categoryMap` is deleted.

Cart behavior (add/remove/update quantity, the cart drawer) is
completely unchanged — it operates on the adapted `Product`/`CartItem`
shapes exactly as it does today, just now populated from real data.

## Error handling

- **Loading:** simple skeleton/spinner in place of the product/category
  grid.
- **Fetch failure** (network error, non-2xx, backend down): inline
  "Couldn't load products/categories, please try again later" message
  where the grid would render. No retry button, no error boundary — a
  page refresh is the recovery path for now, consistent with the
  project's current minimal-polish level.
- **CORS:** the backend's existing CORS config (`FRONTEND_ORIGIN` +
  `credentials: true`, from Task 1/11/19 of the backend plan) already
  targets `http://localhost:5173` by default, matching Vite's default
  dev port — no proxy config needed in `vite.config.ts` for local dev.

## Testing

No test runner is currently configured for the frontend (`package.json`
has no `test` script and no testing library installed) — this spec does
not introduce one. Verification is manual: run both the backend
(`cd server && npm run dev`) and frontend (`npm run dev`) together, and
confirm the home page and a category page render real seeded data,
loading state is visible briefly, and the error state renders correctly
when the backend is stopped.

## Environment

New `.env` (or `.env.local`) at the repo root (Vite convention):
```
VITE_API_BASE_URL=http://localhost:4000
```
Falls back to `http://localhost:4000` in code if unset, so local dev
works without creating this file, but it should exist for clarity and
to make the production value (once deployed) an obvious place to set.
