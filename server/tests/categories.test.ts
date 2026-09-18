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
