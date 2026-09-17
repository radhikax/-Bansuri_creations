import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db';

describe('database connection', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
  });

  it('connects and can query an empty categories table', async () => {
    const categories = await prisma.category.findMany();
    expect(categories).toEqual([]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
