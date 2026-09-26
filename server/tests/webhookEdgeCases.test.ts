import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';
import { resetDb, orderBase } from './helpers';

const { confirmMock, adminMock } = vi.hoisted(() => ({
  confirmMock: vi.fn().mockResolvedValue(undefined),
  adminMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/email', () => ({
  sendOrderConfirmationEmail: confirmMock,
  sendAdminNewOrderEmail: adminMock,
}));

import app from '../src/app';

const URL = '/api/orders/razorpay-webhook';

function sign(body: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET!): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function capturedPayload(razorpayOrderId: string, paymentId = 'pay_1') {
  return JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId } } },
  });
}

function post(body: string, signature?: string) {
  const req = request(app).post(URL).set('Content-Type', 'application/json');
  if (signature !== undefined) req.set('x-razorpay-signature', signature);
  return req.send(body);
}

async function createOrder(razorpayOrderId: string, status: 'PENDING' | 'PAID' | 'CANCELLED' = 'PENDING', quantity = 2) {
  const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
  const order = await prisma.order.create({
    data: {
      ...orderBase,
      orderNumber: `ORD-${razorpayOrderId}`,
      razorpayOrderId,
      status,
      items: {
        create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity }],
      },
    },
  });
  return { order, variant };
}

describe('razorpay webhook edge cases', () => {
  beforeEach(async () => {
    confirmMock.mockClear().mockResolvedValue(undefined);
    adminMock.mockClear().mockResolvedValue(undefined);
    await resetDb();
    await seedDatabase(prisma);
  });

  it('rejects a request with no signature header', async () => {
    const res = await post(capturedPayload('order_x'));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid signature' });
  });

  it('rejects a signature made with the wrong secret', async () => {
    const body = capturedPayload('order_x');
    const res = await post(body, sign(body, 'wrong-secret'));
    expect(res.status).toBe(400);
  });

  it('rejects a valid signature when the body was tampered with afterwards', async () => {
    const { order } = await createOrder('order_tamper');
    const original = capturedPayload('order_tamper');
    const signature = sign(original);
    const res = await post(original.replace('pay_1', 'pay_evil'), signature);
    expect(res.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
  });

  it('acknowledges but ignores events other than payment.captured', async () => {
    const { order } = await createOrder('order_other');
    const body = JSON.stringify({ event: 'payment.failed', payload: {} });
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('acknowledges a captured payment for an unknown order without side effects', async () => {
    const body = capturedPayload('order_unknown');
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it.each(['PAID', 'CANCELLED'] as const)('ignores a captured payment for an already %s order', async (status) => {
    const { order, variant } = await createOrder(`order_${status}`, status);
    const body = capturedPayload(`order_${status}`, 'pay_late');
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe(status);
    expect(after.razorpayPaymentId).toBeNull();
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(variant.stock);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('records paidAt and the payment id when capturing', async () => {
    const { order } = await createOrder('order_paid_at');
    const body = capturedPayload('order_paid_at', 'pay_abc');
    await post(body, sign(body));
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.razorpayPaymentId).toBe('pay_abc');
    expect(after.paidAt).toBeInstanceOf(Date);
  });

  it('passes the order details to both emails', async () => {
    await createOrder('order_email');
    const body = capturedPayload('order_email');
    await post(body, sign(body));
    const expected = expect.objectContaining({
      orderNumber: 'ORD-order_email',
      customerEmail: 'customer@example.com',
      total: 100,
    });
    expect(confirmMock).toHaveBeenCalledWith(expected);
    expect(adminMock).toHaveBeenCalledWith(expected);
  });

  it('returns 500 for a correctly signed but malformed payload', async () => {
    const body = 'not json at all';
    const res = await post(body, sign(body));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Webhook processing failed' });
  });

  it('returns 500 for a captured event missing payment details', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} });
    const res = await post(body, sign(body));
    expect(res.status).toBe(500);
  });

  it('returns 500 when sending the email fails, after the order was already marked paid', async () => {
    const { order } = await createOrder('order_mailfail');
    confirmMock.mockRejectedValueOnce(new Error('smtp down'));
    const body = capturedPayload('order_mailfail');
    const res = await post(body, sign(body));
    expect(res.status).toBe(500);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('decrements stock for every line item in the order', async () => {
    const [v1, v2] = await prisma.productVariant.findMany({ take: 2, orderBy: { sku: 'asc' } });
    const order = await prisma.order.create({
      data: {
        ...orderBase, orderNumber: 'ORD-MULTI', razorpayOrderId: 'order_multi',
        items: {
          create: [
            { productVariantId: v1.id, productNameSnapshot: 'a', variantLabelSnapshot: 'a', unitPrice: 1, quantity: 2 },
            { productVariantId: v2.id, productNameSnapshot: 'b', variantLabelSnapshot: 'b', unitPrice: 1, quantity: 3 },
          ],
        },
      },
    });
    const body = capturedPayload('order_multi');
    await post(body, sign(body));
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: v1.id } })).stock).toBe(v1.stock - 2);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: v2.id } })).stock).toBe(v2.stock - 3);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
