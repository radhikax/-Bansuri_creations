# Storefront Data Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the React storefront's hardcoded `products`/`categories` mock data with real data fetched from the backend API, with no visible change to existing components.

**Architecture:** A thin `fetch`-based API client (`src/app/lib/api.ts`) plus a small generic loading-state hook (`src/app/lib/useApiData.ts`) plus a pure adapter layer (`src/app/lib/adapters.ts`) that maps the backend's real JSON shape onto the frontend's existing `Product`/category types — so `ProductCard`, `HomePage`, `CategoryPage`, and `Cart` need no changes beyond one type fix (`Product.id: number` → `string`) and two small "stop guessing, use the real field" corrections found while reading the existing code.

**Tech Stack:** React 18, TypeScript, Vite, React Router. No new dependencies (per the approved design: no data-fetching library, no test runner).

**Spec:** `docs/superpowers/specs/2026-09-18-storefront-data-wiring-design.md`

## Global Constraints

- No new npm dependencies — plain `fetch`, no axios/React Query/SWR (spec's explicit non-goal).
- No test runner exists on the frontend (`package.json` has no `test` script) and this plan does not add one — every task's verification step is manual, via the running Vite dev server against the running backend. This is a deliberate, spec-approved deviation from this skill's usual TDD template.
- Cart behavior (add/remove/update quantity, the cart drawer, the demo "Proceed to Checkout" payment dialog in `Cart.tsx`) is explicitly out of scope — do not touch `Cart.tsx`'s checkout/payment logic, only the type of `productId` in its two callback props.
- The backend (`server/`) is already built, tested, and merged into `main` (PR #3). `GET /api/categories` returns `Category[]` ordered by name; `GET /api/products` and `GET /api/products?category=<slug>` return `Product[]` with `variants` and `category` included — confirmed directly from `server/src/routes/categories.routes.ts` and `server/src/routes/products.routes.ts`, which return raw Prisma query results with no field renaming.
- Money fields from the API (`basePrice`, `originalPrice`, variant `price`) are whole-rupee integers, matching the frontend's existing `price`/`originalPrice: number` fields — no unit conversion needed anywhere in this plan.

---

## Task 1: API client, loading-state hook, and adapters

**Files:**
- Create: `src/app/lib/api.ts`
- Create: `src/app/lib/useApiData.ts`
- Create: `src/app/lib/adapters.ts`
- Create: `.env.example` (repo root)

**Interfaces:**
- Produces: `ApiCategory`, `ApiProductVariant`, `ApiProduct` types; `getCategories(): Promise<ApiCategory[]>`; `getProducts(categorySlug?: string): Promise<ApiProduct[]>` (all from `api.ts`) — consumed by Task 2.
- Produces: `useApiData<T>(fetcher: () => Promise<T>): { data: T | null; loading: boolean; error: string | null }` (from `useApiData.ts`) — consumed by Task 2.
- Produces: `adaptCategory(api: ApiCategory): Category` and `adaptProduct(api: ApiProduct): Product` (from `adapters.ts`), where `Category` is the anonymous `{ title, description, image, icon, slug }` shape `HomePage`/`CategoryCard` use (extended with `slug` — see Task 3) — consumed by Task 2.

The backend's exact JSON shape (verified directly against `server/prisma/schema.prisma` and the route handlers, which return raw Prisma rows with no renaming):

```ts
// A Category row, as returned by GET /api/categories (array) and nested
// under `category` in each product from GET /api/products.
interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

// A ProductVariant row, nested under `variants` in each product.
interface ApiProductVariant {
  id: string;
  productId: string;
  label: string;
  price: number | null;
  stock: number;
  sku: string;
  createdAt: string;
  updatedAt: string;
}

// A Product row, as returned by GET /api/products and GET /api/products/:slug,
// with `variants` and `category` included.
interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  category: ApiCategory;
  basePrice: number;
  originalPrice: number | null;
  imageUrl: string;
  rating: number;
  isActive: boolean;
  variants: ApiProductVariant[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 1: Create `.env.example` at the repo root**

```
VITE_API_BASE_URL=http://localhost:4000
```

- [ ] **Step 2: Create `src/app/lib/api.ts`**

```ts
export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProductVariant {
  id: string;
  productId: string;
  label: string;
  price: number | null;
  stock: number;
  sku: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  category: ApiCategory;
  basePrice: number;
  originalPrice: number | null;
  imageUrl: string;
  rating: number;
  isActive: boolean;
  variants: ApiProductVariant[];
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getCategories(): Promise<ApiCategory[]> {
  return fetchJson<ApiCategory[]>('/api/categories');
}

export function getProducts(categorySlug?: string): Promise<ApiProduct[]> {
  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
  return fetchJson<ApiProduct[]>(`/api/products${query}`);
}
```

- [ ] **Step 3: Create `src/app/lib/useApiData.ts`**

```ts
import { useEffect, useState } from 'react';

interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiData<T>(fetcher: () => Promise<T>): ApiDataState<T> {
  const [state, setState] = useState<ApiDataState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetcher()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          setState({ data: null, loading: false, error: message });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
```

The `cancelled` guard prevents a `setState` call after the component unmounts (e.g. fast route navigation away from the page mid-fetch) — a real, if narrow, class of React warning this hook would otherwise produce.

- [ ] **Step 4: Create `src/app/lib/adapters.ts`**

```ts
import { Product } from '../types';
import { ApiCategory, ApiProduct } from './api';

export interface AdaptedCategory {
  title: string;
  description: string;
  image: string;
  icon: string;
  slug: string;
}

export function adaptCategory(api: ApiCategory): AdaptedCategory {
  return {
    title: api.name,
    description: api.description,
    image: api.imageUrl,
    icon: api.icon,
    slug: api.slug,
  };
}

export function adaptProduct(api: ApiProduct): Product {
  const defaultVariant = api.variants[0];
  const price = defaultVariant?.price ?? api.basePrice;
  const inStock = defaultVariant ? defaultVariant.stock > 0 : false;

  return {
    id: api.id,
    name: api.name,
    price,
    originalPrice: api.originalPrice ?? undefined,
    image: api.imageUrl,
    category: api.category.name,
    rating: api.rating,
    inStock,
  };
}
```

`adaptProduct` collapses a multi-variant product (e.g. "Kanha Ji Dress": Small/Medium/Large) to a single card using the first variant's price/stock, per the approved spec — full variant selection is out of scope for this sub-project. A product with zero variants (shouldn't happen given the seed data, but the type allows it) is treated as out of stock rather than throwing.

- [ ] **Step 5: Manually verify the pipeline end-to-end**

This task has no independently-runnable UI yet (that's Task 2), so verify it with a temporary, throwaway snippet rather than skipping verification.

Start the backend: `cd server && npm run dev` (requires `server/.env` to exist — copy from `server/.env.example` if it doesn't, and `docker compose up -d` for Postgres if it isn't already running; see `server/README.md` and `server/.claude/skills/verify/SKILL.md` for the full local-dev setup if starting from a completely fresh checkout).

Then, temporarily add this to the top of `src/app/App.tsx` (inside the `App` function body, before the `return`) and start `npm run dev` for the frontend:

```ts
import { useEffect } from 'react';
import { getCategories, getProducts } from './lib/api';
import { adaptCategory, adaptProduct } from './lib/adapters';

// TEMPORARY — remove before committing this step
useEffect(() => {
  getCategories().then((cats) => console.log('categories:', cats.map(adaptCategory)));
  getProducts().then((prods) => console.log('products:', prods.map(adaptProduct)));
}, []);
```

Open `http://localhost:5173` in a browser, open devtools console. Expected: two console logs — `categories:` with 5 entries each having `title`/`description`/`image`/`icon`/`slug` (e.g. one entry's `title` is `"Diwali Decor"`, `slug` is `"diwali-decor"`), and `products:` with 14 entries each having `name`/`price`/`image`/`category`/`rating`/`inStock` (e.g. one entry's `name` is `"Diwali Special Diyas Set (12 pieces)"`, `price` is `499`). Confirm no errors in the console and no failed request in the Network tab.

**Remove this temporary snippet** from `App.tsx` before the commit in Step 6 — it was only to prove Task 1's pipeline works; Task 2 replaces it with the real wiring.

- [ ] **Step 6: Commit**

```bash
git add src/app/lib/api.ts src/app/lib/useApiData.ts src/app/lib/adapters.ts .env.example
git commit -m "feat: add API client, loading-state hook, and data adapters for the storefront"
```

---

## Task 2: Wire `App.tsx` to real data, with loading and error states

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/types.ts`
- Modify: `src/app/components/Cart.tsx`

**Interfaces:**
- Consumes: `getCategories`, `getProducts` from `./lib/api` (Task 1); `useApiData` from `./lib/useApiData` (Task 1); `adaptCategory`, `adaptProduct`, `AdaptedCategory` from `./lib/adapters` (Task 1).
- Produces: `Product.id: string` (breaking change to the existing type) — consumed by Task 3's `CategoryPage` work and by `Cart`/`ProductCard`/`HomePage`, none of which need further changes beyond what this task makes.

- [ ] **Step 1: Change `Product.id` to `string` in `src/app/types.ts`**

```ts
export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
  inStock: boolean;
}
```

- [ ] **Step 2: Update `Cart.tsx`'s two callback prop types**

In `src/app/components/Cart.tsx`, change:

```ts
interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
}
```

to:

```ts
interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
}
```

Nothing else in `Cart.tsx` needs to change — `item.id` is only ever passed through to these callbacks or used as a React `key`/object-spread, never compared to a number or used arithmetically.

- [ ] **Step 3: Rewrite `src/app/App.tsx` to fetch real data**

Replace the entire file:

```tsx
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Cart, type CartItem } from './components/Cart';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { Product } from './types';
import { getCategories, getProducts } from './lib/api';
import { useApiData } from './lib/useApiData';
import { adaptCategory, adaptProduct } from './lib/adapters';

export default function App() {
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
    <Router>
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
                  <div key={i} className="h-80 rounded bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="container mx-auto px-4 py-16 text-center">
              <p className="text-lg">Couldn't load products, please try again later.</p>
            </div>
          ) : (
            <Routes>
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
                    onAddToCart={handleAddToCart}
                  />
                }
              />
            </Routes>
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
    </Router>
  );
}
```

Note: `CategoryPage`'s call site is deliberately left unchanged here (`products`/`onAddToCart` only, matching its current props exactly) — it still has its pre-existing hardcoded `categoryMap` bug at the end of this task, which is fine, since that bug already exists today and this task doesn't make it worse. Task 3 both fixes `CategoryPage` and updates this call site together, so every task keeps building and type-checking on its own.

- [ ] **Step 4: Manually verify**

With the backend running (`cd server && npm run dev`) and frontend running (`npm run dev`), open `http://localhost:5173`. Expected: a brief skeleton grid, then the home page renders with 5 real categories and 8 real featured products (matching what Task 1's console-log step showed), each with a working "Add to Cart" button that opens the cart drawer. Open browser devtools Network tab and confirm two requests: `GET http://localhost:4000/api/categories` and `GET http://localhost:4000/api/products`, both 200.

Then stop the backend (`Ctrl+C` in its terminal) and reload `http://localhost:5173`. Expected: the skeleton briefly appears, then "Couldn't load products, please try again later." — not a blank page or a thrown error in the console. Restart the backend afterward for the next task.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/app/types.ts src/app/components/Cart.tsx
git commit -m "feat: wire storefront to real API data with loading/error states"
```

---

## Task 3: Fix `CategoryPage` and `CategoryCard` to use real category data instead of guessing

**Files:**
- Modify: `src/app/pages/CategoryPage.tsx`
- Modify: `src/app/pages/HomePage.tsx`
- Modify: `src/app/components/CategoryCard.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `AdaptedCategory` shape from Task 1's `adapters.ts` (`{ title, description, image, icon, slug }`).

Found while reading the existing code (not part of the original approved spec text, but the same category of "stop duplicating/guessing data the API now provides" problem the CategoryPage section of the spec already called out): `CategoryCard.tsx` derives its own slug from the category title (`title.toLowerCase().replace(/\s+/g, '-')`) instead of using a real slug. It happens to produce the same result as the backend's real slugs today, but it's the identical class of fragile, driftable guess as `CategoryPage`'s hardcoded `categoryMap` — both get fixed together in this task since they're the same root cause (neither component has ever had a real `slug` field to use, until now).

- [ ] **Step 1: Update `HomePageProps` and `CategoryPage`'s props to use `AdaptedCategory`**

In `src/app/pages/HomePage.tsx`, replace the inline `categories` prop type:

```ts
import { Hero } from '../components/Hero';
import { CategoryCard } from '../components/CategoryCard';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types';
import { AdaptedCategory } from '../lib/adapters';

interface HomePageProps {
  products: Product[];
  categories: AdaptedCategory[];
  onAddToCart: (product: Product) => void;
}
```

The rest of `HomePage.tsx` is unchanged — `category.title`, `.description`, `.image`, `.icon` all still exist on `AdaptedCategory`, and the `<CategoryCard key={category.title} title={...} .../>` call now additionally needs `slug={category.slug}` (added in Step 2 below).

- [ ] **Step 2: Add a `slug` prop to `CategoryCard` and stop deriving it from the title**

Replace `src/app/components/CategoryCard.tsx`:

```tsx
import { Card } from './ui/card';
import { Link } from 'react-router-dom';

interface CategoryCardProps {
  title: string;
  description: string;
  image: string;
  icon: string;
  slug: string;
}

export function CategoryCard({ title, description, image, icon, slug }: CategoryCardProps) {
  return (
    <Link to={`/category/${slug}`}>
      <Card className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
        <div className="relative h-64 overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="text-3xl mb-2">{icon}</div>
            <h3 className="text-2xl mb-2">{title}</h3>
            <p className="text-sm text-white/90">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
```

Then in `src/app/pages/HomePage.tsx`, update the `CategoryCard` usage to pass the new prop:

```tsx
{categories.map((category) => (
  <CategoryCard
    key={category.slug}
    title={category.title}
    description={category.description}
    image={category.image}
    icon={category.icon}
    slug={category.slug}
  />
))}
```

(`key` also switches from `category.title` to `category.slug` — a slug is the more correct unique key, and titles could theoretically collide where slugs can't since the backend enforces `slug` as `@unique`.)

- [ ] **Step 3: Replace `CategoryPage`'s hardcoded `categoryMap` with a real lookup**

Replace `src/app/pages/CategoryPage.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types';
import { AdaptedCategory } from '../lib/adapters';

interface CategoryPageProps {
  products: Product[];
  categories: AdaptedCategory[];
  onAddToCart: (product: Product) => void;
}

export function CategoryPage({ products, categories, onAddToCart }: CategoryPageProps) {
  const { category: categorySlug } = useParams<{ category: string }>();

  const matchedCategory = categories.find((c) => c.slug === categorySlug);
  const categoryName = matchedCategory?.title ?? '';
  const filteredProducts = products.filter((p) => p.category === categoryName);

  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-5xl mb-4">{categoryName}</h1>
        <p className="text-muted-foreground mb-12">
          Browse our collection of {categoryName.toLowerCase()}
        </p>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-16">
            No products found in this category.
          </p>
        )}
      </div>
    </div>
  );
}
```

(The final `<p>No products found...</p>` fallback branch already existed in the original file for the empty case — carried over unchanged; only the category-name resolution changed.)

- [ ] **Step 4: Pass the `categories` prop through from `App.tsx`**

In `src/app/App.tsx`, update the `CategoryPage` route element (left unchanged by Task 2 specifically so this task could make the props change in one place):

```tsx
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
```

- [ ] **Step 5: Manually verify**

With both servers running, on the home page click each of the 5 category cards. Expected for every one: navigates to `/category/<real-slug>` (e.g. `/category/diwali-decor`), the page title matches the real category name, and it shows only that category's real products (e.g. "Diwali Decor" shows 4 products: the two Diwali sets, the lights/lanterns, and the rangoli stencils, matching what `GET /api/products?category=diwali-decor` returns). Also directly navigate to a nonsense URL like `/category/does-not-exist` and confirm it shows an empty title and "No products found in this category." rather than crashing.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/CategoryPage.tsx src/app/pages/HomePage.tsx src/app/components/CategoryCard.tsx src/app/App.tsx
git commit -m "fix: derive category name/slug from real API data instead of guessing"
```

---

## Task 4: Remove the now-dead category-to-product-count assumption and do a full manual pass

**Files:**
- None created or modified — this is a verification-only task confirming the whole slice works together, plus one dead-code check.

**Interfaces:**
- None — this task consumes everything from Tasks 1–3 as a finished whole.

- [ ] **Step 1: Confirm no leftover references to the old hardcoded data**

```bash
grep -rn "Mock product data\|inStock: true\|inStock: false" src/app/App.tsx
```

Expected: no output (the hardcoded arrays were fully replaced in Task 2, Step 3's rewrite). If this finds anything, `App.tsx` wasn't fully replaced — re-check Task 2, Step 3.

- [ ] **Step 2: Full manual smoke test**

Start Postgres if not already running (`cd server && docker compose up -d`), the backend (`cd server && npm run dev`), and the frontend (`npm run dev`) together. Then, in a browser:

1. Home page loads with 5 real categories and 8 featured products (out of the 14 total).
2. Click "Add to Cart" on a product — cart drawer opens, item appears with correct name/price/image.
3. Increase and decrease its quantity in the cart — updates correctly, total recalculates.
4. Click a category card — navigates to that category's real slug, shows only that category's real products.
5. Use the browser back button — returns to the home page with categories/products still showing (no re-fetch flash, since `App.tsx`'s hooks only re-run on mount, not on route change — this is expected and fine since `App` itself doesn't unmount on route change within the same `Router`).
6. Stop the backend, refresh the page — loading skeleton, then the error message, not a crash or blank page.

- [ ] **Step 3: Final commit (only if Step 1 or 2 needed a fix)**

If everything in Steps 1–2 passed with no changes needed, there's nothing to commit for this task — it's verification-only. If a fix was needed, commit it with a message describing what was wrong and how it was fixed.

---

## Definition of Done

- `npm run build` (frontend) compiles with no TypeScript errors.
- All 4 tasks' manual verification steps pass as described.
- No hardcoded product/category data remains in `App.tsx`.
- `Cart.tsx`'s existing demo checkout/payment dialog is untouched (out of scope — that's the follow-on checkout-flow sub-project).

**Next specs:** the checkout flow (Cart → `CheckoutPage` → `POST /api/orders` → Razorpay Checkout widget → `OrderConfirmationPage`) and the admin UI (login + product/category/order/settings management) remain separate, not-yet-brainstormed sub-projects, per the design spec's decomposition.
