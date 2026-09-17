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

describe('admin orders routes', () => {
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

  it('lists orders, filterable by status', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    await prisma.order.create({
      data: {
        orderNumber: 'ORD-A1', customerName: 'A', customerPhone: '1', customerEmail: 'a@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 499, shippingFee: 50, total: 549, status: 'PAID',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 1 }] },
      },
    });
    await prisma.order.create({
      data: {
        orderNumber: 'ORD-B1', customerName: 'B', customerPhone: '1', customerEmail: 'b@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 499, shippingFee: 50, total: 549, status: 'PENDING',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 1 }] },
      },
    });

    const res = await agent.get('/api/admin/orders?status=PAID');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].orderNumber).toBe('ORD-A1');
  });

  it('updates order status and restocks variants when cancelled', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const stockBefore = variant.stock;

    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-C1', customerName: 'C', customerPhone: '1', customerEmail: 'c@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 998, shippingFee: 0, total: 998, status: 'PAID',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 2 }] },
      },
    });

    const res = await agent.put(`/api/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updatedVariant.stock).toBe(stockBefore + 2);
  });

  it('does not restock when cancelling a PENDING order that was never paid', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });
    const stockBefore = variant.stock;

    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-D1', customerName: 'D', customerPhone: '1', customerEmail: 'd@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 998, shippingFee: 0, total: 998, status: 'PENDING',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 2 }] },
      },
    });

    const res = await agent.put(`/api/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');

    const updatedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(updatedVariant.stock).toBe(stockBefore);
  });

  it('rejects an admin attempt to set status to PAID', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' } });

    const order = await prisma.order.create({
      data: {
        orderNumber: 'ORD-E1', customerName: 'E', customerPhone: '1', customerEmail: 'e@x.com',
        addressStreet: 'x', addressCity: 'x', addressState: 'x', addressPincode: 'x',
        subtotal: 499, shippingFee: 50, total: 549, status: 'PENDING',
        items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 499, quantity: 1 }] },
      },
    });

    const res = await agent.put(`/api/admin/orders/${order.id}/status`).send({ status: 'PAID' });
    expect(res.status).toBe(400);

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
