import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
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
    expect(await prisma.product.count()).toBe(17);

    const kanha = await prisma.product.findUniqueOrThrow({
      where: { slug: 'kanha-ji-dress' },
      include: { variants: true },
    });
    expect(kanha.variants).toHaveLength(3);

    const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.flatShippingFee).toBe(50);

    expect(await prisma.adminUser.count()).toBe(1);
  });

  it('requests a resized Unsplash image, never the multi-megabyte original', async () => {
    // The image optimizer gives up on an upstream fetch after 7s, and an
    // Unsplash original (~9 MB) takes about that long, so the page shows 504s.
    await seedDatabase(prisma);
    const categories = await prisma.category.findMany();
    const products = await prisma.product.findMany();
    const urls = [
      ...categories.map((c) => c.imageUrl),
      ...products.flatMap((p) => [p.imageUrl, ...p.images]),
    ].filter((url) => url.startsWith('https://images.unsplash.com/'));

    expect(urls.length).toBeGreaterThan(0);
    const unsized = urls.filter((url) => !new URL(url).searchParams.has('w'));
    expect(unsized).toEqual([]);
  });

  it('is idempotent when run twice', async () => {
    await seedDatabase(prisma);
    await seedDatabase(prisma);
    expect(await prisma.product.count()).toBe(17);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('in production', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('refuses to seed when SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are unset', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SEED_ADMIN_EMAIL', '');
      vi.stubEnv('SEED_ADMIN_PASSWORD', '');

      await expect(seedDatabase(prisma)).rejects.toThrow(/SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD/);
      expect(await prisma.category.count()).toBe(0);
      expect(await prisma.adminUser.count()).toBe(0);
    });

    it('seeds normally when both admin credentials are set', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SEED_ADMIN_EMAIL', 'owner@bansuricreations.com');
      vi.stubEnv('SEED_ADMIN_PASSWORD', 'a-long-unique-password');

      await seedDatabase(prisma);

      expect(await prisma.adminUser.count()).toBe(1);
      const admin = await prisma.adminUser.findUniqueOrThrow({
        where: { email: 'owner@bansuricreations.com' },
      });
      expect(admin.email).toBe('owner@bansuricreations.com');
    });
  });
});
