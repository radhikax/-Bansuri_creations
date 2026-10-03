import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { seedDatabase } from '../../prisma/seed';

async function loginAsAdmin(agent: ReturnType<typeof request.agent>) {
  await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash: await bcrypt.hash('pw', 10) },
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
    expect(res.body.some((p: { id: string }) => p.id === product.id)).toBe(true);
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
