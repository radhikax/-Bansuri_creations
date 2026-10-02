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

describe('variant ordering', () => {
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

  // Kanha Ji Dress is seeded with variants Small (KJD-S), Medium (KJD-M),
  // Large (KJD-L) in that creation order. Updating the first-created variant
  // rewrites its row (Postgres MVCC), which without an explicit ORDER BY can
  // leave it ordered after rows that were never touched again post-insert.
  // Both endpoints must keep returning variants in creation order regardless.
  it('returns variants from GET /api/products in creation order after updating the first-created variant', async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: 'kanha-ji-dress' },
      include: { variants: true },
    });
    const firstCreated = product.variants.find((v) => v.sku === 'KJD-S');
    expect(firstCreated).toBeDefined();

    await prisma.productVariant.update({
      where: { id: firstCreated!.id },
      data: { stock: firstCreated!.stock + 1 },
    });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const kanha = res.body.find((p: { slug: string }) => p.slug === 'kanha-ji-dress');
    expect(kanha.variants.map((v: { sku: string }) => v.sku)).toEqual(['KJD-S', 'KJD-M', 'KJD-L']);
  });

  it('returns variants from GET /api/products/:slug in creation order after updating the first-created variant', async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: 'kanha-ji-dress' },
      include: { variants: true },
    });
    const firstCreated = product.variants.find((v) => v.sku === 'KJD-S');
    expect(firstCreated).toBeDefined();

    await prisma.productVariant.update({
      where: { id: firstCreated!.id },
      data: { stock: firstCreated!.stock + 1 },
    });

    const res = await request(app).get('/api/products/kanha-ji-dress');
    expect(res.status).toBe(200);
    expect(res.body.variants.map((v: { sku: string }) => v.sku)).toEqual(['KJD-S', 'KJD-M', 'KJD-L']);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
