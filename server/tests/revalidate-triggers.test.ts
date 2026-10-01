import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { prisma } from '../src/db';
import { seedDatabase } from '../prisma/seed';
import { resetDb, loginAsAdmin } from './helpers';

const { revalidateMock, sendOrderConfirmationEmailMock, sendAdminNewOrderEmailMock } = vi.hoisted(() => ({
  revalidateMock: vi.fn(),
  sendOrderConfirmationEmailMock: vi.fn().mockResolvedValue(undefined),
  sendAdminNewOrderEmailMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/revalidate', () => ({ revalidate: revalidateMock }));
vi.mock('../src/services/email', () => ({
  sendOrderConfirmationEmail: sendOrderConfirmationEmailMock,
  sendAdminNewOrderEmail: sendAdminNewOrderEmailMock,
}));

import app from '../src/app';

function sign(body: string): string {
  return crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest('hex');
}

describe('revalidate triggers', () => {
  beforeEach(async () => {
    revalidateMock.mockClear();
    sendOrderConfirmationEmailMock.mockClear();
    sendAdminNewOrderEmailMock.mockClear();
    await resetDb();
    await seedDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('products', () => {
    it('revalidates catalogue and the new slug on create', async () => {
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
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith(['catalogue', 'product:new-test-product']);
    });

    it('does not revalidate when creating a product fails validation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.post('/api/admin/products').send({ name: 'Missing fields' });

      expect(res.status).toBe(400);
      expect(revalidateMock).not.toHaveBeenCalled();
    });

    it('revalidates catalogue and the slug on update', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const product = await prisma.product.findFirstOrThrow();

      const res = await agent.put(`/api/admin/products/${product.id}`).send({ basePrice: 1234 });

      expect(res.status).toBe(200);
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith(['catalogue', `product:${product.slug}`]);
    });

    it('does not revalidate when a product update fails validation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const product = await prisma.product.findFirstOrThrow();

      const res = await agent.put(`/api/admin/products/${product.id}`).send({ basePrice: -5 });

      expect(res.status).toBe(400);
      expect(revalidateMock).not.toHaveBeenCalled();
    });

    it('revalidates catalogue and the parent product slug on a variant update', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const product = await prisma.product.findFirstOrThrow({ include: { variants: true } });
      const variant = product.variants[0];

      const res = await agent
        .put(`/api/admin/products/${product.id}/variants/${variant.id}`)
        .send({ label: variant.label, stock: variant.stock + 1, sku: variant.sku });

      expect(res.status).toBe(200);
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith(['catalogue', `product:${product.slug}`]);
    });

    it('does not revalidate when a variant update fails validation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const product = await prisma.product.findFirstOrThrow({ include: { variants: true } });
      const variant = product.variants[0];

      const res = await agent
        .put(`/api/admin/products/${product.id}/variants/${variant.id}`)
        .send({ label: '', stock: -1, sku: '' });

      expect(res.status).toBe(400);
      expect(revalidateMock).not.toHaveBeenCalled();
    });

    it('does not revalidate when a product update targets a missing product', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.put('/api/admin/products/does-not-exist').send({ basePrice: 100 });

      expect(res.status).toBe(500);
      expect(revalidateMock).not.toHaveBeenCalled();
    });
  });

  describe('categories', () => {
    it('revalidates catalogue and the slug on create', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.post('/api/admin/categories').send({
        name: 'Test Category',
        slug: 'test-category',
        description: 'desc',
        imageUrl: 'https://example.com/img.jpg',
        icon: '🎉',
      });

      expect(res.status).toBe(201);
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith(['catalogue', 'category:test-category']);
    });

    it('does not revalidate when creating a category fails validation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.post('/api/admin/categories').send({ name: 'Missing fields' });

      expect(res.status).toBe(400);
      expect(revalidateMock).not.toHaveBeenCalled();
    });

    it('revalidates catalogue and the slug on update', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();

      const res = await agent.put(`/api/admin/categories/${category.id}`).send({ name: 'Renamed Category' });

      expect(res.status).toBe(200);
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith(['catalogue', `category:${category.slug}`]);
    });

    it('does not revalidate when a category update targets a missing category', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.put('/api/admin/categories/does-not-exist').send({ name: 'x' });

      expect(res.status).toBe(500);
      expect(revalidateMock).not.toHaveBeenCalled();
    });

    it('revalidates catalogue and the slug on delete', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      await prisma.orderItem.deleteMany();
      await prisma.productVariant.deleteMany();
      await prisma.product.deleteMany();
      const category = await prisma.category.findFirstOrThrow();

      const res = await agent.delete(`/api/admin/categories/${category.id}`);

      expect(res.status).toBe(204);
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith(['catalogue', `category:${category.slug}`]);
    });

    it('does not revalidate when deleting a missing category', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.delete('/api/admin/categories/does-not-exist');

      expect(res.status).toBe(500);
      expect(revalidateMock).not.toHaveBeenCalled();
    });
  });

  describe('settings', () => {
    it('revalidates catalogue on update', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.put('/api/admin/settings').send({ flatShippingFee: 75, freeShippingThreshold: 1500 });

      expect(res.status).toBe(200);
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith(['catalogue']);
    });

    it('does not revalidate when a settings update fails validation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);

      const res = await agent.put('/api/admin/settings').send({ flatShippingFee: -1 });

      expect(res.status).toBe(400);
      expect(revalidateMock).not.toHaveBeenCalled();
    });
  });

  describe('webhook', () => {
    it('revalidates the slug of each product in the order when payment is captured', async () => {
      const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: 'DSD-001' }, include: { product: true } });
      const order = await prisma.order.create({
        data: {
          orderNumber: 'ORD-REVALIDATE1',
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
          razorpayOrderId: 'order_revalidate_test',
          items: {
            create: [
              {
                productVariantId: variant.id,
                productNameSnapshot: variant.product.name,
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
        payload: { payment: { entity: { id: 'pay_revalidate_test', order_id: 'order_revalidate_test' } } },
      });

      const res = await request(app)
        .post('/api/orders/razorpay-webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', sign(payload))
        .send(payload);

      expect(res.status).toBe(200);
      expect(revalidateMock).toHaveBeenCalledTimes(1);
      expect(revalidateMock).toHaveBeenCalledWith([`product:${variant.product.slug}`]);

      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    });

    it('does not revalidate when the webhook signature is invalid', async () => {
      const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'x', order_id: 'y' } } } });

      const res = await request(app)
        .post('/api/orders/razorpay-webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'not-a-valid-signature')
        .send(payload);

      expect(res.status).toBe(400);
      expect(revalidateMock).not.toHaveBeenCalled();
    });

    it('does not revalidate when the order cannot be found', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_missing', order_id: 'order_does_not_exist' } } },
      });

      const res = await request(app)
        .post('/api/orders/razorpay-webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', sign(payload))
        .send(payload);

      expect(res.status).toBe(200);
      expect(revalidateMock).not.toHaveBeenCalled();
    });
  });
});
