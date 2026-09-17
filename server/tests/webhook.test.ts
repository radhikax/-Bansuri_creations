import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';

const { sendOrderConfirmationEmailMock, sendAdminNewOrderEmailMock } = vi.hoisted(() => ({
  sendOrderConfirmationEmailMock: vi.fn().mockResolvedValue(undefined),
  sendAdminNewOrderEmailMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/email', () => ({
  sendOrderConfirmationEmail: sendOrderConfirmationEmailMock,
  sendAdminNewOrderEmail: sendAdminNewOrderEmailMock,
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

function sign(body: string): string {
  return crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest('hex');
}

describe('POST /api/orders/razorpay-webhook', () => {
  beforeEach(async () => {
    sendOrderConfirmationEmailMock.mockClear();
    sendAdminNewOrderEmailMock.mockClear();
    await resetDb();
    await seedDatabase(prisma);
  });

  it('marks the order paid, decrements stock, and sends emails on a valid signature', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-WEBHOOK1',
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        customerEmail: 'customer@example.com',
        addressStreet: 'x',
        addressCity: 'x',
        addressState: 'x',
        addressPincode: 'x',
        subtotal: 998,
        shippingFee: 50,
        total: 1048,
        razorpayOrderId: 'order_webhook_test',
        items: {
          create: [
            {
              productVariantId: variant.id,
              productNameSnapshot: 'Diwali Special Diyas Set',
              variantLabelSnapshot: 'Default',
              unitPrice: 499,
              quantity: 2,
            },
          ],
        },
      },
    });

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_test123', order_id: 'order_webhook_test' } } },
    });

    const res = await request(app)
      .post('/api/orders/razorpay-webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(payload))
      .send(payload);

    expect(res.status).toBe(200);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('PAID');
    expect(updated.razorpayPaymentId).toBe('pay_test123');

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updatedVariant.stock).toBe(38); // seeded at 40, minus 2

    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendAdminNewOrderEmailMock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when the same signed payload is delivered twice', async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-WEBHOOK2',
        customerName: 'Test Customer',
        customerPhone: '9999999999',
        customerEmail: 'customer@example.com',
        addressStreet: 'x',
        addressCity: 'x',
        addressState: 'x',
        addressPincode: 'x',
        subtotal: 998,
        shippingFee: 50,
        total: 1048,
        razorpayOrderId: 'order_webhook_dup_test',
        items: {
          create: [
            {
              productVariantId: variant.id,
              productNameSnapshot: 'Diwali Special Diyas Set',
              variantLabelSnapshot: 'Default',
              unitPrice: 499,
              quantity: 2,
            },
          ],
        },
      },
    });

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_dup_test', order_id: 'order_webhook_dup_test' } } },
    });
    const signature = sign(payload);

    const firstRes = await request(app)
      .post('/api/orders/razorpay-webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(payload);
    const secondRes = await request(app)
      .post('/api/orders/razorpay-webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(payload);

    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('PAID');

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updatedVariant.stock).toBe(38); // seeded at 40, minus 2 exactly once, not 36

    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendAdminNewOrderEmailMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid signature without changing order state', async () => {
    const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'x', order_id: 'y' } } } });

    const res = await request(app)
      .post('/api/orders/razorpay-webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'not-a-valid-signature')
      .send(payload);

    expect(res.status).toBe(400);
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
