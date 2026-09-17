import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';

// Simulate the dominant checkout failure path: a live Razorpay call that rejects.
vi.mock('../src/services/razorpay', () => ({
  createRazorpayOrder: vi.fn().mockRejectedValue(new Error('Razorpay timeout')),
  verifyWebhookSignature: vi.fn(),
}));

import app from '../src/app';

describe('global error handling', () => {
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

  it('returns 500 instead of crashing when a route handler rejects', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    errorSpy.mockRestore();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
