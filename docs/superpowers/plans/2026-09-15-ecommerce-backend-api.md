# E-Commerce Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone Express + TypeScript REST API (products, orders, Razorpay payments, admin panel endpoints) and Postgres database that the existing React storefront will call, per the approved design spec.

**Architecture:** A new `server/` directory containing an Express + TypeScript app, using Prisma as the ORM against PostgreSQL. Public routes serve products/categories/order-creation/order-lookup; admin routes (behind a JWT cookie) manage products, categories, orders, and settings. Razorpay payment confirmation happens exclusively via a signature-verified webhook. This plan produces a fully working, independently testable backend (via automated tests and manual `curl`/Postman calls) — the frontend is wired up in a separate follow-on plan.

**Tech Stack:** Node.js, TypeScript (CommonJS), Express, Prisma + PostgreSQL, Zod (request validation), bcrypt + jsonwebtoken (admin auth), Razorpay SDK, Resend (email), Vitest + Supertest (testing), Docker Compose (local Postgres for dev/test).

**Spec:** `docs/superpowers/specs/2026-09-15-ecommerce-backend-design.md`

## Global Constraints

- Money is stored and passed around as **whole-rupee integers** (matches existing product data, which has no paise amounts) — never floats. Convert to paise (`× 100`) only at the Razorpay SDK boundary.
- The Razorpay **webhook is the sole source of truth** for payment confirmation. No other code path may mark an order `PAID`.
- **No customer accounts** — checkout is guest-only; order lookup is by `orderNumber` only.
- **Single admin only** — no roles/permissions system, one `AdminUser` record is enough.
- **REST monolith, not microservices** — one Express app, one database.
- The backend is a **CommonJS** TypeScript project (`tsx`/`tsc`), independent of the frontend's ESM/Vite setup — do not mix the two.
- Local dev and tests run against **Postgres in Docker** (not SQLite, not mocked) — Postgres is also the production target (Neon/Supabase free tier), so behavior matches.
- Target **free-tier hosting**: Render/Railway free tier for the API, Neon or Supabase free tier for production Postgres, Resend free tier for email.

---

## Task 1: Backend project scaffolding

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/.env.example`
- Create: `server/.gitignore`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/tests/setup.ts`
- Test: `server/tests/health.test.ts`

**Interfaces:**
- Produces: `app` (default export of `server/src/app.ts`, an `express.Express` instance with no `.listen()` call) — every later route task imports this to mount routers and every test imports it for `supertest(app)`.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "decor-ecommerce-server",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "5.20.0",
    "bcrypt": "5.1.1",
    "cookie-parser": "1.4.6",
    "cors": "2.8.5",
    "dotenv": "16.4.5",
    "express": "4.19.2",
    "jsonwebtoken": "9.0.2",
    "razorpay": "2.9.4",
    "resend": "4.0.1",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "5.0.2",
    "@types/cookie-parser": "1.4.7",
    "@types/cors": "2.8.17",
    "@types/express": "4.17.21",
    "@types/jsonwebtoken": "9.0.6",
    "@types/node": "20.14.9",
    "@types/supertest": "6.0.2",
    "prisma": "5.20.0",
    "supertest": "7.0.0",
    "tsx": "4.19.1",
    "typescript": "5.6.2",
    "vitest": "2.1.1"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `server/.gitignore`**

```
node_modules
dist
.env
.env.test
```

- [ ] **Step 4: Create `server/.env.example`**

```
DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_dev"
JWT_SECRET="change-me-to-a-long-random-string"
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
RESEND_API_KEY=""
STORE_EMAIL_FROM="orders@yourdomain.com"
STORE_OWNER_EMAIL="owner@example.com"
FRONTEND_ORIGIN="http://localhost:5173"
PORT=4000
```

- [ ] **Step 5: Install dependencies**

Run: `cd server && npm install`
Expected: install completes with no errors, `server/node_modules` and `server/package-lock.json` created.

- [ ] **Step 6: Create `server/src/app.ts`**

```ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

- [ ] **Step 7: Create `server/src/index.ts`**

```ts
import 'dotenv/config';
import app from './app';

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
```

- [ ] **Step 8: Create `server/tests/setup.ts`**

```ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
```

- [ ] **Step 9: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    hookTimeout: 30000,
    testTimeout: 15000,
    fileParallelism: false,
  },
});
```

`fileParallelism: false` matters here: every test file shares the same Postgres test database, so files must not run concurrently against it.

- [ ] **Step 10: Write the failing test — `server/tests/health.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 11: Run the test**

Run: `cd server && npx vitest run tests/health.test.ts`
Expected: PASS (this task has no DB dependency yet, so it should pass immediately — this step just confirms the toolchain, TS config, and test runner all work together).

- [ ] **Step 12: Commit**

```bash
git add server/package.json server/package-lock.json server/tsconfig.json server/vitest.config.ts server/.env.example server/.gitignore server/src/app.ts server/src/index.ts server/tests/setup.ts server/tests/health.test.ts
git commit -m "feat(server): scaffold Express+TS backend with health check"
```

---

## Task 2: Postgres (Docker) + Prisma schema + migration + client

**Files:**
- Create: `server/docker-compose.yml`
- Create: `server/prisma/schema.prisma`
- Create: `server/.env` (local only, not committed)
- Create: `server/.env.test` (local only, not committed)
- Create: `server/src/db.ts`
- Test: `server/tests/db.test.ts`

**Interfaces:**
- Produces: `prisma` (named export of `server/src/db.ts`, a `PrismaClient` singleton) — every route/service task that touches the database imports this.
- Produces: Prisma models `Category`, `Product`, `ProductVariant`, `Order`, `OrderItem`, `AdminUser`, `StoreSettings`, and enum `OrderStatus`, exactly as named here — later tasks rely on these exact names and fields.

- [ ] **Step 1: Create `server/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ecommerce
      POSTGRES_PASSWORD: ecommerce
      POSTGRES_DB: ecommerce_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: Start Postgres and create the test database**

Run: `cd server && docker compose up -d`
Expected: container starts; `docker compose ps` shows it healthy/running.

Run: `docker compose exec postgres createdb -U ecommerce ecommerce_test`
Expected: command completes with no output (database created). If it errors with "already exists", that's fine — it means a prior run already created it.

- [ ] **Step 3: Create `server/.env` and `server/.env.test`**

`server/.env`:
```
DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_dev"
JWT_SECRET="dev-secret-change-in-production"
RAZORPAY_KEY_ID="rzp_test_placeholder"
RAZORPAY_KEY_SECRET="placeholder"
RAZORPAY_WEBHOOK_SECRET="placeholder"
RESEND_API_KEY="placeholder"
STORE_EMAIL_FROM="orders@example.com"
STORE_OWNER_EMAIL="owner@example.com"
FRONTEND_ORIGIN="http://localhost:5173"
PORT=4000
```

`server/.env.test` (same, but pointed at the test database):
```
DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_test"
JWT_SECRET="test-secret"
RAZORPAY_KEY_ID="rzp_test_placeholder"
RAZORPAY_KEY_SECRET="placeholder"
RAZORPAY_WEBHOOK_SECRET="test-webhook-secret"
RESEND_API_KEY="placeholder"
STORE_EMAIL_FROM="orders@example.com"
STORE_OWNER_EMAIL="owner@example.com"
FRONTEND_ORIGIN="http://localhost:5173"
PORT=4001
```

Both files are gitignored (Task 1, Step 3) — never commit real secrets here.

- [ ] **Step 4: Create `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Category {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String
  imageUrl    String
  icon        String
  products    Product[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Product {
  id            String           @id @default(cuid())
  name          String
  slug          String           @unique
  description   String
  categoryId    String
  category      Category         @relation(fields: [categoryId], references: [id])
  basePrice     Int
  originalPrice Int?
  imageUrl      String
  rating        Float            @default(0)
  isActive      Boolean          @default(true)
  variants      ProductVariant[]
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

model ProductVariant {
  id         String      @id @default(cuid())
  productId  String
  product    Product     @relation(fields: [productId], references: [id])
  label      String
  price      Int?
  stock      Int         @default(0)
  sku        String      @unique
  orderItems OrderItem[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

model Order {
  id                String      @id @default(cuid())
  orderNumber       String      @unique
  customerName      String
  customerPhone     String
  customerEmail     String
  addressStreet     String
  addressCity       String
  addressState      String
  addressPincode    String
  subtotal          Int
  shippingFee       Int
  total             Int
  status            OrderStatus @default(PENDING)
  razorpayOrderId   String?     @unique
  razorpayPaymentId String?
  paidAt            DateTime?
  items             OrderItem[]
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
}

model OrderItem {
  id                   String         @id @default(cuid())
  orderId              String
  order                Order          @relation(fields: [orderId], references: [id])
  productVariantId     String
  productVariant       ProductVariant @relation(fields: [productVariantId], references: [id])
  productNameSnapshot  String
  variantLabelSnapshot String
  unitPrice            Int
  quantity             Int
}

model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model StoreSettings {
  id                    Int @id @default(1)
  flatShippingFee       Int @default(50)
  freeShippingThreshold Int @default(999)
}
```

- [ ] **Step 5: Run the first migration against the dev database**

Run: `cd server && npx dotenv -e .env -- npx prisma migrate dev --name init`

If `dotenv-cli` isn't installed, run instead (PowerShell):
```
cd server
$env:DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_dev"
npx prisma migrate dev --name init
```
Expected: migration created under `server/prisma/migrations/`, applied successfully, Prisma Client generated.

- [ ] **Step 6: Apply the same migration to the test database**

PowerShell:
```
cd server
$env:DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5432/ecommerce_test"
npx prisma migrate deploy
```
Expected: migration applied with no errors.

- [ ] **Step 7: Create `server/src/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 8: Write the failing test — `server/tests/db.test.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/db';

describe('database connection', () => {
  it('connects and can query an empty categories table', async () => {
    const categories = await prisma.category.findMany();
    expect(categories).toEqual([]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 9: Run test to verify it fails first without env pointed at test DB**

Run: `cd server && npx vitest run tests/db.test.ts`
Expected: PASS once `.env.test` (Step 3) is in place and `tests/setup.ts` (Task 1) loads it — `DATABASE_URL` resolves to `ecommerce_test`, which is empty after migration. If it fails with a connection error, confirm Docker Postgres is running (`docker compose ps`) and `.env.test` has the right URL.

- [ ] **Step 10: Commit**

```bash
git add server/docker-compose.yml server/prisma/schema.prisma server/prisma/migrations server/src/db.ts server/tests/db.test.ts
git commit -m "feat(server): add Prisma schema, Postgres via Docker, and db client"
```

Note: `server/.env` and `server/.env.test` are intentionally not committed (gitignored).

---

## Task 3: Seed script

**Files:**
- Create: `server/prisma/seed.ts`
- Test: `server/tests/seed.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../src/db` (Task 2).
- Produces: `seedDatabase(prismaClient): Promise<void>` (named export of `server/prisma/seed.ts`) — used by the test and by the `npm run prisma:seed` script.

- [ ] **Step 1: Create `server/prisma/seed.ts`**

Transcribes the 16 existing mock products from `src/app/App.tsx` in the frontend into the new Category/Product/ProductVariant shape, adds a default admin user and default store settings.

```ts
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const categoriesData = [
  { name: 'Wedding Packing', slug: 'wedding-packing', description: 'Elegant packaging for Indian wedding favors and return gifts', imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', icon: '🎁' },
  { name: 'Festive Decoration', slug: 'festive-decoration', description: 'Wall hangings, bandhanwar, and traditional festive decor', imageUrl: 'https://images.unsplash.com/photo-1762173886363-de541417e48e', icon: '🪔' },
  { name: 'Diwali Decor', slug: 'diwali-decor', description: 'Special Diwali collection - diyas, lights, rangoli & more', imageUrl: 'https://images.unsplash.com/photo-1666244453401-43a8c15b5640', icon: '✨' },
  { name: 'Kanha Dresses', slug: 'kanha-dresses', description: 'Traditional dresses for Kanha Ji in all sizes', imageUrl: 'https://images.unsplash.com/photo-1653794354513-4b6d139408f0', icon: '🪈' },
  { name: 'Customized Gifting', slug: 'customized-gifting', description: 'Personalized gifts for birthdays, anniversaries & all occasions', imageUrl: 'https://images.unsplash.com/photo-1674620213535-9b2a2553ef40', icon: '💝' },
];

interface ProductSeed {
  name: string;
  slug: string;
  categorySlug: string;
  basePrice: number;
  originalPrice?: number;
  imageUrl: string;
  rating: number;
  variants: { label: string; price?: number; stock: number; sku: string }[];
}

const productsData: ProductSeed[] = [
  { name: 'Indian Wedding Gift Boxes (Set of 10)', slug: 'indian-wedding-gift-boxes', categorySlug: 'wedding-packing', basePrice: 799, originalPrice: 999, imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', rating: 4.5, variants: [{ label: 'Default', stock: 25, sku: 'WGB-001' }] },
  { name: 'Shaadi Favor Pouches (Set of 25)', slug: 'shaadi-favor-pouches', categorySlug: 'wedding-packing', basePrice: 899, originalPrice: 1199, imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', rating: 5, variants: [{ label: 'Default', stock: 25, sku: 'SFP-001' }] },
  { name: 'Handmade Bandhanwar Door Hanging', slug: 'handmade-bandhanwar-door-hanging', categorySlug: 'festive-decoration', basePrice: 599, originalPrice: 799, imageUrl: 'https://images.unsplash.com/photo-1752578856345-b947695803bd', rating: 4.5, variants: [{ label: 'Default', stock: 30, sku: 'BDH-001' }] },
  { name: 'Traditional Wall Hanging Set', slug: 'traditional-wall-hanging-set', categorySlug: 'festive-decoration', basePrice: 899, originalPrice: 1199, imageUrl: 'https://images.unsplash.com/photo-1762173886363-de541417e48e', rating: 5, variants: [{ label: 'Default', stock: 20, sku: 'TWH-001' }] },
  { name: 'Diwali Special Diyas Set (12 pieces)', slug: 'diwali-special-diyas-set', categorySlug: 'diwali-decor', basePrice: 499, originalPrice: 699, imageUrl: 'https://images.unsplash.com/photo-1510658018161-abde712032db', rating: 5, variants: [{ label: 'Default', stock: 40, sku: 'DSD-001' }] },
  { name: 'Diwali Decorative Lights & Lanterns', slug: 'diwali-decorative-lights-lanterns', categorySlug: 'diwali-decor', basePrice: 799, originalPrice: 999, imageUrl: 'https://images.unsplash.com/photo-1666244453401-43a8c15b5640', rating: 4.5, variants: [{ label: 'Default', stock: 30, sku: 'DDL-001' }] },
  { name: 'Diwali Rangoli Stencils & Colors Set', slug: 'diwali-rangoli-stencils-colors-set', categorySlug: 'diwali-decor', basePrice: 399, originalPrice: 549, imageUrl: 'https://images.unsplash.com/photo-1635192592106-77a5aacbe1a3', rating: 4, variants: [{ label: 'Default', stock: 35, sku: 'DRS-001' }] },
  { name: 'Kanha Ji Dress', slug: 'kanha-ji-dress', categorySlug: 'kanha-dresses', basePrice: 599, originalPrice: 799, imageUrl: 'https://images.unsplash.com/photo-1653794354513-4b6d139408f0', rating: 5, variants: [
    { label: 'Small', stock: 15, sku: 'KJD-S' },
    { label: 'Medium', price: 799, stock: 15, sku: 'KJD-M' },
    { label: 'Large', price: 999, stock: 10, sku: 'KJD-L' },
  ] },
  { name: 'Birthday Gift Hamper with Personalization', slug: 'birthday-gift-hamper', categorySlug: 'customized-gifting', basePrice: 1299, originalPrice: 1599, imageUrl: 'https://images.unsplash.com/photo-1674620213535-9b2a2553ef40', rating: 4.5, variants: [{ label: 'Default', stock: 15, sku: 'BGH-001' }] },
  { name: 'Custom Name Gift Box', slug: 'custom-name-gift-box', categorySlug: 'customized-gifting', basePrice: 899, imageUrl: 'https://images.unsplash.com/photo-1759887243702-903dc6661a90', rating: 4, variants: [{ label: 'Default', stock: 20, sku: 'CNG-001' }] },
  { name: 'Festive Toran (Door Decoration)', slug: 'festive-toran', categorySlug: 'festive-decoration', basePrice: 449, originalPrice: 599, imageUrl: 'https://images.unsplash.com/photo-1752578856345-b947695803bd', rating: 4.5, variants: [{ label: 'Default', stock: 25, sku: 'FTD-001' }] },
  { name: 'Mehndi Ceremony Return Gifts (Set of 50)', slug: 'mehndi-ceremony-return-gifts', categorySlug: 'wedding-packing', basePrice: 1499, originalPrice: 1999, imageUrl: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125', rating: 4.5, variants: [{ label: 'Default', stock: 0, sku: 'MCR-001' }] },
  { name: 'Anniversary Gift Set with Custom Message', slug: 'anniversary-gift-set', categorySlug: 'customized-gifting', basePrice: 1599, imageUrl: 'https://images.unsplash.com/photo-1759887243702-903dc6661a90', rating: 5, variants: [{ label: 'Default', stock: 10, sku: 'AGS-001' }] },
  { name: 'Diwali Decor Combo Pack', slug: 'diwali-decor-combo-pack', categorySlug: 'diwali-decor', basePrice: 1199, originalPrice: 1599, imageUrl: 'https://images.unsplash.com/photo-1759397576098-c1f33b34088f', rating: 5, variants: [{ label: 'Default', stock: 20, sku: 'DDC-001' }] },
];

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  for (const cat of categoriesData) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
  }

  for (const p of productsData) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.categorySlug } });
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.name,
        categoryId: category.id,
        basePrice: p.basePrice,
        originalPrice: p.originalPrice,
        imageUrl: p.imageUrl,
        rating: p.rating,
        variants: { create: p.variants },
      },
    });
  }

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, flatShippingFee: 50, freeShippingThreshold: 999 },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 10) },
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .then(() => {
      console.log('Seed complete');
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

Note the reduced (14) product count here folds the three Kanha Ji dress sizes into one product with three variants, per the approved variants decision — this replaces the 16 flat mock entries with 14 products.

- [ ] **Step 2: Write the failing test — `server/tests/seed.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';

describe('seedDatabase', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
  });

  it('creates categories, products with variants, settings, and an admin user', async () => {
    await seedDatabase(prisma);

    expect(await prisma.category.count()).toBe(5);
    expect(await prisma.product.count()).toBe(14);

    const kanha = await prisma.product.findUniqueOrThrow({
      where: { slug: 'kanha-ji-dress' },
      include: { variants: true },
    });
    expect(kanha.variants).toHaveLength(3);

    const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.flatShippingFee).toBe(50);

    expect(await prisma.adminUser.count()).toBe(1);
  });

  it('is idempotent when run twice', async () => {
    await seedDatabase(prisma);
    await seedDatabase(prisma);
    expect(await prisma.product.count()).toBe(14);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run tests/seed.test.ts`
Expected: FAIL — `prisma/seed.ts` does not exist yet (only relevant if you write the test before Step 1; if done in order, skip straight to Step 4).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/seed.ts server/tests/seed.test.ts
git commit -m "feat(server): add database seed script for products, categories, admin user"
```

---

## Task 4: `GET /api/categories`

**Files:**
- Create: `server/src/routes/categories.routes.ts`
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/categories.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db` (Task 2).
- Produces: `categoriesRouter` (named export of `server/src/routes/categories.routes.ts`) mounted at `/api/categories`.

- [ ] **Step 1: Write the failing test — `server/tests/categories.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';

describe('GET /api/categories', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
    await seedDatabase(prisma);
  });

  it('returns all categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0]).toHaveProperty('slug');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/categories.test.ts`
Expected: FAIL with a 404 (route not mounted yet).

- [ ] **Step 3: Create `server/src/routes/categories.routes.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../db';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json(categories);
});
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

Add near the top with the other imports:
```ts
import { categoriesRouter } from './routes/categories.routes';
```

Add after the `/api/health` route:
```ts
app.use('/api/categories', categoriesRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/categories.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/categories.routes.ts server/src/app.ts server/tests/categories.test.ts
git commit -m "feat(server): add GET /api/categories"
```

---

## Task 5: `GET /api/products` (list + category filter)

**Files:**
- Create: `server/src/routes/products.routes.ts`
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/products.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db` (Task 2), `seedDatabase` from `../prisma/seed` (Task 3, test-only).
- Produces: `productsRouter` (named export) mounted at `/api/products`. Later tasks (Task 6) add more routes to this same router.

- [ ] **Step 1: Write the failing test — `server/tests/products.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';

describe('GET /api/products', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
    await seedDatabase(prisma);
  });

  it('returns all active products with their variants', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(14);
    expect(res.body[0]).toHaveProperty('variants');
  });

  it('filters by category slug', async () => {
    const res = await request(app).get('/api/products?category=diwali-decor');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    for (const product of res.body) {
      expect(product.category.slug).toBe('diwali-decor');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/products.test.ts`
Expected: FAIL (404, route doesn't exist).

- [ ] **Step 3: Create `server/src/routes/products.routes.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../db';

export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: { variants: true, category: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
});
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

```ts
import { productsRouter } from './routes/products.routes';
// ...
app.use('/api/products', productsRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/products.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/products.routes.ts server/src/app.ts server/tests/products.test.ts
git commit -m "feat(server): add GET /api/products with category filter"
```

---

## Task 6: `GET /api/products/:slug`

**Files:**
- Modify: `server/src/routes/products.routes.ts`
- Test: `server/tests/products.test.ts` (add cases)

**Interfaces:**
- Consumes: `productsRouter` from Task 5 (adds a route to the same router).

- [ ] **Step 1: Write the failing tests — append to `server/tests/products.test.ts`**

```ts
describe('GET /api/products/:slug', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
    await seedDatabase(prisma);
  });

  it('returns a single product by slug', async () => {
    const res = await request(app).get('/api/products/kanha-ji-dress');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Kanha Ji Dress');
    expect(res.body.variants).toHaveLength(3);
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/products/does-not-exist');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/products.test.ts`
Expected: FAIL on the two new cases (404 for the valid slug too, since no route matches yet).

- [ ] **Step 3: Add the route in `server/src/routes/products.routes.ts`**

```ts
productsRouter.get('/:slug', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { variants: true, category: true },
  });
  if (!product || !product.isActive) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/products.test.ts`
Expected: PASS (all cases in the file).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/products.routes.ts server/tests/products.test.ts
git commit -m "feat(server): add GET /api/products/:slug"
```

---

## Task 7: Order support services — pricing & order number generation

**Files:**
- Create: `server/src/services/pricing.ts`
- Create: `server/src/services/orderNumber.ts`
- Test: `server/tests/services/pricing.test.ts`
- Test: `server/tests/services/orderNumber.test.ts`

**Interfaces:**
- Produces: `resolveUnitPrice(variant)`, `validateStock(items, variants)`, `computeOrderTotals(items, variants, settings)`, `OrderValidationError` (all named exports of `services/pricing.ts`) — consumed by Task 9's `POST /api/orders`.
- Produces: `generateOrderNumber(now?)` (named export of `services/orderNumber.ts`) — consumed by Task 9.
- These are pure functions with no DB or network access — no Docker/Postgres dependency for this task's tests.

- [ ] **Step 1: Write the failing test — `server/tests/services/pricing.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { resolveUnitPrice, validateStock, computeOrderTotals, OrderValidationError } from '../../src/services/pricing';

const variants = [
  { id: 'v1', price: null, stock: 5, product: { basePrice: 500 } },
  { id: 'v2', price: 800, stock: 2, product: { basePrice: 500 } },
];

describe('resolveUnitPrice', () => {
  it('uses the variant price when set', () => {
    expect(resolveUnitPrice(variants[1])).toBe(800);
  });

  it('falls back to the product base price when variant price is null', () => {
    expect(resolveUnitPrice(variants[0])).toBe(500);
  });
});

describe('validateStock', () => {
  it('passes when stock is sufficient', () => {
    expect(() => validateStock([{ variantId: 'v1', quantity: 3 }], variants)).not.toThrow();
  });

  it('throws OrderValidationError when stock is insufficient', () => {
    expect(() => validateStock([{ variantId: 'v2', quantity: 5 }], variants)).toThrow(OrderValidationError);
  });

  it('throws OrderValidationError for an unknown variant', () => {
    expect(() => validateStock([{ variantId: 'missing', quantity: 1 }], variants)).toThrow(OrderValidationError);
  });
});

describe('computeOrderTotals', () => {
  const settings = { flatShippingFee: 50, freeShippingThreshold: 999 };

  it('adds flat shipping below the free-shipping threshold', () => {
    const totals = computeOrderTotals([{ variantId: 'v1', quantity: 1 }], variants, settings);
    expect(totals).toEqual({ subtotal: 500, shippingFee: 50, total: 550 });
  });

  it('waives shipping at or above the free-shipping threshold', () => {
    const totals = computeOrderTotals([{ variantId: 'v2', quantity: 2 }], variants, settings);
    expect(totals).toEqual({ subtotal: 1600, shippingFee: 0, total: 1600 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/services/pricing.test.ts`
Expected: FAIL — `services/pricing.ts` doesn't exist.

- [ ] **Step 3: Create `server/src/services/pricing.ts`**

```ts
export class OrderValidationError extends Error {}

export interface CartItemInput {
  variantId: string;
  quantity: number;
}

export interface VariantForPricing {
  id: string;
  price: number | null;
  stock: number;
  product: { basePrice: number };
}

export function resolveUnitPrice(variant: VariantForPricing): number {
  return variant.price ?? variant.product.basePrice;
}

export function validateStock(items: CartItemInput[], variants: VariantForPricing[]): void {
  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) {
      throw new OrderValidationError(`Item ${item.variantId} is no longer available`);
    }
    if (variant.stock < item.quantity) {
      throw new OrderValidationError(`Insufficient stock for item ${item.variantId}`);
    }
  }
}

export interface ShippingConfig {
  flatShippingFee: number;
  freeShippingThreshold: number;
}

export function computeOrderTotals(
  items: CartItemInput[],
  variants: VariantForPricing[],
  settings: ShippingConfig
): { subtotal: number; shippingFee: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    const variant = variants.find((v) => v.id === item.variantId)!;
    return sum + resolveUnitPrice(variant) * item.quantity;
  }, 0);
  const shippingFee = subtotal >= settings.freeShippingThreshold ? 0 : settings.flatShippingFee;
  return { subtotal, shippingFee, total: subtotal + shippingFee };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/services/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test — `server/tests/services/orderNumber.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateOrderNumber } from '../../src/services/orderNumber';

describe('generateOrderNumber', () => {
  it('starts with ORD-', () => {
    expect(generateOrderNumber()).toMatch(/^ORD-[A-Z0-9]+$/);
  });

  it('generates different numbers on successive calls', () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && npx vitest run tests/services/orderNumber.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Create `server/src/services/orderNumber.ts`**

```ts
export function generateOrderNumber(now: Date = new Date()): string {
  const timestampPart = now.getTime().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${timestampPart}${randomPart}`;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && npx vitest run tests/services/orderNumber.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/services/pricing.ts server/src/services/orderNumber.ts server/tests/services/pricing.test.ts server/tests/services/orderNumber.test.ts
git commit -m "feat(server): add pricing and order number pure services"
```

---

## Task 8: Razorpay service wrapper

**Files:**
- Create: `server/src/services/razorpay.ts`
- Test: `server/tests/services/razorpay.test.ts`

**Interfaces:**
- Produces: `createRazorpayOrder(amountInRupees, receipt): Promise<{ id: string }>` and `verifyWebhookSignature(rawBody, signature, secret): boolean` (named exports of `services/razorpay.ts`) — consumed by Task 9 (`createRazorpayOrder`) and Task 11 (`verifyWebhookSignature`).

- [ ] **Step 1: Write the failing test — `server/tests/services/razorpay.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const ordersCreateMock = vi.fn();

vi.mock('razorpay', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      orders: { create: ordersCreateMock },
    })),
  };
});

import { createRazorpayOrder, verifyWebhookSignature } from '../../src/services/razorpay';

describe('createRazorpayOrder', () => {
  beforeEach(() => {
    ordersCreateMock.mockReset();
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  });

  it('converts rupees to paise when calling Razorpay', async () => {
    ordersCreateMock.mockResolvedValue({ id: 'order_abc123' });

    const result = await createRazorpayOrder(550, 'ORD-TEST1');

    expect(ordersCreateMock).toHaveBeenCalledWith({
      amount: 55000,
      currency: 'INR',
      receipt: 'ORD-TEST1',
    });
    expect(result).toEqual({ id: 'order_abc123' });
  });
});

describe('verifyWebhookSignature', () => {
  it('returns true for a matching signature', () => {
    const secret = 'whsec_test';
    const body = '{"event":"payment.captured"}';
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('returns false for a mismatched signature', () => {
    expect(verifyWebhookSignature('{"event":"x"}', 'bad-signature', 'whsec_test')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/services/razorpay.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `server/src/services/razorpay.ts`**

```ts
import Razorpay from 'razorpay';
import crypto from 'crypto';

let client: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

export async function createRazorpayOrder(amountInRupees: number, receipt: string): Promise<{ id: string }> {
  const order = await getRazorpayClient().orders.create({
    amount: amountInRupees * 100,
    currency: 'INR',
    receipt,
  });
  return { id: order.id };
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/services/razorpay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/razorpay.ts server/tests/services/razorpay.test.ts
git commit -m "feat(server): add Razorpay order creation and webhook signature verification"
```

---

## Task 9: `POST /api/orders`

**Files:**
- Modify: `server/src/routes/orders.routes.ts` (create)
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/orders.test.ts` (create)

**Interfaces:**
- Consumes: `prisma` (Task 2), `validateStock`/`computeOrderTotals`/`resolveUnitPrice`/`OrderValidationError` from `../services/pricing` (Task 7), `generateOrderNumber` from `../services/orderNumber` (Task 7), `createRazorpayOrder` from `../services/razorpay` (Task 8).
- Produces: `ordersRouter` (named export) mounted at `/api/orders`. Task 12 adds `GET /:orderNumber` to this same router.
- Mocks `createRazorpayOrder` in tests via `vi.mock('../src/services/razorpay')` so no real Razorpay network call happens.

- [ ] **Step 1: Write the failing test — `server/tests/orders.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';

vi.mock('../src/services/razorpay', () => ({
  createRazorpayOrder: vi.fn().mockResolvedValue({ id: 'order_mocked123' }),
  verifyWebhookSignature: vi.fn(),
}));

import app from '../src/app';

async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.storeSettings.deleteMany();
}

describe('POST /api/orders', () => {
  beforeEach(async () => {
    await resetDb();
    await seedDatabase(prisma);
  });

  it('creates an order and returns Razorpay order details', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });

    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        customerEmail: 'customer@example.com',
        addressStreet: '123 Main St',
        addressCity: 'Jaipur',
        addressState: 'Rajasthan',
        addressPincode: '302001',
        items: [{ variantId: variant.id, quantity: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.razorpayOrderId).toBe('order_mocked123');
    expect(res.body.amount).toBe(499 * 2 + 50);

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.body.orderNumber } });
    expect(order.status).toBe('PENDING');
    expect(order.razorpayOrderId).toBe('order_mocked123');
  });

  it('rejects an order when stock is insufficient', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'MCR-001' } });

    const res = await request(app)
      .post('/api/orders')
      .send({
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        customerEmail: 'customer@example.com',
        addressStreet: '123 Main St',
        addressCity: 'Jaipur',
        addressState: 'Rajasthan',
        addressPincode: '302001',
        items: [{ variantId: variant.id, quantity: 1 }],
      });

    expect(res.status).toBe(409);
  });

  it('rejects an invalid payload', async () => {
    const res = await request(app).post('/api/orders').send({ items: [] });
    expect(res.status).toBe(400);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/orders.test.ts`
Expected: FAIL — no `orders.routes.ts` yet.

- [ ] **Step 3: Create `server/src/routes/orders.routes.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { validateStock, computeOrderTotals, resolveUnitPrice, OrderValidationError } from '../services/pricing';
import { generateOrderNumber } from '../services/orderNumber';
import { createRazorpayOrder } from '../services/razorpay';

export const ordersRouter = Router();

const checkoutSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(6),
  customerEmail: z.string().email(),
  addressStreet: z.string().min(1),
  addressCity: z.string().min(1),
  addressState: z.string().min(1),
  addressPincode: z.string().min(1),
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().positive() })).min(1),
});

ordersRouter.post('/', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order payload', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { id: { in: data.items.map((i) => i.variantId) } },
        include: { product: true },
      });

      validateStock(data.items, variants);

      const settings = (await tx.storeSettings.findUnique({ where: { id: 1 } })) ?? {
        flatShippingFee: 50,
        freeShippingThreshold: 999,
      };
      const totals = computeOrderTotals(data.items, variants, settings);
      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          addressStreet: data.addressStreet,
          addressCity: data.addressCity,
          addressState: data.addressState,
          addressPincode: data.addressPincode,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          total: totals.total,
          items: {
            create: data.items.map((item) => {
              const variant = variants.find((v) => v.id === item.variantId)!;
              return {
                productVariantId: variant.id,
                productNameSnapshot: variant.product.name,
                variantLabelSnapshot: variant.label,
                unitPrice: resolveUnitPrice(variant),
                quantity: item.quantity,
              };
            }),
          },
        },
      });

      return { order, totals };
    });

    const razorpayOrder = await createRazorpayOrder(created.totals.total, created.order.orderNumber);
    await prisma.order.update({
      where: { id: created.order.id },
      data: { razorpayOrderId: razorpayOrder.id },
    });

    res.status(201).json({
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: created.totals.total,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

```ts
import { ordersRouter } from './routes/orders.routes';
// ...
app.use('/api/orders', ordersRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/orders.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/orders.routes.ts server/src/app.ts server/tests/orders.test.ts
git commit -m "feat(server): add POST /api/orders with stock validation and Razorpay order creation"
```

---

## Task 10: Email service wrapper

**Files:**
- Create: `server/src/services/email.ts`
- Test: `server/tests/services/email.test.ts`

**Interfaces:**
- Produces: `OrderEmailData` interface, `sendOrderConfirmationEmail(data)`, `sendAdminNewOrderEmail(data)` (named exports of `services/email.ts`) — consumed by Task 11's webhook handler.

- [ ] **Step 1: Write the failing test — `server/tests/services/email.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({ id: 'email_123' });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendOrderConfirmationEmail, sendAdminNewOrderEmail, OrderEmailData } from '../../src/services/email';

const sampleOrder: OrderEmailData = {
  orderNumber: 'ORD-TEST1',
  customerName: 'Test Customer',
  customerEmail: 'customer@example.com',
  total: 1050,
  items: [{ productNameSnapshot: 'Diwali Diyas Set', variantLabelSnapshot: 'Default', quantity: 2, unitPrice: 499 }],
};

describe('email service', () => {
  beforeEach(() => {
    sendMock.mockClear();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.STORE_EMAIL_FROM = 'orders@example.com';
    process.env.STORE_OWNER_EMAIL = 'owner@example.com';
  });

  it('sends a confirmation email to the customer', async () => {
    await sendOrderConfirmationEmail(sampleOrder);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'customer@example.com', subject: expect.stringContaining('ORD-TEST1') })
    );
  });

  it('sends an alert email to the store owner', async () => {
    await sendAdminNewOrderEmail(sampleOrder);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com', subject: expect.stringContaining('ORD-TEST1') })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/services/email.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `server/src/services/email.ts`**

```ts
import { Resend } from 'resend';

let client: Resend | null = null;

function getResendClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY!);
  }
  return client;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  items: { productNameSnapshot: string; variantLabelSnapshot: string; quantity: number; unitPrice: number }[];
}

function renderOrderEmailHtml(data: OrderEmailData): string {
  const rows = data.items
    .map(
      (item) =>
        `<tr><td>${item.productNameSnapshot} (${item.variantLabelSnapshot})</td><td>${item.quantity}</td><td>Rs. ${item.unitPrice}</td></tr>`
    )
    .join('');
  return `<h2>Order ${data.orderNumber}</h2><p>${data.customerName}</p><table>${rows}</table><p>Total: Rs. ${data.total}</p>`;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  await getResendClient().emails.send({
    from: process.env.STORE_EMAIL_FROM!,
    to: data.customerEmail,
    subject: `Order Confirmed - ${data.orderNumber}`,
    html: renderOrderEmailHtml(data),
  });
}

export async function sendAdminNewOrderEmail(data: OrderEmailData): Promise<void> {
  await getResendClient().emails.send({
    from: process.env.STORE_EMAIL_FROM!,
    to: process.env.STORE_OWNER_EMAIL!,
    subject: `New Order - ${data.orderNumber}`,
    html: renderOrderEmailHtml(data),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/services/email.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/email.ts server/tests/services/email.test.ts
git commit -m "feat(server): add order confirmation and admin alert email service"
```

---

## Task 11: `POST /api/orders/razorpay-webhook`

**Files:**
- Create: `server/src/routes/webhook.routes.ts`
- Modify: `server/src/app.ts` — mount with raw-body parsing
- Test: `server/tests/webhook.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `verifyWebhookSignature` from `../services/razorpay` (Task 8), `sendOrderConfirmationEmail`/`sendAdminNewOrderEmail` from `../services/email` (Task 10).
- Produces: `handleRazorpayWebhook` (named export, an Express `RequestHandler`) mounted directly in `app.ts` at `POST /api/orders/razorpay-webhook`, ahead of the JSON body parser so the raw body is available for signature verification.

- [ ] **Step 1: Write the failing test — `server/tests/webhook.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';

const sendOrderConfirmationEmailMock = vi.fn().mockResolvedValue(undefined);
const sendAdminNewOrderEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/services/email', () => ({
  sendOrderConfirmationEmail: sendOrderConfirmationEmailMock,
  sendAdminNewOrderEmail: sendAdminNewOrderEmailMock,
}));

import app from '../src/app';

async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.storeSettings.deleteMany();
}

function sign(body: string): string {
  return crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest('hex');
}

describe('POST /api/orders/razorpay-webhook', () => {
  beforeEach(async () => {
    sendOrderConfirmationEmailMock.mockClear();
    sendAdminNewOrderEmailMock.mockClear();
    await resetDb();
    await seedDatabase(prisma);
  });

  it('marks the order paid, decrements stock, and sends emails on a valid signature', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-WEBHOOK1',
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        customerEmail: 'customer@example.com',
        addressStreet: 'x',
        addressCity: 'x',
        addressState: 'x',
        addressPincode: 'x',
        subtotal: 998,
        shippingFee: 50,
        total: 1048,
        razorpayOrderId: 'order_webhook_test',
        items: {
          create: [
            {
              productVariantId: variant.id,
              productNameSnapshot: 'Diwali Special Diyas Set',
              variantLabelSnapshot: 'Default',
              unitPrice: 499,
              quantity: 2,
            },
          ],
        },
      },
    });

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test123', order_id: 'order_webhook_test' } } },
    });

    const res = await request(app)
      .post('/api/orders/razorpay-webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(payload))
      .send(payload);

    expect(res.status).toBe(200);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('PAID');
    expect(updated.razorpayPaymentId).toBe('pay_test123');

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updatedVariant.stock).toBe(38); // seeded at 40, minus 2

    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendAdminNewOrderEmailMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid signature without changing order state', async () => {
    const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'x', order_id: 'y' } } } });

    const res = await request(app)
      .post('/api/orders/razorpay-webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-a-valid-signature')
      .send(payload);

    expect(res.status).toBe(400);
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/webhook.test.ts`
Expected: FAIL — route not mounted yet.

- [ ] **Step 3: Create `server/src/routes/webhook.routes.ts`**

```ts
import { Request, Response } from 'express';
import { prisma } from '../db';
import { verifyWebhookSignature } from '../services/razorpay';
import { sendOrderConfirmationEmail, sendAdminNewOrderEmail } from '../services/email';

export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = (req.body as Buffer).toString();

  if (typeof signature !== 'string' || !verifyWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET!)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const payload = JSON.parse(rawBody);
  if (payload.event !== 'payment.captured') {
    res.status(200).json({ received: true });
    return;
  }

  const razorpayOrderId = payload.payload.payment.entity.order_id;
  const razorpayPaymentId = payload.payload.payment.entity.id;

  const order = await prisma.order.findUnique({ where: { razorpayOrderId }, include: { items: true } });
  if (!order || order.status !== 'PENDING') {
    res.status(200).json({ received: true });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID', razorpayPaymentId, paidAt: new Date() },
    });
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { decrement: item.quantity } },
      });
    }
  });

  const emailData = {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    total: order.total,
    items: order.items,
  };
  await sendOrderConfirmationEmail(emailData);
  await sendAdminNewOrderEmail(emailData);

  res.status(200).json({ received: true });
}
```

- [ ] **Step 4: Mount it in `server/src/app.ts` with raw-body parsing, before `express.json()`**

The webhook route must be registered before the `express.json()` middleware so the raw bytes are available for signature verification. Reorder `app.ts` so it reads:

```ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { handleRazorpayWebhook } from './routes/webhook.routes';
import { categoriesRouter } from './routes/categories.routes';
import { productsRouter } from './routes/products.routes';
import { ordersRouter } from './routes/orders.routes';

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());

app.post('/api/orders/razorpay-webhook', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

export default app;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/webhook.test.ts`
Expected: PASS.

- [ ] **Step 6: Re-run the full suite to confirm the `app.ts` reorder didn't break earlier routes**

Run: `cd server && npx vitest run`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/webhook.routes.ts server/src/app.ts server/tests/webhook.test.ts
git commit -m "feat(server): add signature-verified Razorpay webhook handler"
```

---

## Task 12: `GET /api/orders/:orderNumber`

**Files:**
- Modify: `server/src/routes/orders.routes.ts`
- Test: `server/tests/orders.test.ts` (add cases)

**Interfaces:**
- Consumes: `ordersRouter` from Task 9 (adds a route to the same router).

- [ ] **Step 1: Write the failing test — append to `server/tests/orders.test.ts`**

```ts
describe('GET /api/orders/:orderNumber', () => {
  beforeEach(async () => {
    await resetDb();
    await seedDatabase(prisma);
  });

  it('returns the order and its items', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-LOOKUP1',
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        customerEmail: 'customer@example.com',
        addressStreet: 'x',
        addressCity: 'x',
        addressState: 'x',
        addressPincode: 'x',
        subtotal: 499,
        shippingFee: 50,
        total: 549,
        items: {
          create: [
            {
              productVariantId: variant.id,
              productNameSnapshot: 'Diwali Special Diyas Set',
              variantLabelSnapshot: 'Default',
              unitPrice: 499,
              quantity: 1,
            },
          ],
        },
      },
    });

    const res = await request(app).get(`/api/orders/${order.orderNumber}`);
    expect(res.status).toBe(200);
    expect(res.body.orderNumber).toBe('ORD-LOOKUP1');
    expect(res.body.items).toHaveLength(1);
  });

  it('returns 404 for an unknown order number', async () => {
    const res = await request(app).get('/api/orders/ORD-DOESNOTEXIST');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/orders.test.ts`
Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Add the route in `server/src/routes/orders.routes.ts`**

```ts
ordersRouter.get('/:orderNumber', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber: req.params.orderNumber },
    include: { items: true },
  });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/orders.routes.ts server/tests/orders.test.ts
git commit -m "feat(server): add GET /api/orders/:orderNumber lookup"
```

---

## Task 13: Admin auth (login + middleware)

**Files:**
- Create: `server/src/middleware/adminAuth.ts`
- Create: `server/src/routes/admin/auth.routes.ts`
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/admin/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `AdminUser` model (Task 2).
- Produces: `adminAuthRouter` mounted at `/api/admin`, and `requireAdminAuth` (named export of `middleware/adminAuth.ts`, an Express middleware) — every later admin route task (14-17) applies this middleware.

- [ ] **Step 1: Write the failing test — `server/tests/admin/auth.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';

describe('POST /api/admin/login', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
    await prisma.adminUser.create({
      data: { email: 'admin@example.com', passwordHash: await bcrypt.hash('correct-password', 10) },
    });
  });

  it('sets an admin_session cookie on correct credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/admin_session=/);
  });

  it('rejects incorrect credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/admin/auth.test.ts`
Expected: FAIL — route not mounted.

- [ ] **Step 3: Create `server/src/middleware/adminAuth.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminRequest extends Request {
  adminId?: string;
}

export function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_session;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { adminId: string };
    req.adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}
```

- [ ] **Step 4: Create `server/src/routes/admin/auth.routes.ts`**

```ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db';

export const adminAuthRouter = Router();

adminAuthRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ success: true });
});

adminAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie('admin_session');
  res.json({ success: true });
});
```

- [ ] **Step 5: Mount it in `server/src/app.ts`**

```ts
import { adminAuthRouter } from './routes/admin/auth.routes';
// ...
app.use('/api/admin', adminAuthRouter);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx vitest run tests/admin/auth.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/middleware/adminAuth.ts server/src/routes/admin/auth.routes.ts server/src/app.ts server/tests/admin/auth.test.ts
git commit -m "feat(server): add admin login/logout and session middleware"
```

---

## Task 14: Admin products & variants CRUD

**Files:**
- Create: `server/src/routes/admin/products.routes.ts`
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/admin/products.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `requireAdminAuth` from `../../middleware/adminAuth` (Task 13).
- Produces: `adminProductsRouter` mounted at `/api/admin/products`.

- [ ] **Step 1: Write the failing test — `server/tests/admin/products.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { seedDatabase } from '../../prisma/seed';

async function loginAsAdmin(agent: ReturnType<typeof request.agent>) {
  await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', passwordHash: await bcrypt.hash('pw', 10) },
  });
  await agent.post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
}

describe('admin products routes', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
    await seedDatabase(prisma);
  });

  it('rejects requests without an admin session', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.status).toBe(401);
  });

  it('lists all products including inactive ones, for a logged-in admin', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const product = await prisma.product.findFirstOrThrow();
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

    const res = await agent.get('/api/admin/products');
    expect(res.status).toBe(200);
    expect(res.body.some((p: any) => p.id === product.id)).toBe(true);
  });

  it('creates a product with variants', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const category = await prisma.category.findFirstOrThrow();

    const res = await agent.post('/api/admin/products').send({
      name: 'New Test Product',
      slug: 'new-test-product',
      description: 'A test product',
      categoryId: category.id,
      basePrice: 250,
      imageUrl: 'https://example.com/img.jpg',
      variants: [{ label: 'Default', stock: 10, sku: 'NTP-001' }],
    });

    expect(res.status).toBe(201);
    const created = await prisma.product.findUniqueOrThrow({ where: { slug: 'new-test-product' }, include: { variants: true } });
    expect(created.variants).toHaveLength(1);
  });

  it('updates a product and deactivates it via PUT', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const product = await prisma.product.findFirstOrThrow();

    const res = await agent.put(`/api/admin/products/${product.id}`).send({ basePrice: 1234, isActive: false });
    expect(res.status).toBe(200);

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.basePrice).toBe(1234);
    expect(updated.isActive).toBe(false);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/admin/products.test.ts`
Expected: FAIL — route not mounted.

- [ ] **Step 3: Create `server/src/routes/admin/products.routes.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';

export const adminProductsRouter = Router();
adminProductsRouter.use(requireAdminAuth);

adminProductsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { variants: true, category: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
});

const variantSchema = z.object({
  label: z.string().min(1),
  price: z.number().int().positive().optional(),
  stock: z.number().int().min(0),
  sku: z.string().min(1),
});

const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().min(1),
  basePrice: z.number().int().positive(),
  originalPrice: z.number().int().positive().optional(),
  imageUrl: z.string().min(1),
  variants: z.array(variantSchema).min(1),
});

adminProductsRouter.post('/', async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product payload', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      categoryId: data.categoryId,
      basePrice: data.basePrice,
      originalPrice: data.originalPrice,
      imageUrl: data.imageUrl,
      variants: { create: data.variants },
    },
    include: { variants: true },
  });

  res.status(201).json(product);
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  basePrice: z.number().int().positive().optional(),
  originalPrice: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

adminProductsRouter.put('/:id', async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product payload', details: parsed.error.flatten() });
  }

  const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(product);
});

const upsertVariantSchema = variantSchema.extend({ id: z.string().optional() });

adminProductsRouter.put('/:id/variants/:variantId', async (req, res) => {
  const parsed = upsertVariantSchema.safeParse({ ...req.body, id: req.params.variantId });
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid variant payload', details: parsed.error.flatten() });
  }

  const variant = await prisma.productVariant.update({
    where: { id: req.params.variantId },
    data: {
      label: parsed.data.label,
      price: parsed.data.price,
      stock: parsed.data.stock,
      sku: parsed.data.sku,
    },
  });
  res.json(variant);
});
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

```ts
import { adminProductsRouter } from './routes/admin/products.routes';
// ...
app.use('/api/admin/products', adminProductsRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/admin/products.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin/products.routes.ts server/src/app.ts server/tests/admin/products.test.ts
git commit -m "feat(server): add admin product and variant management endpoints"
```

---

## Task 15: Admin categories CRUD

**Files:**
- Create: `server/src/routes/admin/categories.routes.ts`
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/admin/categories.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `requireAdminAuth` (Task 13).
- Produces: `adminCategoriesRouter` mounted at `/api/admin/categories`.

- [ ] **Step 1: Write the failing test — `server/tests/admin/categories.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';

async function loginAsAdmin(agent: ReturnType<typeof request.agent>) {
  await prisma.adminUser.create({ data: { email: 'admin@example.com', passwordHash: await bcrypt.hash('pw', 10) } });
  await agent.post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
}

describe('admin categories routes', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
  });

  it('creates, updates, and deletes a category', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);

    const createRes = await agent.post('/api/admin/categories').send({
      name: 'Test Category',
      slug: 'test-category',
      description: 'desc',
      imageUrl: 'https://example.com/img.jpg',
      icon: '🎉',
    });
    expect(createRes.status).toBe(201);
    const categoryId = createRes.body.id;

    const updateRes = await agent.put(`/api/admin/categories/${categoryId}`).send({ name: 'Renamed Category' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Renamed Category');

    const deleteRes = await agent.delete(`/api/admin/categories/${categoryId}`);
    expect(deleteRes.status).toBe(204);

    const found = await prisma.category.findUnique({ where: { id: categoryId } });
    expect(found).toBeNull();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/admin/categories.test.ts`
Expected: FAIL — route not mounted.

- [ ] **Step 3: Create `server/src/routes/admin/categories.routes.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';

export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(requireAdminAuth);

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().min(1),
  icon: z.string().min(1),
});

adminCategoriesRouter.post('/', async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid category payload', details: parsed.error.flatten() });
  }
  const category = await prisma.category.create({ data: parsed.data });
  res.status(201).json(category);
});

adminCategoriesRouter.put('/:id', async (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid category payload', details: parsed.error.flatten() });
  }
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(category);
});

adminCategoriesRouter.delete('/:id', async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

```ts
import { adminCategoriesRouter } from './routes/admin/categories.routes';
// ...
app.use('/api/admin/categories', adminCategoriesRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/admin/categories.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin/categories.routes.ts server/src/app.ts server/tests/admin/categories.test.ts
git commit -m "feat(server): add admin category management endpoints"
```

---

## Task 16: Admin orders list + status update

**Files:**
- Create: `server/src/routes/admin/orders.routes.ts`
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/admin/orders.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `requireAdminAuth` (Task 13).
- Produces: `adminOrdersRouter` mounted at `/api/admin/orders`.

- [ ] **Step 1: Write the failing test — `server/tests/admin/orders.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { seedDatabase } from '../../prisma/seed';

async function loginAsAdmin(agent: ReturnType<typeof request.agent>) {
  await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', passwordHash: await bcrypt.hash('pw', 10) },
  });
  await agent.post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
}

describe('admin orders routes', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
    await seedDatabase(prisma);
  });

  it('lists orders, filterable by status', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    await prisma.order.create({
      data: {
        orderNumber: 'ORD-A1', customerName: 'A', customerPhone: '1', customerEmail: 'a@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 499, shippingFee: 50, total: 549, status: 'PAID',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 1 }] },
      },
    });
    await prisma.order.create({
      data: {
        orderNumber: 'ORD-B1', customerName: 'B', customerPhone: '1', customerEmail: 'b@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 499, shippingFee: 50, total: 549, status: 'PENDING',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 1 }] },
      },
    });

    const res = await agent.get('/api/admin/orders?status=PAID');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].orderNumber).toBe('ORD-A1');
  });

  it('updates order status and restocks variants when cancelled', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const stockBefore = variant.stock;

    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-C1', customerName: 'C', customerPhone: '1', customerEmail: 'c@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 998, shippingFee: 0, total: 998, status: 'PAID',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 2 }] },
      },
    });

    const res = await agent.put(`/api/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updatedVariant.stock).toBe(stockBefore + 2);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/admin/orders.test.ts`
Expected: FAIL — route not mounted.

- [ ] **Step 3: Create `server/src/routes/admin/orders.routes.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdminAuth);

const orderStatusValues = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

adminOrdersRouter.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as (typeof orderStatusValues)[number] } : undefined,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

const statusUpdateSchema = z.object({ status: z.enum(orderStatusValues) });

adminOrdersRouter.put('/:id/status', async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status payload', details: parsed.error.flatten() });
  }

  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: parsed.data.status } });
    if (parsed.data.status === 'CANCELLED' && order.status !== 'CANCELLED') {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  });

  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  res.json(updated);
});
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

```ts
import { adminOrdersRouter } from './routes/admin/orders.routes';
// ...
app.use('/api/admin/orders', adminOrdersRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/admin/orders.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin/orders.routes.ts server/src/app.ts server/tests/admin/orders.test.ts
git commit -m "feat(server): add admin order listing and status update with restock on cancel"
```

---

## Task 17: Admin settings GET/PUT

**Files:**
- Create: `server/src/routes/admin/settings.routes.ts`
- Modify: `server/src/app.ts` — mount the router
- Test: `server/tests/admin/settings.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `requireAdminAuth` (Task 13).
- Produces: `adminSettingsRouter` mounted at `/api/admin/settings`.

- [ ] **Step 1: Write the failing test — `server/tests/admin/settings.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';

async function loginAsAdmin(agent: ReturnType<typeof request.agent>) {
  await prisma.adminUser.create({ data: { email: 'admin@example.com', passwordHash: await bcrypt.hash('pw', 10) } });
  await agent.post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
}

describe('admin settings routes', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
  });

  it('creates default settings on first GET', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);

    const res = await agent.get('/api/admin/settings');
    expect(res.status).toBe(200);
    expect(res.body.flatShippingFee).toBe(50);
    expect(res.body.freeShippingThreshold).toBe(999);
  });

  it('updates settings', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    await agent.get('/api/admin/settings');

    const res = await agent.put('/api/admin/settings').send({ flatShippingFee: 75, freeShippingThreshold: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.flatShippingFee).toBe(75);
    expect(res.body.freeShippingThreshold).toBe(1500);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/admin/settings.test.ts`
Expected: FAIL — route not mounted.

- [ ] **Step 3: Create `server/src/routes/admin/settings.routes.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdminAuth);

adminSettingsRouter.get('/', async (_req, res) => {
  const settings = await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, flatShippingFee: 50, freeShippingThreshold: 999 },
  });
  res.json(settings);
});

const settingsSchema = z.object({
  flatShippingFee: z.number().int().min(0),
  freeShippingThreshold: z.number().int().min(0),
});

adminSettingsRouter.put('/', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.flatten() });
  }
  const settings = await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });
  res.json(settings);
});
```

- [ ] **Step 4: Mount it in `server/src/app.ts`**

```ts
import { adminSettingsRouter } from './routes/admin/settings.routes';
// ...
app.use('/api/admin/settings', adminSettingsRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx vitest run tests/admin/settings.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin/settings.routes.ts server/src/app.ts server/tests/admin/settings.test.ts
git commit -m "feat(server): add admin shipping settings endpoints"
```

---

## Task 18: Abandoned order cleanup job

**Files:**
- Create: `server/src/jobs/cancelAbandonedOrders.ts`
- Test: `server/tests/jobs/cancelAbandonedOrders.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db` (Task 2).
- Produces: `cancelAbandonedOrders(olderThanHours?, now?): Promise<number>` (named export) — also runnable standalone as a script for a hosting-platform cron job (Task 19 documents the deployment wiring).

- [ ] **Step 1: Write the failing test — `server/tests/jobs/cancelAbandonedOrders.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { cancelAbandonedOrders } from '../../src/jobs/cancelAbandonedOrders';

async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
}

describe('cancelAbandonedOrders', () => {
  beforeEach(resetDb);

  it('cancels PENDING orders older than the cutoff', async () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const old = new Date('2026-09-14T00:00:00Z');
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-OLD1', customerName: 'x', customerPhone: 'x', customerEmail: 'x@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 100, shippingFee: 0, total: 100, status: 'PENDING', createdAt: old,
      },
    });

    const count = await cancelAbandonedOrders(24, now);
    expect(count).toBe(1);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('CANCELLED');
  });

  it('does not cancel recent PENDING orders', async () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-NEW1', customerName: 'x', customerPhone: 'x', customerEmail: 'x@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 100, shippingFee: 0, total: 100, status: 'PENDING', createdAt: now,
      },
    });

    const count = await cancelAbandonedOrders(24, now);
    expect(count).toBe(0);

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  it('does not touch PAID orders regardless of age', async () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const old = new Date('2026-09-01T00:00:00Z');
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-PAID1', customerName: 'x', customerPhone: 'x', customerEmail: 'x@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 100, shippingFee: 0, total: 100, status: 'PAID', createdAt: old,
      },
    });

    await cancelAbandonedOrders(24, now);
    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('PAID');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/jobs/cancelAbandonedOrders.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `server/src/jobs/cancelAbandonedOrders.ts`**

```ts
import { prisma } from '../db';

export async function cancelAbandonedOrders(olderThanHours = 24, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanHours * 60 * 60 * 1000);
  const result = await prisma.order.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { status: 'CANCELLED' },
  });
  return result.count;
}

if (require.main === module) {
  cancelAbandonedOrders()
    .then((count) => {
      console.log(`Cancelled ${count} abandoned orders`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/jobs/cancelAbandonedOrders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/jobs/cancelAbandonedOrders.ts server/tests/jobs/cancelAbandonedOrders.test.ts
git commit -m "feat(server): add abandoned order cleanup job"
```

---

## Task 19: CORS/env hardening + deployment README

**Files:**
- Modify: `server/src/app.ts` (CORS already added in Task 1/11 — verify final config)
- Create: `server/README.md`

**Interfaces:**
- No new interfaces — this task documents deployment and confirms configuration, it does not change route behavior for any earlier task's tests.

- [ ] **Step 1: Confirm `server/src/app.ts` CORS config reads `FRONTEND_ORIGIN` and allows credentials**

Verify the line added in Task 1/Task 11 is present and unchanged:
```ts
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
```
This is required so the frontend (running on a different origin) can send/receive the `admin_session` cookie.

- [ ] **Step 2: Run the full test suite one more time to confirm nothing regressed**

Run: `cd server && npx vitest run`
Expected: all tests across all files PASS.

- [ ] **Step 3: Create `server/README.md`**

```markdown
# Decor E-Commerce API

Express + TypeScript REST API for the storefront: products, categories,
guest checkout orders, Razorpay payments, and an admin panel backend.

## Local development

1. `docker compose up -d` — starts Postgres in Docker.
2. `docker compose exec postgres createdb -U ecommerce ecommerce_test` — one-time test DB creation.
3. Copy `.env.example` to `.env` and fill in real values (Razorpay test keys, Resend key).
4. Copy `.env.example` to `.env.test`, point `DATABASE_URL` at `ecommerce_test` instead of `ecommerce_dev`.
5. `npm install`
6. `npx prisma migrate dev` — applies migrations to the dev database.
7. `npm run prisma:seed` — loads sample categories/products and creates the admin user (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars, defaults to `admin@example.com` / `changeme123` — change this in production).
8. `npm run dev` — starts the API on `http://localhost:4000`.

## Testing

`npm test` runs the full Vitest suite against the `ecommerce_test` Postgres
database (via `.env.test`). Tests reset relevant tables in `beforeEach`
blocks, so they can be run repeatedly without manual cleanup.

## Deployment (free-tier target)

1. Create a Postgres database on Neon or Supabase (free tier) for production.
2. Deploy this `server/` directory to Render or Railway (free tier):
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Environment variables: same keys as `.env.example`, with real production
     values (`DATABASE_URL` from Neon/Supabase, live Razorpay keys, Resend key,
     `FRONTEND_ORIGIN` set to the deployed frontend's URL, `NODE_ENV=production`).
3. Run `npx prisma migrate deploy` against the production `DATABASE_URL` once
   (via the platform's shell/console, or a one-off deploy hook) before first use.
4. Run `npm run prisma:seed` once against production to load initial products
   and create the real admin user — then change the seeded admin password
   via a direct login + a future admin "change password" flow, or by
   re-seeding with different `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
5. In the Razorpay dashboard, configure the webhook URL to
   `https://<your-deployed-api>/api/orders/razorpay-webhook` and set the
   webhook secret to match `RAZORPAY_WEBHOOK_SECRET`.
6. Schedule `node dist/jobs/cancelAbandonedOrders.js` to run hourly using
   the hosting platform's cron/scheduled-job feature (Render Cron Jobs or
   Railway Cron), pointed at the production environment variables.
```

- [ ] **Step 4: Commit**

```bash
git add server/README.md
git commit -m "docs(server): add local development and deployment instructions"
```

---

## Definition of Done

- `cd server && npm test` passes with all tasks' tests green.
- `npm run build` compiles with no TypeScript errors.
- A manual smoke test works end-to-end: `npm run dev`, then `curl` (or Postman)
  through `GET /api/categories` → `GET /api/products` → `POST /api/orders`
  (with Razorpay test keys) → simulate a webhook call → `GET /api/orders/:orderNumber`
  shows `PAID`.
- Admin smoke test: `POST /api/admin/login` → `GET /api/admin/orders` → `PUT
  /api/admin/orders/:id/status` → `GET /api/admin/products` all work with the
  session cookie.

**Next plan:** a follow-on "frontend integration" plan wires the existing
React storefront to this API (replacing the hardcoded `products` array in
`App.tsx`), adds `CheckoutPage` (with the Razorpay Checkout widget) and
`OrderConfirmationPage`, and builds the `/admin` UI — write that plan only
after this one is fully implemented and passing.
