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
    expect(res.body).toHaveLength(17);
    expect(res.body[0]).toHaveProperty('variants');
  });

  it('filters by category slug', async () => {
    const res = await request(app).get('/api/products?category=diwali-decor');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    for (const product of res.body) {
      expect(product.category.slug).toBe('diwali-decor');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});

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
