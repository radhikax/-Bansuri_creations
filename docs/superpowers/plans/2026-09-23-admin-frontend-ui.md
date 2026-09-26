# Admin Frontend UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin UI (login, product/variant/category/order/settings management) at `/admin/*` inside the existing storefront app, consuming the already-built backend admin API.

**Architecture:** New routes under `/admin/*`, lazy-loaded from `App.tsx` via `React.lazy`, mounted as a sibling to the storefront's own routes (not nested under its loading/error gate). A typed fetch client (`src/app/admin/lib/adminApi.ts`) with centralized `401` handling wired into a TanStack Query `QueryClient` (`src/app/admin/lib/queryClient.ts`): any query/mutation that gets a `401` clears the cache and redirects to `/admin/login`, except the login call itself, whose `401` is a normal "wrong credentials" error shown inline on the form. Five pages (Dashboard, Products, Categories, Orders, Settings) reuse the existing shadcn/Radix components (`Table`, `Dialog`, `AlertDialog`, `Select`, `Button`, `Input`, `Label`, `Textarea`, `Badge`).

**Tech Stack:** React 18, TypeScript, Vite, `react-router-dom` v7 (already in use), `@tanstack/react-query` (new dependency), `sonner` (already a dependency, newly used here), Vitest + React Testing Library + MSW (already configured).

**Spec:** `docs/superpowers/specs/2026-09-23-admin-frontend-ui-design.md`

## Global Constraints

- No client-side schema validation duplicating the server's Zod schemas — forms submit raw values; a `400` response's `error` (and, where practical, `details`) is what renders. This plan standardizes on one pattern across every form-based mutation (Login, Settings, Categories, Products): the mutation's `onError` sets a local `formError` string state, rendered inline near the submit button — not a toast. Non-form mutations (variant edit, category delete, order status change) use a toast (`sonner`) on both success and failure, since there's no "the form" to show an error near.
- **Query key convention** (every task must match this exactly, so caches share/invalidate correctly): `['admin', 'settings']`, `['admin', 'products']`, `['admin', 'categories']`, `['admin', 'orders', status]` where `status` is the literal string `'ALL'` or one of the 6 `OrderStatus` values. `AdminLayout`'s bootstrap check and `SettingsPage`'s own read **must** use the identical key `['admin', 'settings']` so they share one cache entry (not two redundant fetches of the same resource).
- Product images stay plain pasted URLs (no file upload) — `imageUrl` is one `Input`, the `images` gallery is a `Textarea` of one URL per line, split on newline into `string[]` on submit. This is a deliberately simpler implementation of the spec's "repeatable text inputs" idea — functionally equivalent (enter one or more URLs), far less UI code than a dynamic add/remove list of inputs.
- **Found while planning, not in the approved spec text:** the backend has no `GET /api/admin/categories` — only `POST`/`PUT`/`DELETE`. Task 1 adds it (mirrors the existing `GET /api/admin/products` pattern exactly), since the Categories page cannot list categories without it.
- **Found while planning:** the spec's Products dialog field list didn't include variant fields, but `POST /api/admin/products` requires `variants: array().min(1)` — a product cannot be created with zero variants. Task 6's create dialog (create only, not edit) includes one inline "default variant" section (stock + optional price + SKU, label hardcoded to `'Default'`), matching how nearly every seeded product is structured. Editing variants on existing products (including multi-variant ones) stays exactly as the spec describes: a per-product expandable sub-table, edit-only (the backend has no "add a variant to an existing product" endpoint, and the spec never asked for one).
- **Found while planning:** a `401` from `POST /api/admin/login` on wrong credentials must **not** trigger the central "redirect to `/admin/login`" handling (that would be redirecting the login page to itself while discarding the server's actual "Invalid credentials" message). `adminFetch` takes an internal `unauthorizedIsError` flag; only `adminLogin` sets it.
- `App.tsx` currently gates its *entire* route tree behind the storefront's own `categoriesState`/`productsState` loading and error state. Task 3 restructures this: `/admin/*` becomes a sibling top-level route, unaffected by whether the public storefront's own product/category fetch is loading, has failed, or is unrelated in any way — an admin managing the catalog must not be blocked by (or shown an error about) the public API state.
- All new test files follow the existing project convention exactly: Vitest + React Testing Library + MSW, using `src/test/server.ts`'s shared `server` instance and `server.use(...)` per-test overrides — never a new/separate MSW server instance.

---

## Task 1: Backend — add `GET /api/admin/categories`

**Files:**
- Modify: `server/src/routes/admin/categories.routes.ts`
- Modify: `server/tests/admin/categories.test.ts`
- Modify: `server/tests/admin/validation.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/categories` → `200` with `Category[]` (all categories, ordered by name), `401` if not authenticated — consumed by Task 2's `getAdminCategories()`.

- [ ] **Step 1: Write the failing test**

In `server/tests/admin/categories.test.ts`, add this test inside the existing `describe('admin categories routes', ...)` block, right before the existing `it('creates, updates, and deletes a category', ...)`:

```ts
  it('lists all categories for a logged-in admin, ordered by name', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);

    await prisma.category.createMany({
      data: [
        { name: 'Zebra', slug: 'zebra', description: 'd', imageUrl: 'u', icon: '🦓' },
        { name: 'Apple', slug: 'apple', description: 'd', imageUrl: 'u', icon: '🍎' },
      ],
    });

    const res = await agent.get('/api/admin/categories');
    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(['Apple', 'Zebra']);
  });

  it('rejects an unauthenticated request to list categories', async () => {
    const res = await request(app).get('/api/admin/categories');
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npx vitest run tests/admin/categories.test.ts`
Expected: the two new tests FAIL with `expected 404 to be 200` / `expected 404 to be 401` (no matching route exists yet, so Express falls through to its default 404 handler).

- [ ] **Step 3: Add the route**

In `server/src/routes/admin/categories.routes.ts`, add this directly after `adminCategoriesRouter.use(requireAdminAuth);` and before `const categorySchema = ...`:

```ts
adminCategoriesRouter.get('/', asyncHandler(async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json(categories);
}));

```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd server && npx vitest run tests/admin/categories.test.ts`
Expected: all tests in the file PASS (3 total: the 2 new ones plus the existing create/update/delete test).

- [ ] **Step 5: Add the new route to the existing 401-requires-auth table**

In `server/tests/admin/validation.test.ts`, add one line to the existing `it.each` array (inside `describe('admin route auth and validation', ...)`), right after `['put', '/api/admin/categories/x'],`:

```ts
    ['get', '/api/admin/categories'],
```

(The full array entry list becomes: `products` POST/PUT/PUT-variant, `categories` POST/PUT/DELETE/**GET (new)**, `orders` GET/PUT-status, `settings` GET/PUT — matching every admin route now.)

- [ ] **Step 6: Run the full backend suite**

Run: `cd server && npx vitest run`
Expected: all test files PASS, including the newly-added case in `validation.test.ts`'s `it.each` table (now 11 rows instead of 10).

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/admin/categories.routes.ts server/tests/admin/categories.test.ts server/tests/admin/validation.test.ts
git commit -m "feat(server): add GET /api/admin/categories

Needed by the admin frontend's Categories page, which has no way to
list categories otherwise — the admin router previously only exposed
create/update/delete."
```

---

## Task 2: Frontend — `adminApi.ts` client + test infrastructure

**Files:**
- Modify: `package.json` (add `@tanstack/react-query`)
- Create: `src/app/admin/lib/adminApi.ts`
- Create: `src/app/admin/lib/adminApi.test.ts`
- Modify: `src/test/fixtures.ts` (add `makeStoreSettings`, `makeAdminOrder`)
- Modify: `src/test/server.ts` (add default admin MSW handlers)

**Interfaces:**
- Produces (all from `adminApi.ts`, consumed by every later task):
  - Types: `ApiCategory`, `ApiProduct`, `ApiProductVariant` (re-exported from `../../lib/api`), `AdminOrder`, `AdminOrderItem`, `StoreSettings`, `OrderStatus`, `AdminSettableOrderStatus`, `AdminVariantInput`, `CreateProductInput`, `UpdateProductInput`, `CategoryInput`.
  - Errors: `class AdminUnauthorizedError extends Error {}`, `class AdminApiError extends Error { details?: unknown }`.
  - Functions: `adminLogin(email: string, password: string): Promise<{ success: true }>`, `adminLogout(): Promise<{ success: true }>`, `getStoreSettings(): Promise<StoreSettings>`, `updateStoreSettings(data: { flatShippingFee: number; freeShippingThreshold: number }): Promise<StoreSettings>`, `getAdminProducts(): Promise<ApiProduct[]>`, `createAdminProduct(data: CreateProductInput): Promise<ApiProduct>`, `updateAdminProduct(id: string, data: UpdateProductInput): Promise<ApiProduct>`, `updateAdminVariant(productId: string, variantId: string, data: AdminVariantInput): Promise<ApiProductVariant>`, `getAdminCategories(): Promise<ApiCategory[]>`, `createAdminCategory(data: CategoryInput): Promise<ApiCategory>`, `updateAdminCategory(id: string, data: Partial<CategoryInput>): Promise<ApiCategory>`, `deleteAdminCategory(id: string): Promise<void>`, `getAdminOrders(status?: OrderStatus): Promise<AdminOrder[]>`, `updateAdminOrderStatus(id: string, status: AdminSettableOrderStatus): Promise<AdminOrder>`.

- [ ] **Step 1: Install the new dependency**

Run: `npm install @tanstack/react-query`

- [ ] **Step 2: Write the failing tests**

Create `src/app/admin/lib/adminApi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  AdminApiError,
  AdminUnauthorizedError,
  adminLogin,
  adminLogout,
  createAdminCategory,
  createAdminProduct,
  deleteAdminCategory,
  getAdminCategories,
  getAdminOrders,
  getAdminProducts,
  getStoreSettings,
  updateAdminCategory,
  updateAdminOrderStatus,
  updateAdminProduct,
  updateAdminVariant,
  updateStoreSettings,
} from './adminApi';
import { server, defaultAdminOrders, defaultCategories, defaultProducts, defaultStoreSettings } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('adminApi', () => {
  it('adminLogin posts credentials with cookies included', async () => {
    let receivedBody: unknown;
    let receivedCredentials: RequestCredentials | undefined;
    server.use(
      http.post(`${API_URL}/api/admin/login`, async ({ request }) => {
        receivedBody = await request.json();
        receivedCredentials = request.credentials;
        return HttpResponse.json({ success: true });
      }),
    );
    await adminLogin('admin@example.com', 'pw');
    expect(receivedBody).toEqual({ email: 'admin@example.com', password: 'pw' });
    expect(receivedCredentials).toBe('include');
  });

  it('adminLogin throws AdminApiError (not AdminUnauthorizedError) with the server message on a 401', async () => {
    server.use(
      http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })),
    );
    await expect(adminLogin('admin@example.com', 'wrong')).rejects.toMatchObject({
      message: 'Invalid credentials',
    });
    server.use(http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })));
    await expect(adminLogin('admin@example.com', 'wrong')).rejects.not.toBeInstanceOf(AdminUnauthorizedError);
  });

  it('adminLogout succeeds', async () => {
    await expect(adminLogout()).resolves.toEqual({ success: true });
  });

  it('getStoreSettings returns the settings', async () => {
    await expect(getStoreSettings()).resolves.toEqual(defaultStoreSettings);
  });

  it('updateStoreSettings sends a PUT with the new values', async () => {
    const updated = await updateStoreSettings({ flatShippingFee: 75, freeShippingThreshold: 500 });
    expect(updated.flatShippingFee).toBe(75);
    expect(updated.freeShippingThreshold).toBe(500);
  });

  it('getAdminProducts returns all products', async () => {
    await expect(getAdminProducts()).resolves.toEqual(defaultProducts);
  });

  it('createAdminProduct posts the payload', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/products`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(defaultProducts[0], { status: 201 });
      }),
    );
    await createAdminProduct({
      name: 'New', slug: 'new', description: 'd', categoryId: 'cat-1',
      basePrice: 100, imageUrl: 'u', variants: [{ label: 'Default', stock: 1, sku: 'X' }],
    });
    expect(receivedBody).toMatchObject({ name: 'New', slug: 'new' });
  });

  it('updateAdminProduct sends a PUT to /api/admin/products/:id', async () => {
    let receivedId = '';
    server.use(
      http.put(`${API_URL}/api/admin/products/:id`, async ({ request, params }) => {
        receivedId = String(params.id);
        return HttpResponse.json({ ...defaultProducts[0], ...(await request.json() as object) });
      }),
    );
    await updateAdminProduct('prod-1', { basePrice: 999 });
    expect(receivedId).toBe('prod-1');
  });

  it('updateAdminVariant sends a PUT to the nested variant route', async () => {
    let receivedPath = '';
    server.use(
      http.put(`${API_URL}/api/admin/products/:id/variants/:variantId`, async ({ request, params }) => {
        receivedPath = `${params.id}/${params.variantId}`;
        return HttpResponse.json({ id: params.variantId, ...(await request.json() as object) });
      }),
    );
    await updateAdminVariant('prod-1', 'var-1', { label: 'Default', stock: 5, sku: 'X' });
    expect(receivedPath).toBe('prod-1/var-1');
  });

  it('getAdminCategories returns all categories', async () => {
    await expect(getAdminCategories()).resolves.toEqual(defaultCategories);
  });

  it('createAdminCategory posts the payload', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/categories`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(defaultCategories[0], { status: 201 });
      }),
    );
    await createAdminCategory({ name: 'N', slug: 'n', description: 'd', imageUrl: 'u', icon: 'i' });
    expect(receivedBody).toEqual({ name: 'N', slug: 'n', description: 'd', imageUrl: 'u', icon: 'i' });
  });

  it('updateAdminCategory sends a partial PUT', async () => {
    const updated = await updateAdminCategory('cat-1', { icon: '🎉' });
    expect(updated.icon).toBe('🎉');
  });

  it('deleteAdminCategory resolves with no content on a 204', async () => {
    await expect(deleteAdminCategory('cat-1')).resolves.toBeUndefined();
  });

  it('getAdminOrders without a status fetches every order', async () => {
    await expect(getAdminOrders()).resolves.toEqual(defaultAdminOrders);
  });

  it('getAdminOrders encodes the status filter in the query string', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${API_URL}/api/admin/orders`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await getAdminOrders('SHIPPED');
    expect(requestedUrl).toBe(`${API_URL}/api/admin/orders?status=SHIPPED`);
  });

  it('updateAdminOrderStatus sends the new status', async () => {
    const updated = await updateAdminOrderStatus(defaultAdminOrders[0].id, 'SHIPPED');
    expect(updated.status).toBe('SHIPPED');
  });

  it('throws AdminUnauthorizedError on a 401 from a non-login endpoint', async () => {
    server.use(http.get(`${API_URL}/api/admin/products`, () => new HttpResponse(null, { status: 401 })));
    await expect(getAdminProducts()).rejects.toBeInstanceOf(AdminUnauthorizedError);
  });

  it('throws AdminApiError carrying the response body on a non-401 failure', async () => {
    server.use(
      http.post(`${API_URL}/api/admin/categories`, () =>
        HttpResponse.json({ error: 'Invalid category payload', details: { fieldErrors: { name: ['Required'] } } }, { status: 400 }),
      ),
    );
    let caught: unknown;
    try {
      await createAdminCategory({ name: '', slug: 'n', description: 'd', imageUrl: 'u', icon: 'i' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AdminApiError);
    expect((caught as AdminApiError).message).toBe('Invalid category payload');
    expect((caught as AdminApiError).details).toEqual({ fieldErrors: { name: ['Required'] } });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/app/admin/lib/adminApi.test.ts`
Expected: FAIL — `Cannot find module './adminApi'` (the file doesn't exist yet). This also means `src/test/server.ts`'s `defaultAdminOrders`/`defaultStoreSettings` exports don't exist yet either — that's expected; both get added in the next steps.

- [ ] **Step 4: Add `makeStoreSettings` and `makeAdminOrder` fixtures**

In `src/test/fixtures.ts`, add these two functions at the end of the file (after `sizeVariants`):

```ts

export function makeStoreSettings(overrides: Partial<{ id: number; flatShippingFee: number; freeShippingThreshold: number }> = {}) {
  return { id: 1, flatShippingFee: 50, freeShippingThreshold: 999, ...overrides };
}

export interface AdminOrderItemFixture {
  id: string;
  orderId: string;
  productVariantId: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string;
  unitPrice: number;
  quantity: number;
}

export interface AdminOrderFixture {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  items: AdminOrderItemFixture[];
  createdAt: string;
  updatedAt: string;
}

export function makeAdminOrder(overrides: Partial<AdminOrderFixture> = {}): AdminOrderFixture {
  return {
    id: 'order-1',
    orderNumber: 'ORD-0001',
    customerName: 'Asha Rao',
    customerPhone: '9876543210',
    customerEmail: 'asha@example.com',
    addressStreet: '12 MG Road',
    addressCity: 'Pune',
    addressState: 'MH',
    addressPincode: '411001',
    subtotal: 500,
    shippingFee: 50,
    total: 550,
    status: 'PAID',
    razorpayOrderId: 'order_razorpay_1',
    razorpayPaymentId: 'pay_1',
    paidAt: '2026-01-02T00:00:00.000Z',
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productVariantId: 'var-1',
        productNameSnapshot: 'Brass Diya',
        variantLabelSnapshot: 'Default',
        unitPrice: 500,
        quantity: 1,
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}
```

- [ ] **Step 5: Add default admin MSW handlers**

In `src/test/server.ts`, change the import line and add the new exports/handlers. Replace the top of the file:

```ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { API_URL, makeAdminOrder, makeApiCategory, makeApiProduct, makeApiVariant, makeStoreSettings } from './fixtures';
```

Then, after the existing `export const handlers = [...]` array (leave it exactly as-is) and before `export const server = setupServer(...handlers);`, add:

```ts

export const defaultStoreSettings = makeStoreSettings();
export const defaultAdminOrders = [makeAdminOrder()];

export const adminHandlers = [
  http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ success: true })),
  http.post(`${API_URL}/api/admin/logout`, () => HttpResponse.json({ success: true })),
  http.get(`${API_URL}/api/admin/settings`, () => HttpResponse.json(defaultStoreSettings)),
  http.put(`${API_URL}/api/admin/settings`, async ({ request }) =>
    HttpResponse.json({ ...defaultStoreSettings, ...(await request.json() as object) }),
  ),
  http.get(`${API_URL}/api/admin/products`, () => HttpResponse.json(defaultProducts)),
  http.post(`${API_URL}/api/admin/products`, async ({ request }) =>
    HttpResponse.json({ ...defaultProducts[0], ...(await request.json() as object) }, { status: 201 }),
  ),
  http.put(`${API_URL}/api/admin/products/:id`, async ({ request, params }) => {
    const found = defaultProducts.find((p) => p.id === params.id) ?? defaultProducts[0];
    return HttpResponse.json({ ...found, ...(await request.json() as object) });
  }),
  http.put(`${API_URL}/api/admin/products/:id/variants/:variantId`, async ({ request, params }) =>
    HttpResponse.json({
      id: params.variantId,
      productId: params.id,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...(await request.json() as object),
    }),
  ),
  http.get(`${API_URL}/api/admin/categories`, () => HttpResponse.json(defaultCategories)),
  http.post(`${API_URL}/api/admin/categories`, async ({ request }) =>
    HttpResponse.json({ ...defaultCategories[0], ...(await request.json() as object) }, { status: 201 }),
  ),
  http.put(`${API_URL}/api/admin/categories/:id`, async ({ request, params }) => {
    const found = defaultCategories.find((c) => c.id === params.id) ?? defaultCategories[0];
    return HttpResponse.json({ ...found, ...(await request.json() as object) });
  }),
  http.delete(`${API_URL}/api/admin/categories/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_URL}/api/admin/orders`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    const list = status ? defaultAdminOrders.filter((o) => o.status === status) : defaultAdminOrders;
    return HttpResponse.json(list);
  }),
  http.put(`${API_URL}/api/admin/orders/:id/status`, async ({ request, params }) => {
    const found = defaultAdminOrders.find((o) => o.id === params.id) ?? defaultAdminOrders[0];
    const body = (await request.json()) as { status: string };
    return HttpResponse.json({ ...found, status: body.status });
  }),
];
```

Finally, change the last line of the file from `export const server = setupServer(...handlers);` to:

```ts
export const server = setupServer(...handlers, ...adminHandlers);
```

- [ ] **Step 6: Create `adminApi.ts`**

Create `src/app/admin/lib/adminApi.ts`:

```ts
import type { ApiCategory, ApiProduct, ApiProductVariant } from '../../lib/api';

export type { ApiCategory, ApiProduct, ApiProductVariant };

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type AdminSettableOrderStatus = 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface AdminOrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string;
  unitPrice: number;
  quantity: number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  items: AdminOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  id: number;
  flatShippingFee: number;
  freeShippingThreshold: number;
}

export interface AdminVariantInput {
  label: string;
  price?: number;
  stock: number;
  sku: string;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  basePrice: number;
  originalPrice?: number;
  imageUrl: string;
  images?: string[];
  variants: AdminVariantInput[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: string;
  basePrice?: number;
  originalPrice?: number | null;
  imageUrl?: string;
  images?: string[];
  isActive?: boolean;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class AdminUnauthorizedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'AdminUnauthorizedError';
  }
}

export class AdminApiError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'AdminApiError';
    this.details = details;
  }
}

async function adminFetch<T>(
  path: string,
  init?: RequestInit,
  opts: { unauthorizedIsError?: boolean } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (res.status === 401 && !opts.unauthorizedIsError) {
    throw new AdminUnauthorizedError();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; details?: unknown };
    throw new AdminApiError(body.error ?? `Request to ${path} failed with status ${res.status}`, body.details);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// Auth. adminLogin's 401 is a normal "wrong credentials" failure, not a session
// expiry — it must not trigger the central redirect-to-login handling.
export function adminLogin(email: string, password: string): Promise<{ success: true }> {
  return adminFetch(
    '/api/admin/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    { unauthorizedIsError: true },
  );
}

export function adminLogout(): Promise<{ success: true }> {
  return adminFetch('/api/admin/logout', { method: 'POST' });
}

// Settings
export function getStoreSettings(): Promise<StoreSettings> {
  return adminFetch('/api/admin/settings');
}

export function updateStoreSettings(data: { flatShippingFee: number; freeShippingThreshold: number }): Promise<StoreSettings> {
  return adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
}

// Products
export function getAdminProducts(): Promise<ApiProduct[]> {
  return adminFetch('/api/admin/products');
}

export function createAdminProduct(data: CreateProductInput): Promise<ApiProduct> {
  return adminFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdminProduct(id: string, data: UpdateProductInput): Promise<ApiProduct> {
  return adminFetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function updateAdminVariant(productId: string, variantId: string, data: AdminVariantInput): Promise<ApiProductVariant> {
  return adminFetch(
    `/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
}

// Categories
export function getAdminCategories(): Promise<ApiCategory[]> {
  return adminFetch('/api/admin/categories');
}

export function createAdminCategory(data: CategoryInput): Promise<ApiCategory> {
  return adminFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdminCategory(id: string, data: Partial<CategoryInput>): Promise<ApiCategory> {
  return adminFetch(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteAdminCategory(id: string): Promise<void> {
  return adminFetch(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Orders
export function getAdminOrders(status?: OrderStatus): Promise<AdminOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminFetch(`/api/admin/orders${query}`);
}

export function updateAdminOrderStatus(id: string, status: AdminSettableOrderStatus): Promise<AdminOrder> {
  return adminFetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/app/admin/lib/adminApi.test.ts`
Expected: all 18 tests PASS.

- [ ] **Step 8: Run the full frontend suite to confirm nothing else broke**

Run: `npx vitest run`
Expected: all test files pass (the previous 92 plus this task's new ones).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/app/admin/lib/adminApi.ts src/app/admin/lib/adminApi.test.ts src/test/fixtures.ts src/test/server.ts
git commit -m "feat: add the admin API client (adminApi.ts) and its test fixtures

Typed fetch functions for every admin endpoint, with a central 401
handler (AdminUnauthorizedError) that later tasks wire into React
Query's global error handling — except adminLogin, whose 401 is a
normal wrong-credentials failure shown on the login form, not a
session-expiry redirect."
```

---

## Task 3: Frontend — auth skeleton (QueryClient, layout, login, dashboard) + route mounting

**Files:**
- Create: `src/app/admin/lib/queryClient.ts`
- Create: `src/app/admin/AdminLayout.tsx`
- Create: `src/app/admin/pages/LoginPage.tsx`
- Create: `src/app/admin/pages/DashboardPage.tsx`
- Create: `src/app/admin/AdminApp.tsx`
- Create: `src/app/admin/AdminApp.test.tsx`
- Create: `src/test/renderAdmin.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: everything from Task 2's `adminApi.ts`.
- Produces: `createAdminQueryClient(redirect?: () => void): QueryClient` (from `lib/queryClient.ts`) — consumed by `AdminApp.tsx` and by `renderAdmin.tsx`'s `renderAdminPage` helper, which Tasks 4–7 reuse. `export default function AdminApp({ queryClient }: { queryClient?: QueryClient } = {})` (from `AdminApp.tsx`) — Tasks 4-7 modify this file to add one `<Route>` each.

- [ ] **Step 1: Create the query client with centralized 401 handling**

Create `src/app/admin/lib/queryClient.ts`:

```ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { AdminUnauthorizedError } from './adminApi';

export function redirectToLogin(): void {
  window.location.href = '/admin/login';
}

/**
 * `redirect` is injectable so tests can assert the redirect happened without
 * fighting jsdom's lack of real navigation support.
 */
export function createAdminQueryClient(redirect: () => void = redirectToLogin): QueryClient {
  const handleError = (error: unknown) => {
    if (error instanceof AdminUnauthorizedError) {
      queryClient.clear();
      redirect();
    }
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
  });

  return queryClient;
}
```

- [ ] **Step 2: Create the shared admin test-render helper**

Create `src/test/renderAdmin.tsx`:

```tsx
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAdminQueryClient } from '../app/admin/lib/queryClient';

export function renderAdminPage(ui: ReactNode, initialEntries: string[] = ['/admin']) {
  const queryClient = createAdminQueryClient(() => {});
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}
```

- [ ] **Step 3: Create `AdminLayout`**

Create `src/app/admin/AdminLayout.tsx`:

```tsx
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminLogout, getStoreSettings } from './lib/adminApi';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
];

export function AdminLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Same query key as SettingsPage's own read (Task 4), so they share one
  // cache entry instead of two redundant fetches of the same resource.
  const bootstrap = useQuery({ queryKey: ['admin', 'settings'], queryFn: getStoreSettings });

  const handleLogout = async () => {
    await adminLogout();
    queryClient.clear();
    navigate('/admin/login');
  };

  if (bootstrap.isPending) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (bootstrap.isError) {
    // A 401 here already triggered the central redirect via the QueryClient's
    // onError handler (lib/queryClient.ts) — render nothing while it happens.
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center gap-6">
            <span className="text-lg">Bansuri Admin</span>
            <nav className="flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <Link key={item.to} to={item.to} className="text-sm hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-auto text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create `LoginPage`**

Create `src/app/admin/pages/LoginPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AdminApiError, adminLogin } from '../lib/adminApi';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => adminLogin(email, password),
    onSuccess: () => navigate('/admin'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const errorMessage = mutation.error instanceof AdminApiError ? mutation.error.message : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl text-center mb-2">Admin login</h1>
        {errorMessage && <p className="text-sm text-destructive text-center">{errorMessage}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create `DashboardPage`**

Create `src/app/admin/pages/DashboardPage.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { getAdminOrders, getAdminProducts } from '../lib/adminApi';

export function DashboardPage() {
  const products = useQuery({ queryKey: ['admin', 'products'], queryFn: getAdminProducts });
  const pendingOrders = useQuery({ queryKey: ['admin', 'orders', 'PENDING'], queryFn: () => getAdminOrders('PENDING') });

  return (
    <div>
      <h1 className="text-2xl mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
        <div className="rounded-lg border p-6">
          <div className="text-sm text-muted-foreground mb-1">Total products</div>
          <div className="text-3xl">{products.data?.length ?? '—'}</div>
        </div>
        <div className="rounded-lg border p-6">
          <div className="text-sm text-muted-foreground mb-1">Pending orders</div>
          <div className="text-3xl">{pendingOrders.data?.length ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `AdminApp`**

Create `src/app/admin/AdminApp.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createAdminQueryClient } from './lib/queryClient';
import { AdminLayout } from './AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

const defaultQueryClient = createAdminQueryClient();

interface AdminAppProps {
  queryClient?: QueryClient;
}

export default function AdminApp({ queryClient = defaultQueryClient }: AdminAppProps = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Write the failing test for the auth skeleton**

Create `src/app/admin/AdminApp.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import AdminApp from './AdminApp';
import { createAdminQueryClient } from './lib/queryClient';
import { server } from '../../test/server';
import { API_URL } from '../../test/fixtures';

function renderAdminApp(initialEntry: string, redirectToLogin = vi.fn()) {
  const queryClient = createAdminQueryClient(redirectToLogin);
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp queryClient={queryClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { redirectToLogin, queryClient };
}

describe('AdminApp', () => {
  it('renders the dashboard when the bootstrap check succeeds', async () => {
    renderAdminApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Bansuri Admin')).toBeInTheDocument();
  });

  it('redirects to login when the bootstrap check gets a 401', async () => {
    server.use(http.get(`${API_URL}/api/admin/settings`, () => new HttpResponse(null, { status: 401 })));
    const { redirectToLogin } = renderAdminApp('/admin');
    await waitFor(() => expect(redirectToLogin).toHaveBeenCalled());
  });

  it('redirects to login when a query 401s after the bootstrap check already succeeded', async () => {
    server.use(http.get(`${API_URL}/api/admin/products`, () => new HttpResponse(null, { status: 401 })));
    const { redirectToLogin } = renderAdminApp('/admin');
    await screen.findByRole('heading', { name: 'Dashboard' });
    await waitFor(() => expect(redirectToLogin).toHaveBeenCalled());
  });

  it('logs in and shows the dashboard', async () => {
    const user = userEvent.setup();
    renderAdminApp('/admin/login');
    expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('shows an inline error for wrong credentials without redirecting to login', async () => {
    server.use(http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })));
    const user = userEvent.setup();
    const { redirectToLogin } = renderAdminApp('/admin/login');

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('logs out, clears the cache, and returns to login', async () => {
    const user = userEvent.setup();
    renderAdminApp('/admin');
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Admin login' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run src/app/admin/AdminApp.test.tsx`
Expected: FAILS at this point only if any file from Steps 1–6 has a mistake — since all the files it depends on were already created in this same task, run it now purely as the checkpoint before wiring `App.tsx` in Step 9. If anything fails here, fix it before proceeding (don't move to Step 9 with a broken skeleton).

- [ ] **Step 9: Mount `/admin/*` in `App.tsx`, independent of the storefront's own loading/error state**

Replace `src/app/App.tsx` in full:

```tsx
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Header } from './components/Header';
import { Cart, type CartItem } from './components/Cart';
import { Footer } from './components/Footer';
import { ProductCardSkeleton } from './components/ProductCardSkeleton';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { Product } from './types';
import { getCategories, getProducts } from './lib/api';
import { useApiData } from './lib/useApiData';
import { adaptCategory, adaptProduct } from './lib/adapters';

const AdminApp = lazy(() => import('./admin/AdminApp'));

function AnimatedRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <Routes location={location}>{children}</Routes>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
        exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.16, ease: 'easeIn' } }}
      >
        <Routes location={location}>{children}</Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function Storefront() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const categoriesState = useApiData(getCategories);
  const productsState = useApiData(() => getProducts());

  const categories = categoriesState.data?.map(adaptCategory) ?? [];
  const products = productsState.data?.map(adaptProduct) ?? [];

  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const loading = categoriesState.loading || productsState.loading;
  const loadError = categoriesState.error ?? productsState.error;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        cartItemsCount={totalItems}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="flex-1">
        {loading ? (
          <div className="container mx-auto px-4 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : loadError ? (
          <div className="container mx-auto px-4 py-16 text-center">
            <p className="text-lg">Couldn't load products, please try again later.</p>
          </div>
        ) : (
          <AnimatedRoutes>
            <Route
              path="/"
              element={
                <HomePage
                  products={products}
                  categories={categories}
                  onAddToCart={handleAddToCart}
                />
              }
            />
            <Route
              path="/category/:category"
              element={
                <CategoryPage
                  products={products}
                  categories={categories}
                  onAddToCart={handleAddToCart}
                />
              }
            />
            <Route
              path="/product/:slug"
              element={
                <ProductDetailPage
                  products={products}
                  onAddToCart={handleAddToCart}
                />
              }
            />
          </AnimatedRoutes>
        )}
      </main>

      <Footer />

      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="/*" element={<Storefront />} />
      </Routes>
    </Router>
  );
}
```

The storefront's own component tree (`Header`, the loading/error gate, `AnimatedRoutes`, `Footer`, `Cart`) moves into a new `Storefront` component — its internals and behavior are **completely unchanged**, it's a pure extraction. `/admin/*` becomes a sibling top-level route with its own `Suspense` boundary, entirely independent of `categoriesState`/`productsState`.

- [ ] **Step 10: Run the test from Step 7 to verify it passes**

Run: `npx vitest run src/app/admin/AdminApp.test.tsx`
Expected: all 6 tests PASS.

- [ ] **Step 11: Add a regression test proving `/admin` doesn't get blocked by the storefront's own API state**

In `src/app/App.test.tsx`, add this test inside `describe('App (with mocked API)', ...)`, anywhere after the existing tests:

```tsx
  it('renders the admin section independently of the storefront\'s own data state', async () => {
    server.use(http.get(`${API_URL}/api/products`, () => new HttpResponse(null, { status: 500 })));
    goTo('/admin');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load products, please try again later.")).not.toBeInTheDocument();
  });
```

- [ ] **Step 12: Run the full frontend suite**

Run: `npx vitest run`
Expected: all test files PASS, including every pre-existing `App.test.tsx` test (the restructuring must not change any storefront-facing behavior) and the new test from Step 11.

- [ ] **Step 13: Commit**

```bash
git add src/app/admin/lib/queryClient.ts src/app/admin/AdminLayout.tsx src/app/admin/pages/LoginPage.tsx src/app/admin/pages/DashboardPage.tsx src/app/admin/AdminApp.tsx src/app/admin/AdminApp.test.tsx src/test/renderAdmin.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: add admin auth skeleton (login, layout, dashboard) at /admin

QueryClient with centralized 401 handling (any query/mutation 401
clears the cache and redirects to /admin/login, except login's own
401 which is a normal wrong-credentials error). /admin/* mounts as a
sibling top-level route in App.tsx, lazy-loaded, independent of the
storefront's own product/category loading and error state."
```

---

## Task 4: Frontend — Settings page

**Files:**
- Create: `src/app/admin/pages/SettingsPage.tsx`
- Create: `src/app/admin/pages/SettingsPage.test.tsx`
- Modify: `src/app/admin/AdminApp.tsx`
- Modify: `src/app/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `getStoreSettings`, `updateStoreSettings`, `AdminApiError` from Task 2's `adminApi.ts`; `renderAdminPage` from Task 3's `src/test/renderAdmin.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/admin/pages/SettingsPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SettingsPage } from './SettingsPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultStoreSettings } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('SettingsPage', () => {
  it('loads and prefills the current settings', async () => {
    renderAdminPage(<SettingsPage />);
    expect(await screen.findByLabelText('Flat shipping fee (₹)')).toHaveValue(defaultStoreSettings.flatShippingFee);
    expect(screen.getByLabelText('Free shipping threshold (₹)')).toHaveValue(defaultStoreSettings.freeShippingThreshold);
  });

  it('saves updated settings', async () => {
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/settings`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ id: 1, ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<SettingsPage />);
    await screen.findByLabelText('Flat shipping fee (₹)');

    await user.clear(screen.getByLabelText('Flat shipping fee (₹)'));
    await user.type(screen.getByLabelText('Flat shipping fee (₹)'), '75');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({ flatShippingFee: 75, freeShippingThreshold: defaultStoreSettings.freeShippingThreshold }),
    );
  });

  it('shows the server error inline on save failure', async () => {
    server.use(http.put(`${API_URL}/api/admin/settings`, () => HttpResponse.json({ error: 'Invalid settings payload' }, { status: 400 })));
    const user = userEvent.setup();
    renderAdminPage(<SettingsPage />);
    await screen.findByLabelText('Flat shipping fee (₹)');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Invalid settings payload')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/admin/pages/SettingsPage.test.tsx`
Expected: FAIL — `Cannot find module './SettingsPage'`.

- [ ] **Step 3: Create `SettingsPage`**

Create `src/app/admin/pages/SettingsPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AdminApiError, getStoreSettings, updateStoreSettings } from '../lib/adminApi';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['admin', 'settings'], queryFn: getStoreSettings });

  const [flatShippingFee, setFlatShippingFee] = useState('');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setFlatShippingFee(String(settingsQuery.data.flatShippingFee));
      setFreeShippingThreshold(String(settingsQuery.data.freeShippingThreshold));
    }
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateStoreSettings({
        flatShippingFee: Number(flatShippingFee),
        freeShippingThreshold: Number(freeShippingThreshold),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'settings'], updated);
      setFormError(null);
      toast.success('Settings saved');
    },
    onError: (error) => {
      setFormError(error instanceof AdminApiError ? error.message : 'Could not save settings');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (settingsQuery.isPending) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl mb-6">Shipping settings</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="flatShippingFee">Flat shipping fee (₹)</Label>
          <Input
            id="flatShippingFee"
            type="number"
            min="0"
            value={flatShippingFee}
            onChange={(e) => setFlatShippingFee(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="freeShippingThreshold">Free shipping threshold (₹)</Label>
          <Input
            id="freeShippingThreshold"
            type="number"
            min="0"
            value={freeShippingThreshold}
            onChange={(e) => setFreeShippingThreshold(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/admin/pages/SettingsPage.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 5: Wire the route and nav item**

In `src/app/admin/AdminLayout.tsx`, change `NAV_ITEMS` to:

```ts
const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/settings', label: 'Settings' },
];
```

In `src/app/admin/AdminApp.tsx`, add the import and route. Change:

```tsx
import { DashboardPage } from './pages/DashboardPage';
```

to:

```tsx
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
```

and change:

```tsx
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>
```

to:

```tsx
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
```

- [ ] **Step 6: Run the full frontend suite**

Run: `npx vitest run`
Expected: all tests pass, including `AdminApp.test.tsx` (unaffected by the new route) and the new `SettingsPage.test.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/pages/SettingsPage.tsx src/app/admin/pages/SettingsPage.test.tsx src/app/admin/AdminApp.tsx src/app/admin/AdminLayout.tsx
git commit -m "feat: add admin Settings page"
```

---

## Task 5: Frontend — Categories page

**Files:**
- Create: `src/app/admin/pages/CategoriesPage.tsx`
- Create: `src/app/admin/pages/CategoriesPage.test.tsx`
- Modify: `src/app/admin/AdminApp.tsx`
- Modify: `src/app/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `getAdminCategories`, `createAdminCategory`, `updateAdminCategory`, `deleteAdminCategory`, `AdminApiError`, `type ApiCategory`, `type CategoryInput` from Task 2's `adminApi.ts`; `renderAdminPage` from `src/test/renderAdmin.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/admin/pages/CategoriesPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { CategoriesPage } from './CategoriesPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultCategories } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('CategoriesPage', () => {
  it('lists every category', async () => {
    renderAdminPage(<CategoriesPage />);
    expect(await screen.findByText(defaultCategories[0].name)).toBeInTheDocument();
    expect(screen.getByText(defaultCategories[1].name)).toBeInTheDocument();
  });

  it('creates a category', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/categories`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultCategories[0], ...(receivedBody as object) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    await user.click(screen.getByRole('button', { name: '+ New category' }));
    await user.type(screen.getByLabelText('Name'), 'Holi Colors');
    await user.type(screen.getByLabelText('Slug'), 'holi-colors');
    await user.type(screen.getByLabelText('Description'), 'Colors and pichkaris');
    await user.type(screen.getByLabelText('Image URL'), 'https://img.test/holi.jpg');
    await user.type(screen.getByLabelText('Icon (emoji)'), '🎨');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        name: 'Holi Colors', slug: 'holi-colors', description: 'Colors and pichkaris',
        imageUrl: 'https://img.test/holi.jpg', icon: '🎨',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits a category, prefilling the current values', async () => {
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/categories/:id`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultCategories[0], ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    const row = screen.getByText(defaultCategories[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Name')).toHaveValue(defaultCategories[0].name);
    await user.clear(screen.getByLabelText('Icon (emoji)'));
    await user.type(screen.getByLabelText('Icon (emoji)'), '🌟');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(receivedBody).toMatchObject({ icon: '🌟' }));
  });

  it('shows the server validation error inline', async () => {
    server.use(http.post(`${API_URL}/api/admin/categories`, () => HttpResponse.json({ error: 'Invalid category payload' }, { status: 400 })));
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    await user.click(screen.getByRole('button', { name: '+ New category' }));
    await user.type(screen.getByLabelText('Name'), 'X');
    await user.type(screen.getByLabelText('Slug'), 'x');
    await user.type(screen.getByLabelText('Description'), 'd');
    await user.type(screen.getByLabelText('Image URL'), 'u');
    await user.type(screen.getByLabelText('Icon (emoji)'), 'i');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Invalid category payload')).toBeInTheDocument();
  });

  it('deletes a category after confirming', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${API_URL}/api/admin/categories/:id`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    const row = screen.getByText(defaultCategories[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete', description: undefined }));

    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/admin/pages/CategoriesPage.test.tsx`
Expected: FAIL — `Cannot find module './CategoriesPage'`.

- [ ] **Step 3: Create `CategoriesPage`**

Create `src/app/admin/pages/CategoriesPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  AdminApiError,
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
  type ApiCategory,
  type CategoryInput,
} from '../lib/adminApi';

const emptyForm: CategoryInput = { name: '', slug: '', description: '', imageUrl: '', icon: '' };

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: ['admin', 'categories'], queryFn: getAdminCategories });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });

  const createMutation = useMutation({
    mutationFn: () => createAdminCategory(form),
    onSuccess: () => {
      invalidate();
      toast.success('Category created');
      setDialogOpen(false);
    },
    onError: (error) => setFormError(error instanceof AdminApiError ? error.message : 'Could not save category'),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateAdminCategory(editingId!, form),
    onSuccess: () => {
      invalidate();
      toast.success('Category updated');
      setDialogOpen(false);
    },
    onError: (error) => setFormError(error instanceof AdminApiError ? error.message : 'Could not save category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminCategory(id),
    onSuccess: () => {
      invalidate();
      toast.success('Category deleted');
    },
    onError: (error) => toast.error(error instanceof AdminApiError ? error.message : 'Could not delete category'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (category: ApiCategory) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      icon: category.icon,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Categories</h1>
        <Button onClick={openCreate}>+ New category</Button>
      </div>

      {categoriesQuery.isPending ? (
        <p className="text-muted-foreground">Loading categories…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Icon</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoriesQuery.data?.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell>{category.slug}</TableCell>
                <TableCell>{category.icon}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(category)}>
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(category.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit category' : 'New category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input id="cat-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-description">Description</Label>
              <Input id="cat-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-imageUrl">Image URL</Label>
              <Input id="cat-imageUrl" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-icon">Icon (emoji)</Label>
              <Input id="cat-icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/admin/pages/CategoriesPage.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Wire the route and nav item**

In `src/app/admin/AdminLayout.tsx`, add one entry to `NAV_ITEMS`:

```ts
const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/settings', label: 'Settings' },
];
```

In `src/app/admin/AdminApp.tsx`, add the import:

```tsx
import { CategoriesPage } from './pages/CategoriesPage';
```

and the route (inside the `<Route element={<AdminLayout />}>` block, in any order relative to the existing routes):

```tsx
          <Route path="categories" element={<CategoriesPage />} />
```

- [ ] **Step 6: Run the full frontend suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/pages/CategoriesPage.tsx src/app/admin/pages/CategoriesPage.test.tsx src/app/admin/AdminApp.tsx src/app/admin/AdminLayout.tsx
git commit -m "feat: add admin Categories page (list, create, edit, delete)"
```

---

## Task 6: Frontend — Products page (list, create, edit, per-product variant editing)

**Files:**
- Create: `src/app/admin/pages/ProductsPage.tsx`
- Create: `src/app/admin/pages/ProductsPage.test.tsx`
- Modify: `src/app/admin/AdminApp.tsx`
- Modify: `src/app/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `getAdminProducts`, `createAdminProduct`, `updateAdminProduct`, `updateAdminVariant`, `getAdminCategories`, `AdminApiError`, `type ApiProduct`, `type ApiProductVariant`, `type CreateProductInput`, `type UpdateProductInput` from Task 2's `adminApi.ts`; `renderAdminPage` from `src/test/renderAdmin.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/admin/pages/ProductsPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProductsPage } from './ProductsPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultProducts, defaultCategories } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('ProductsPage', () => {
  it('lists every product with its category and price', async () => {
    renderAdminPage(<ProductsPage />);
    expect(await screen.findByText(defaultProducts[0].name)).toBeInTheDocument();
    expect(screen.getByText(defaultProducts[1].name)).toBeInTheDocument();
    expect(screen.getByText(defaultProducts[0].category.name)).toBeInTheDocument();
  });

  it('creates a product with one default variant', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/products`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultProducts[0], ...(receivedBody as object) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    await user.click(screen.getByRole('button', { name: '+ New product' }));
    await user.type(screen.getByLabelText('Name'), 'Brass Urli');
    await user.type(screen.getByLabelText('Slug'), 'brass-urli');
    await user.type(screen.getByLabelText('Description'), 'A brass urli bowl');
    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: defaultCategories[0].name }));
    await user.type(screen.getByLabelText('Base price (₹)'), '650');
    await user.type(screen.getByLabelText('Cover image URL'), 'https://img.test/urli.jpg');
    await user.type(screen.getByLabelText('Gallery image URLs (one per line)'), 'https://img.test/urli.jpg\nhttps://img.test/urli2.jpg');
    await user.type(screen.getByLabelText('Default variant stock'), '10');
    await user.type(screen.getByLabelText('Default variant SKU'), 'URL-001');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        name: 'Brass Urli',
        slug: 'brass-urli',
        description: 'A brass urli bowl',
        categoryId: defaultCategories[0].id,
        basePrice: 650,
        imageUrl: 'https://img.test/urli.jpg',
        images: ['https://img.test/urli.jpg', 'https://img.test/urli2.jpg'],
        variants: [{ label: 'Default', stock: 10, sku: 'URL-001' }],
      }),
    );
  });

  it('edits a product, prefilling its current values, with no variant fields shown', async () => {
    let receivedId = '';
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/products/:id`, async ({ request, params }) => {
        receivedId = String(params.id);
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultProducts[0], ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    const row = screen.getByText(defaultProducts[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Name')).toHaveValue(defaultProducts[0].name);
    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Default variant stock')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Base price (₹)'));
    await user.type(screen.getByLabelText('Base price (₹)'), '999');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(receivedId).toBe(defaultProducts[0].id));
    expect(receivedBody).toMatchObject({ basePrice: 999 });
  });

  it('shows the variant sub-table and saves an edited variant', async () => {
    let receivedPath = '';
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/products/:id/variants/:variantId`, async ({ request, params }) => {
        receivedPath = `${params.id}/${params.variantId}`;
        receivedBody = await request.json();
        return HttpResponse.json({ id: params.variantId, ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    const row = screen.getByText(defaultProducts[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Variants' }));

    const variant = defaultProducts[0].variants[0];
    expect(await screen.findByText(variant.sku)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const stockInput = screen.getByLabelText(`Stock for ${variant.sku}`);
    await user.clear(stockInput);
    await user.type(stockInput, '25');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(receivedPath).toBe(`${defaultProducts[0].id}/${variant.id}`));
    expect(receivedBody).toMatchObject({ stock: 25, sku: variant.sku });
  });

  it('shows the server validation error inline on create', async () => {
    server.use(http.post(`${API_URL}/api/admin/products`, () => HttpResponse.json({ error: 'Invalid product payload' }, { status: 400 })));
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    await user.click(screen.getByRole('button', { name: '+ New product' }));
    await user.type(screen.getByLabelText('Name'), 'X');
    await user.type(screen.getByLabelText('Slug'), 'x');
    await user.type(screen.getByLabelText('Description'), 'd');
    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: defaultCategories[0].name }));
    await user.type(screen.getByLabelText('Base price (₹)'), '1');
    await user.type(screen.getByLabelText('Cover image URL'), 'u');
    await user.type(screen.getByLabelText('Default variant stock'), '1');
    await user.type(screen.getByLabelText('Default variant SKU'), 'X-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Invalid product payload')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/admin/pages/ProductsPage.test.tsx`
Expected: FAIL — `Cannot find module './ProductsPage'`.

- [ ] **Step 3: Create `ProductsPage`**

Create `src/app/admin/pages/ProductsPage.tsx`:

```tsx
import { Fragment, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  AdminApiError,
  createAdminProduct,
  getAdminCategories,
  getAdminProducts,
  updateAdminProduct,
  updateAdminVariant,
  type ApiProduct,
  type ApiProductVariant,
  type CreateProductInput,
  type UpdateProductInput,
} from '../lib/adminApi';

function parseImageLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

interface ProductFormState {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  basePrice: string;
  originalPrice: string;
  imageUrl: string;
  imagesText: string;
  variantStock: string;
  variantSku: string;
}

const emptyForm: ProductFormState = {
  name: '', slug: '', description: '', categoryId: '',
  basePrice: '', originalPrice: '', imageUrl: '', imagesText: '',
  variantStock: '', variantSku: '',
};

export function ProductsPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ['admin', 'products'], queryFn: getAdminProducts });
  const categoriesQuery = useQuery({ queryKey: ['admin', 'categories'], queryFn: getAdminCategories });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => createAdminProduct(input),
    onSuccess: () => {
      invalidateProducts();
      toast.success('Product created');
      setDialogOpen(false);
    },
    onError: (error) => setFormError(error instanceof AdminApiError ? error.message : 'Could not save product'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) => updateAdminProduct(id, input),
    onSuccess: () => {
      invalidateProducts();
      toast.success('Product updated');
      setDialogOpen(false);
    },
    onError: (error) => setFormError(error instanceof AdminApiError ? error.message : 'Could not save product'),
  });

  const variantMutation = useMutation({
    mutationFn: ({ productId, variantId, data }: {
      productId: string;
      variantId: string;
      data: { label: string; price?: number; stock: number; sku: string };
    }) => updateAdminVariant(productId, variantId, data),
    onSuccess: () => {
      invalidateProducts();
      toast.success('Variant updated');
    },
    onError: (error) => toast.error(error instanceof AdminApiError ? error.message : 'Could not update variant'),
  });

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (product: ApiProduct) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      categoryId: product.categoryId,
      basePrice: String(product.basePrice),
      originalPrice: product.originalPrice != null ? String(product.originalPrice) : '',
      imageUrl: product.imageUrl,
      imagesText: product.images.join('\n'),
      variantStock: '',
      variantSku: '',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const images = parseImageLines(form.imagesText);

    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        input: {
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          basePrice: Number(form.basePrice),
          originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
          imageUrl: form.imageUrl,
          images,
        },
      });
    } else {
      createMutation.mutate({
        name: form.name,
        slug: form.slug,
        description: form.description,
        categoryId: form.categoryId,
        basePrice: Number(form.basePrice),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        imageUrl: form.imageUrl,
        images,
        variants: [{ label: 'Default', stock: Number(form.variantStock), sku: form.variantSku }],
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (productsQuery.isPending || categoriesQuery.isPending) {
    return <p className="text-muted-foreground">Loading products…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Products</h1>
        <Button onClick={openCreate}>+ New product</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Base price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productsQuery.data?.map((product) => (
            <Fragment key={product.id}>
              <TableRow>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.category.name}</TableCell>
                <TableCell>₹{product.basePrice}</TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? 'default' : 'secondary'}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(product)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
                  >
                    {expandedId === product.id ? 'Hide variants' : 'Variants'}
                  </Button>
                </TableCell>
              </TableRow>
              {expandedId === product.id && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <VariantSubTable
                      product={product}
                      saving={variantMutation.isPending}
                      onSave={(variant, data) => variantMutation.mutate({ productId: product.id, variantId: variant.id, data })}
                    />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit product' : 'New product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            {!editingProduct && (
              <div className="space-y-1.5">
                <Label htmlFor="p-slug">Slug</Label>
                <Input id="p-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-description">Description</Label>
              <Input id="p-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-category">Category</Label>
              <Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}>
                <SelectTrigger id="p-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesQuery.data?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-basePrice">Base price (₹)</Label>
                <Input id="p-basePrice" type="number" min="1" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-originalPrice">Original price (₹, optional)</Label>
                <Input id="p-originalPrice" type="number" min="1" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-imageUrl">Cover image URL</Label>
              <Input id="p-imageUrl" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-images">Gallery image URLs (one per line)</Label>
              <Textarea id="p-images" value={form.imagesText} onChange={(e) => setForm({ ...form, imagesText: e.target.value })} rows={3} />
            </div>
            {!editingProduct && (
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-variantStock">Default variant stock</Label>
                  <Input id="p-variantStock" type="number" min="0" value={form.variantStock} onChange={(e) => setForm({ ...form, variantStock: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-variantSku">Default variant SKU</Label>
                  <Input id="p-variantSku" value={form.variantSku} onChange={(e) => setForm({ ...form, variantSku: e.target.value })} required />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface VariantSubTableProps {
  product: ApiProduct;
  saving: boolean;
  onSave: (variant: ApiProductVariant, data: { label: string; price?: number; stock: number; sku: string }) => void;
}

function VariantSubTable({ product, saving, onSave }: VariantSubTableProps) {
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');

  const startEdit = (variant: ApiProductVariant) => {
    setEditingVariantId(variant.id);
    setLabel(variant.label);
    setPrice(variant.price != null ? String(variant.price) : '');
    setStock(String(variant.stock));
    setSku(variant.sku);
  };

  const handleSave = (variant: ApiProductVariant) => {
    onSave(variant, { label, price: price ? Number(price) : undefined, stock: Number(stock), sku });
    setEditingVariantId(null);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {product.variants.map((variant) =>
          editingVariantId === variant.id ? (
            <TableRow key={variant.id}>
              <TableCell><Input value={label} onChange={(e) => setLabel(e.target.value)} aria-label={`Label for ${variant.sku}`} /></TableCell>
              <TableCell><Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Price for ${variant.sku}`} /></TableCell>
              <TableCell><Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} aria-label={`Stock for ${variant.sku}`} /></TableCell>
              <TableCell><Input value={sku} onChange={(e) => setSku(e.target.value)} aria-label={`SKU for ${variant.sku}`} /></TableCell>
              <TableCell className="text-right">
                <Button size="sm" disabled={saving} onClick={() => handleSave(variant)}>Save</Button>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow key={variant.id}>
              <TableCell>{variant.label}</TableCell>
              <TableCell>{variant.price ?? '—'}</TableCell>
              <TableCell>{variant.stock}</TableCell>
              <TableCell>{variant.sku}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => startEdit(variant)}>Edit</Button>
              </TableCell>
            </TableRow>
          ),
        )}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/admin/pages/ProductsPage.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Wire the route and nav item**

In `src/app/admin/AdminLayout.tsx`, add one entry to `NAV_ITEMS`:

```ts
const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/settings', label: 'Settings' },
];
```

In `src/app/admin/AdminApp.tsx`, add the import:

```tsx
import { ProductsPage } from './pages/ProductsPage';
```

and the route:

```tsx
          <Route path="products" element={<ProductsPage />} />
```

- [ ] **Step 6: Run the full frontend suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/pages/ProductsPage.tsx src/app/admin/pages/ProductsPage.test.tsx src/app/admin/AdminApp.tsx src/app/admin/AdminLayout.tsx
git commit -m "feat: add admin Products page (list, create, edit, variant editing)"
```

---

## Task 7: Frontend — Orders page

**Files:**
- Create: `src/app/admin/pages/OrdersPage.tsx`
- Create: `src/app/admin/pages/OrdersPage.test.tsx`
- Modify: `src/app/admin/AdminApp.tsx`
- Modify: `src/app/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `getAdminOrders`, `updateAdminOrderStatus`, `AdminApiError`, `type AdminOrder`, `type OrderStatus`, `type AdminSettableOrderStatus` from Task 2's `adminApi.ts`; `renderAdminPage` from `src/test/renderAdmin.tsx`; `makeAdminOrder` from `src/test/fixtures.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/admin/pages/OrdersPage.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { OrdersPage } from './OrdersPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultAdminOrders } from '../../../test/server';
import { API_URL, makeAdminOrder } from '../../../test/fixtures';

describe('OrdersPage', () => {
  it('lists orders with order number, customer, total, and status', async () => {
    renderAdminPage(<OrdersPage />);
    const order = defaultAdminOrders[0];
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
    expect(screen.getByText(order.customerName)).toBeInTheDocument();
    expect(screen.getByText(`₹${order.total}`)).toBeInTheDocument();
    expect(screen.getByText(order.status)).toBeInTheDocument();
  });

  it('refetches with the status query param when the filter changes', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${API_URL}/api/admin/orders`, ({ request }) => {
        requestedUrl = request.url;
        const shipped = makeAdminOrder({ id: 'order-2', orderNumber: 'ORD-0002', status: 'SHIPPED' });
        return HttpResponse.json(new URL(request.url).searchParams.get('status') === 'SHIPPED' ? [shipped] : defaultAdminOrders);
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<OrdersPage />);
    await screen.findByText(defaultAdminOrders[0].orderNumber);

    await user.click(screen.getByLabelText('Filter by status'));
    await user.click(screen.getByRole('option', { name: 'SHIPPED' }));

    await waitFor(() => expect(requestedUrl).toBe(`${API_URL}/api/admin/orders?status=SHIPPED`));
    expect(await screen.findByText('ORD-0002')).toBeInTheDocument();
  });

  it('offers only the 4 admin-settable statuses, not PENDING or PAID', async () => {
    renderAdminPage(<OrdersPage />);
    const order = defaultAdminOrders[0];
    await screen.findByText(order.orderNumber);

    const row = screen.getByText(order.orderNumber).closest('tr')!;
    await userEvent.setup().click(within(row).getByLabelText(`Change status for ${order.orderNumber}`));

    expect(screen.getByRole('option', { name: 'PROCESSING' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SHIPPED' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DELIVERED' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CANCELLED' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PENDING' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PAID' })).not.toBeInTheDocument();
  });

  it('updates an order status', async () => {
    let receivedBody: unknown;
    const order = defaultAdminOrders[0];
    server.use(
      http.put(`${API_URL}/api/admin/orders/:id/status`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...order, status: 'SHIPPED' });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<OrdersPage />);
    await screen.findByText(order.orderNumber);

    const row = screen.getByText(order.orderNumber).closest('tr')!;
    await user.click(within(row).getByLabelText(`Change status for ${order.orderNumber}`));
    await user.click(screen.getByRole('option', { name: 'SHIPPED' }));

    await waitFor(() => expect(receivedBody).toEqual({ status: 'SHIPPED' }));
  });

  it('shows an error toast-worthy message when the status update fails', async () => {
    const order = defaultAdminOrders[0];
    server.use(http.put(`${API_URL}/api/admin/orders/:id/status`, () => HttpResponse.json({ error: 'Order not found' }, { status: 404 })));
    const user = userEvent.setup();
    renderAdminPage(<OrdersPage />);
    await screen.findByText(order.orderNumber);

    const row = screen.getByText(order.orderNumber).closest('tr')!;
    await user.click(within(row).getByLabelText(`Change status for ${order.orderNumber}`));
    await user.click(screen.getByRole('option', { name: 'SHIPPED' }));

    expect(await screen.findByText('Order not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/admin/pages/OrdersPage.test.tsx`
Expected: FAIL — `Cannot find module './OrdersPage'`.

- [ ] **Step 3: Create `OrdersPage`**

Create `src/app/admin/pages/OrdersPage.tsx`:

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  AdminApiError,
  getAdminOrders,
  updateAdminOrderStatus,
  type AdminOrder,
  type AdminSettableOrderStatus,
  type OrderStatus,
} from '../lib/adminApi';

const STATUS_FILTERS: (OrderStatus | 'ALL')[] = ['ALL', 'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const SETTABLE_STATUSES: AdminSettableOrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');

  const ordersQuery = useQuery({
    queryKey: ['admin', 'orders', statusFilter],
    queryFn: () => getAdminOrders(statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminSettableOrderStatus }) => updateAdminOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Order updated');
    },
    onError: (error) => toast.error(error instanceof AdminApiError ? error.message : 'Could not update order'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl">Orders</h1>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | 'ALL')}>
          <SelectTrigger className="w-48" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>{status === 'ALL' ? 'All statuses' : status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ordersQuery.isPending ? (
        <p className="text-muted-foreground">Loading orders…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Update status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersQuery.data?.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onStatusChange={(status) => statusMutation.mutate({ id: order.id, status })}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function OrderRow({ order, onStatusChange }: { order: AdminOrder; onStatusChange: (status: AdminSettableOrderStatus) => void }) {
  return (
    <TableRow>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{order.customerName}</TableCell>
      <TableCell>₹{order.total}</TableCell>
      <TableCell><Badge variant="secondary">{order.status}</Badge></TableCell>
      <TableCell className="text-right">
        <Select value="" onValueChange={(value) => onStatusChange(value as AdminSettableOrderStatus)}>
          <SelectTrigger className="w-40 ml-auto" aria-label={`Change status for ${order.orderNumber}`}>
            <SelectValue placeholder="Change status" />
          </SelectTrigger>
          <SelectContent>
            {SETTABLE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}
```

Note: the last test ("shows an error toast-worthy message...") asserts the error text renders via `findByText` — `sonner`'s toasts render into the DOM (a portal), so this assertion works as written without any extra setup, matching how `sonner` is used elsewhere once mounted. If `<Toaster />` (sonner's render target) is not yet mounted anywhere in the test tree, add it directly in this task's test file around the rendered page — see Step 3b below.

- [ ] **Step 3b: Confirm `sonner`'s `Toaster` is mounted for toasts to be visible in tests**

Check whether `<Toaster />` from `sonner` is already rendered somewhere in the app (search: `grep -rn "Toaster" src/app`). If it is not mounted anywhere yet, add it once, at the very end of `src/app/App.tsx`'s `Storefront` component's returned JSX (just before the closing `</div>`) **and** at the end of `src/app/admin/AdminLayout.tsx`'s returned JSX (after `<Outlet />`, inside `<main>` is wrong — put it as a sibling of `<main>`, inside the outer `<div className="min-h-screen flex flex-col">`), importing `import { Toaster } from '../components/ui/sonner';` (storefront) / `import { Toaster } from '../../components/ui/sonner';` (admin). This plan's own test files use `screen.findByText(...)` against whatever `sonner` renders — if `ui/sonner.tsx` wraps the upstream `sonner` package's `<Toaster />` (check the file; it's the shadcn convention), mounting one instance inside `AdminLayout` is sufficient for every admin page's tests, since `OrdersPage.test.tsx` and `CategoriesPage.test.tsx` render the page directly (not through `AdminLayout`) — in that case, `toast.success`/`toast.error` calls still work (they push to the global `sonner` toast store) but nothing in the test's own render tree displays them unless the test also mounts a `<Toaster />`. Since none of this plan's page-level tests assert on toast text except this one `OrdersPage` test, add a local `<Toaster />` directly inside `OrdersPage.test.tsx`'s render for that one assertion instead of changing app-wide mounting: wrap the rendered element as `renderAdminPage(<><OrdersPage /><Toaster /></>)` in that specific test, importing `Toaster` from `../../components/ui/sonner`. Apply this same one-line adjustment to the earlier `CategoriesPage.test.tsx` test "shows the server validation error inline" — no, that one asserts `formError` inline text, not a toast, so it needs no `Toaster`. Re-check every test in this plan that asserts toast-originated text specifically: only this `OrdersPage` test does. Fix it now:

In `src/app/admin/pages/OrdersPage.test.tsx`, add the import:

```tsx
import { Toaster } from '../../components/ui/sonner';
```

and change the last test's render call from `renderAdminPage(<OrdersPage />);` to:

```tsx
    renderAdminPage(
      <>
        <OrdersPage />
        <Toaster />
      </>,
    );
```

(only in that one test — the other four tests in this file don't need it).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/admin/pages/OrdersPage.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Wire the route and nav item**

In `src/app/admin/AdminLayout.tsx`, add one entry to `NAV_ITEMS`:

```ts
const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/settings', label: 'Settings' },
];
```

In `src/app/admin/AdminApp.tsx`, add the import:

```tsx
import { OrdersPage } from './pages/OrdersPage';
```

and the route:

```tsx
          <Route path="orders" element={<OrdersPage />} />
```

- [ ] **Step 6: Run the full frontend suite**

Run: `npx vitest run`
Expected: all tests pass. All 5 nav items now resolve to real pages.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/pages/OrdersPage.tsx src/app/admin/pages/OrdersPage.test.tsx src/app/admin/AdminApp.tsx src/app/admin/AdminLayout.tsx
git commit -m "feat: add admin Orders page (list, filter by status, update status)"
```

---

## Task 8: Final integration pass

**Files:**
- None created or modified unless Step 1 or 2 finds something to fix — this is a verification-only task confirming the whole admin UI works together.

**Interfaces:**
- None — consumes everything from Tasks 1–7 as a finished whole.

- [ ] **Step 1: Confirm all 5 nav items resolve to real routes**

```bash
grep -n "NAV_ITEMS" -A 6 src/app/admin/AdminLayout.tsx
grep -n "<Route path=" src/app/admin/AdminApp.tsx
```

Expected: `NAV_ITEMS` has exactly 5 entries (Dashboard, Products, Categories, Orders, Settings) and `AdminApp.tsx` has a matching `<Route>` for each of `products`, `categories`, `orders`, `settings`, plus the `index` route and `login`.

- [ ] **Step 2: Run the full frontend suite with coverage**

Run: `npx vitest run --coverage`
Expected: every test file passes. Check the coverage summary for `src/app/admin/**` — anything at 0% indicates a file that got created but never exercised by a test; if so, go back to that task and add the missing test case rather than leaving it uncovered.

- [ ] **Step 3: Full manual smoke test**

Start Postgres and the backend (`cd server && docker compose up -d && npm run dev`) and the frontend (`npm run dev`) together. In a browser:

1. Visit `http://localhost:5173/admin` while logged out. Expected: redirected to `/admin/login`.
2. Log in with the seeded admin credentials (`admin@example.com` / whatever `SEED_ADMIN_PASSWORD` was set to, default `changeme123` per `server/README.md`). Expected: lands on `/admin`, Dashboard shows real counts (17 products, 0 pending orders on a freshly seeded DB).
3. Click each of the 5 nav items. Expected: each page loads its real data (Products: 17 rows; Categories: 5 rows; Orders: whatever exists, likely empty on a fresh DB; Settings: prefilled with 50 / 999).
4. On Products: create a new product, confirm it appears in the list (Dashboard's count also increments on next visit); expand an existing product's variants and edit one, confirm the change persists on refresh.
5. On Categories: create, edit, and delete a category; confirm each change persists on refresh.
6. On Settings: change the shipping fee, save, refresh the page, confirm it persisted.
7. Click "Log out". Expected: returns to `/admin/login`. Visiting `/admin/products` directly afterward redirects back to login (session is gone).
8. While logged in, open the storefront (`http://localhost:5173/`) in the same browser and confirm it still works normally — unaffected by the admin work.

- [ ] **Step 4: Final commit (only if Step 1, 2, or 3 needed a fix)**

If everything passed with no changes needed, there's nothing to commit for this task. If a fix was needed, commit it with a message describing what was wrong and how it was fixed.

---

## Definition of Done

- `npm run build` (frontend) and `cd server && npx tsc --noEmit` both compile with no errors.
- `npx vitest run` (frontend) and `cd server && npx vitest run` (backend) both pass in full.
- All 5 admin nav items (Dashboard, Products, Categories, Orders, Settings) work end-to-end against the real backend, per Task 8's manual smoke test.
- An unauthenticated visit to any `/admin/*` route (other than `/admin/login`) redirects to `/admin/login`; a session expiring mid-use anywhere in the admin UI does the same.
- The storefront (`/`, `/category/*`, `/product/*`, cart, checkout) is unaffected — same behavior as before this plan, confirmed by every pre-existing test in `App.test.tsx` still passing unmodified.

**Deferred to future work** (recorded in the spec, not addressed here): the production cross-origin cookie fix once deployment topology is chosen; actual deployment (Postgres, hosting, live Razorpay keys, cron for the abandoned-order job); the admin password-change flow.
