import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { cancelAbandonedOrders } from '../../src/jobs/cancelAbandonedOrders';

async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
}

describe('cancelAbandonedOrders', () => {
  beforeEach(resetDb);

  it('cancels PENDING orders older than the cutoff', async () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const old = new Date('2026-09-14T00:00:00Z');
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-OLD1', customerName: 'x', customerPhone: 'x', customerEmail: 'x@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 100, shippingFee: 0, total: 100, status: 'PENDING', createdAt: old,
      },
    });

    const count = await cancelAbandonedOrders(24, now);
    expect(count).toBe(1);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('CANCELLED');
  });

  it('does not cancel recent PENDING orders', async () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-NEW1', customerName: 'x', customerPhone: 'x', customerEmail: 'x@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 100, shippingFee: 0, total: 100, status: 'PENDING', createdAt: now,
      },
    });

    const count = await cancelAbandonedOrders(24, now);
    expect(count).toBe(0);

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  it('does not touch PAID orders regardless of age', async () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const old = new Date('2026-09-01T00:00:00Z');
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-PAID1', customerName: 'x', customerPhone: 'x', customerEmail: 'x@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 100, shippingFee: 0, total: 100, status: 'PAID', createdAt: old,
      },
    });

    await cancelAbandonedOrders(24, now);
    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('PAID');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
