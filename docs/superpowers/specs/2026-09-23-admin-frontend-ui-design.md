# Admin Frontend UI — Design Spec

**Date:** 2026-09-23
**Status:** Approved, pending implementation plan

## Context

The backend admin API (`server/src/routes/admin/*`) is complete and
tested: session-cookie login/logout, product + variant CRUD (including
the `images` gallery array), category CRUD, order listing + status
updates, and shipping settings. Nothing in the frontend (`src/app/*`)
calls any of it — there is no admin UI at all today.

This is sub-project 3 of "frontend integration" (named as a future
spec in `2026-09-18-storefront-data-wiring-design.md`), following
storefront data wiring (done) and the checkout flow (done). It's the
last of the three.

## Goals

- An admin can log in and manage products (with variants and an image
  gallery), categories, orders (list, filter, status transitions), and
  shipping settings, entirely through a UI — no direct API calls or DB
  access needed for day-to-day store operation.
- Reuses the existing design system (`components/ui/*`: Button,
  Dialog, AlertDialog, Input, Label, Table, Select, Badge) and routing
  (`react-router-dom` v7) already in the app — no new UI kit.
- Session handling is centralized: any `401` from any admin endpoint,
  anywhere in the admin UI, bounces to `/admin/login` the same way.

## Non-goals

- **File upload.** Product images are pasted URLs (text inputs), same
  as the backend already expects (`imageUrl`/`images` are plain
  strings). Real file upload would need new backend storage
  infrastructure — out of scope.
- **Production cross-origin cookie behavior.** The admin session
  cookie is `sameSite: 'lax'`. That is a separate, already-identified
  follow-up (deployment topology: same-origin proxy vs.
  `sameSite: 'none'` + `secure`), deliberately deferred to its own
  design pass once the deployment shape is decided. This spec only
  needs local dev to work, which it already does without any change
  (see **Local dev networking** below).
- **Client-side schema validation.** Forms submit raw values; the
  server's existing Zod validation is the single source of truth. A
  `400` response's `error`/`details` renders inline on the form. No
  duplicated validation schema on the client.
- **Analytics/charts.** The dashboard page shows simple counts only.
  `recharts` (already an unused dependency from the Figma Make
  template) is not used here.
- **A separate app.** Admin routes live inside the existing Vite app,
  not a second package — see **Architecture**.

## Architecture

New routes under `/admin/*`, added to `App.tsx`'s existing
`<Routes>`, lazy-loaded via `React.lazy`/`Suspense` so
`@tanstack/react-query` and the whole admin bundle are only fetched by
someone who actually navigates to `/admin`.

```
src/app/admin/
  AdminApp.tsx          # <QueryClientProvider> + <Routes> for everything under /admin
  AdminLayout.tsx        # top nav (Dashboard/Products/Categories/Orders/Settings/Logout)
                          # + auth bootstrap check + <Outlet/>
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    ProductsPage.tsx     # list + create/edit dialog + per-product variant sub-table
    CategoriesPage.tsx   # list + create/edit dialog + delete confirm
    OrdersPage.tsx        # list + status filter + per-row status <Select>
    SettingsPage.tsx     # shipping fee / free-shipping threshold form
  lib/
    adminApi.ts          # typed fetch functions per endpoint, credentials: 'include'
    useAdminQueries.ts    # useQuery/useMutation wrappers per resource
```

**New dependency:** `@tanstack/react-query` (~13kb gzip). Used for
every list (`useQuery`) and every create/edit/delete
(`useMutation`, invalidating the relevant list query on success) —
removes the need to hand-write refetch-after-save logic on each of
the 5 pages.

**Local dev networking:** no Vite proxy needed. The storefront already
calls the API cross-origin locally (`VITE_API_BASE_URL=http://localhost:4000`
from a `localhost:5173` page) with the backend's existing
`cors({ origin: FRONTEND_ORIGIN, credentials: true })`. Because both
are `http://localhost:<port>`, they're the same registrable site, so
the `sameSite: 'lax'` cookie is sent on credentialed cross-origin
`fetch` calls between them without any extra configuration — admin
login just works locally today. (This stops being true once frontend
and API are deployed to genuinely different domains — that's exactly
the deferred production follow-up above.)

## Auth

The session is an httpOnly cookie — JavaScript can't read it, so
there's no client-side "am I logged in" flag. Two pieces make this
work:

1. **Central 401 handling.** `adminApi.ts`'s shared fetch wrapper
   checks every response; on `401` it clears the React Query cache
   and redirects to `/admin/login`. Every page's queries and
   mutations go through this wrapper, so a session expiring mid-use
   anywhere in the admin UI bounces to login the same way, without
   each page implementing its own check.
2. **Bootstrap check.** `AdminLayout` runs one query on mount —
   `GET /api/admin/settings` (the cheapest existing real admin
   endpoint, already needed for the Settings page) — purely to learn
   auth state before rendering the nav/outlet. Pending → spinner.
   `401` → the central handler above redirects. Success → renders.

`LoginPage` posts `{ email, password }` to `/api/admin/login`; on
success, navigates to `/admin`. A `401` response renders "Invalid
credentials" inline on the form (the exact message the backend
already returns for both unknown email and wrong password). Logout
posts to `/api/admin/logout`, clears the query cache, and navigates
to `/admin/login`.

## Pages

- **Login** (`/admin/login`) — email/password form, no nav chrome.
- **Dashboard** (`/admin`) — total product count, pending-order count.
  Computed from data already fetched for Products/Orders (reused
  queries, no new backend endpoint).
- **Products** (`/admin/products`) — `Table` (name, category, price,
  active). "+ New product" and each row's "Edit" open the same
  `Dialog` form: name/slug/description/category `Select`/base &
  original price/cover image URL/gallery URLs (repeatable text
  inputs, matching the `images` array added in the last sub-project)/
  active toggle. Each product row expands to a variant sub-table
  (label/price/stock/sku), each row editable inline via the existing
  `PUT /:id/variants/:variantId` endpoint.
- **Categories** (`/admin/categories`) — `Table` + create/edit
  `Dialog` (name/slug/description/image URL/icon). Delete via
  `AlertDialog` confirm.
- **Orders** (`/admin/orders`) — `Table` (order number, customer,
  total, status, date) with a status-filter `Select` above it. Each
  row's status is changeable via a `Select` offering only the 4
  admin-settable values (`PROCESSING`/`SHIPPED`/`DELIVERED`/
  `CANCELLED`) — `PENDING`/`PAID` stay machine-owned, exactly as the
  API already enforces server-side, so the UI doesn't even offer them.
- **Settings** (`/admin/settings`) — one form, `flatShippingFee` /
  `freeShippingThreshold`.

## Error handling

- **Loading:** a spinner/skeleton per query (list tables, the
  bootstrap check).
- **Mutation failure:** a `400` with Zod `details` (create/edit forms)
  renders each field's error inline next to that field. Any other
  mutation failure (`404`/`409`/`500`, or a `400` with no `details`)
  shows the response's `error` message as a toast (`sonner`, already
  a dependency and already used nowhere else). Successful mutations
  also toast a brief confirmation ("Order updated", "Product saved").
- **401 anywhere:** handled centrally, see **Auth**.
- **Network failure:** same inline message pattern the storefront
  already uses ("Couldn't load X, please try again later").

## Testing

Same stack as the rest of the frontend (Vitest + React Testing
Library + MSW), extending `src/test/server.ts`'s handlers with the
admin endpoints. Per page: list renders fetched rows, create/edit/
delete flows (form submit → mutation → list updates), and a shared
test confirming a `401` from any endpoint redirects to
`/admin/login`. `adminApi.ts` gets direct unit tests for its fetch
wrapper (error handling, the 401 special case) matching the existing
`api.test.ts` pattern.

## Out of scope for later

Recorded here so they aren't lost, not because they block this spec:

- Cross-origin cookie fix once deployment topology is chosen.
- Actual deployment (Postgres, hosting, live Razorpay keys, cron for
  the abandoned-order job) — README-documented, unstarted.
- Admin password-change flow (README-documented gap).
