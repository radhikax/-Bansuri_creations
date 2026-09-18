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
