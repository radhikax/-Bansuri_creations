import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';
import { resetDb, loginAsAdmin } from './helpers';
import {
  CategorySchema,
  CheckoutResponseSchema,
  OrderSchema,
  ProductSchema,
  ProductVariantSchema,
  ProductWithVariantsAndCategorySchema,
  ProductWithVariantsSchema,
  ShippingConfigSchema,
  StoreSettingsSchema,
} from '../src/openapi/schemas';

vi.mock('../src/services/razorpay', () => ({
  createRazorpayOrder: vi.fn().mockResolvedValue({ id: 'order_mocked123' }),
  verifyWebhookSignature: vi.fn(),
}));
vi.mock('../src/services/revalidate', () => ({ revalidate: vi.fn() }));

import app from '../src/app';

// The OpenAPI response schemas are hand-written zod, and the web app's types are
// generated from them. Parsing real responses keeps the contract honest: a
// schema that promises a field the route doesn't return fails here.
function expectMatches(schema: z.ZodTypeAny, body: unknown) {
  const result = schema.safeParse(body);
  expect(result.success ? [] : result.error.issues).toEqual([]);
}

describe('responses match their OpenAPI schemas', () => {
  beforeEach(async () => {
    await resetDb();
    await seedDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('public catalogue and settings routes', async () => {
    const categories = await request(app).get('/api/categories');
    expectMatches(z.array(CategorySchema), categories.body);

    const products = await request(app).get('/api/products');
    expect(products.body.length).toBeGreaterThan(0);
    expectMatches(z.array(ProductWithVariantsAndCategorySchema), products.body);

    const product = await request(app).get(`/api/products/${products.body[0].slug}`);
    expectMatches(ProductWithVariantsAndCategorySchema, product.body);

    const shipping = await request(app).get('/api/settings/shipping');
    expectMatches(ShippingConfigSchema, shipping.body);
  });

  it('checkout and order lookup', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const checkout = await request(app).post('/api/orders').send({
      customerName: 'Test Customer',
      customerPhone: '9999999999',
      customerEmail: 'customer@example.com',
      addressStreet: '123 Main St',
      addressCity: 'Jaipur',
      addressState: 'Rajasthan',
      addressPincode: '302001',
      items: [{ variantId: variant.id, quantity: 1 }],
    });
    expect(checkout.status).toBe(201);
    expectMatches(CheckoutResponseSchema, checkout.body);

    const order = await request(app).get(`/api/orders/${checkout.body.orderNumber}`);
    expect(order.status).toBe(200);
    expectMatches(OrderSchema, order.body);
  });

  it('admin product, category, order and settings routes', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const category = await prisma.category.findFirstOrThrow();

    expectMatches(z.array(ProductWithVariantsAndCategorySchema), (await agent.get('/api/admin/products')).body);
    expectMatches(z.array(CategorySchema), (await agent.get('/api/admin/categories')).body);
    expectMatches(StoreSettingsSchema, (await agent.get('/api/admin/settings')).body);

    const created = await agent.post('/api/admin/products').send({
      name: 'Contract Product',
      slug: 'contract-product',
      description: 'A test product',
      categoryId: category.id,
      basePrice: 250,
      imageUrl: 'https://example.com/img.jpg',
      variants: [{ label: 'Default', stock: 10, sku: 'CP-001' }],
    });
    expect(created.status).toBe(201);
    expectMatches(ProductWithVariantsSchema, created.body);

    const updated = await agent.put(`/api/admin/products/${created.body.id}`).send({ name: 'Renamed' });
    expect(updated.status).toBe(200);
    expectMatches(ProductSchema, updated.body);

    const variantId = created.body.variants[0].id;
    const variant = await agent
      .put(`/api/admin/products/${created.body.id}/variants/${variantId}`)
      .send({ label: 'Default', stock: 5, sku: 'CP-001' });
    expect(variant.status).toBe(200);
    expectMatches(ProductVariantSchema, variant.body);

    const newCategory = await agent.post('/api/admin/categories').send({
      name: 'Contract Category',
      slug: 'contract-category',
      description: 'x',
      imageUrl: 'https://example.com/c.jpg',
      icon: 'star',
    });
    expect(newCategory.status).toBe(201);
    expectMatches(CategorySchema, newCategory.body);

    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-CONTRACT',
        status: 'PAID',
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        customerEmail: 'customer@example.com',
        addressStreet: 'x',
        addressCity: 'x',
        addressState: 'x',
        addressPincode: 'x',
        subtotal: 100,
        shippingFee: 0,
        total: 100,
      },
    });
    expectMatches(z.array(OrderSchema), (await agent.get('/api/admin/orders')).body);
    const shipped = await agent.put(`/api/admin/orders/${order.id}/status`).send({ status: 'SHIPPED' });
    expect(shipped.status).toBe(200);
    expectMatches(OrderSchema, shipped.body);
  });
});
