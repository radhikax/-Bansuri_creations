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
