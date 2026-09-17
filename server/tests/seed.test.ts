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
