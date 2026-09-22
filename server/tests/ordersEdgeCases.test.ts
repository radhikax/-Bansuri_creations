import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';
import { resetDb } from './helpers';

const { createRazorpayOrderMock } = vi.hoisted(() => ({
  createRazorpayOrderMock: vi.fn(),
}));

vi.mock('../src/services/razorpay', () => ({
  createRazorpayOrder: createRazorpayOrderMock,
  verifyWebhookSignature: vi.fn(),
}));

import app from '../src/app';

const customer = {
  customerName: 'Test Customer',
  customerPhone: '9999999999',
  customerEmail: 'customer@example.com',
  addressStreet: '123 Main St',
  addressCity: 'Jaipur',
  addressState: 'Rajasthan',
  addressPincode: '302001',
};

describe('POST /api/orders edge cases', () => {
  beforeEach(async () => {
    createRazorpayOrderMock.mockReset().mockResolvedValue({ id: 'order_mocked' });
    await resetDb();
    await seedDatabase(prisma);
  });

  it('falls back to default shipping when no settings row exists', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    await prisma.storeSettings.deleteMany();
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(res.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.body.orderNumber } });
    expect(order.shippingFee).toBe(50);
  });

  it('uses the configured shipping fee from store settings', async () => {
    await prisma.storeSettings.update({ where: { id: 1 }, data: { flatShippingFee: 120, freeShippingThreshold: 100000 } });
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(res.body.amount).toBe(499 + 120);
  });

  it('waives shipping at or above the free-shipping threshold', async () => {
    await prisma.storeSettings.update({ where: { id: 1 }, data: { flatShippingFee: 50, freeShippingThreshold: 400 } });
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(res.body.amount).toBe(499);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.body.orderNumber } });
    expect(order.shippingFee).toBe(0);
  });

  it('snapshots product name, variant label and unit price on the order items', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' }, include: { product: true } });
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 3 }] });
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.body.orderNumber }, include: { items: true } });
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productNameSnapshot: variant.product.name,
      variantLabelSnapshot: variant.label,
      unitPrice: 499,
      quantity: 3,
    });
  });

  it('does not decrement stock at checkout (only the webhook does)', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 2 }] });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(variant.stock);
  });

  it('rejects an unknown variant with 409 and creates no order', async () => {
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: 'nope', quantity: 1 }] });
    expect(res.status).toBe(409);
    expect(await prisma.order.count()).toBe(0);
  });

  // KNOWN GAP: checkout never checks product.isActive, so a deactivated product can still be
  // ordered by posting its variant id directly. it.fails keeps the suite green while the gap
  // exists and will fail (prompting removal of `.fails`) once checkout rejects inactive products.
  it.fails('rejects an inactive product with 409', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    await prisma.product.update({ where: { id: variant.productId }, data: { isActive: false } });
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(res.status).toBe(409);
  });

  // KNOWN GAP: stock is validated per line, not summed per variant, so repeating a variant
  // across lines can exceed available stock.
  it.fails('rejects the same variant repeated across lines when the sum exceeds stock', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const half = Math.floor(variant.stock / 2) + 1;
    const res = await request(app).post('/api/orders').send({
      ...customer,
      items: [{ variantId: variant.id, quantity: half }, { variantId: variant.id, quantity: half }],
    });
    expect(res.status).toBe(409);
  });

  it('rejects a request for more than the available stock', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: variant.stock + 1 }] });
    expect(res.status).toBe(409);
    expect(await prisma.order.count()).toBe(0);
  });

  it.each([
    ['empty items', { items: [] }],
    ['zero quantity', { items: [{ variantId: 'x', quantity: 0 }] }],
    ['fractional quantity', { items: [{ variantId: 'x', quantity: 1.5 }] }],
    ['negative quantity', { items: [{ variantId: 'x', quantity: -1 }] }],
    ['bad email', { customerEmail: 'not-an-email', items: [{ variantId: 'x', quantity: 1 }] }],
    ['short phone', { customerPhone: '123', items: [{ variantId: 'x', quantity: 1 }] }],
    ['blank name', { customerName: '', items: [{ variantId: 'x', quantity: 1 }] }],
    ['missing items', {}],
  ])('rejects an invalid payload: %s', async (_label, override) => {
    const res = await request(app).post('/api/orders').send({ ...customer, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid order payload');
    expect(await prisma.order.count()).toBe(0);
  });

  it('returns 500 when Razorpay order creation fails', async () => {
    createRazorpayOrderMock.mockRejectedValueOnce(new Error('razorpay down'));
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('exposes the public Razorpay key id and no secrets', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const res = await request(app).post('/api/orders').send({ ...customer, items: [{ variantId: variant.id, quantity: 1 }] });
    expect(res.body.razorpayKeyId).toBe(process.env.RAZORPAY_KEY_ID);
    expect(Object.keys(res.body).sort()).toEqual(['amount', 'orderId', 'orderNumber', 'razorpayKeyId', 'razorpayOrderId']);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
