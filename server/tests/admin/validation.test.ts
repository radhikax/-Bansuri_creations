import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { seedDatabase } from '../../prisma/seed';
import { resetDb, loginAsAdmin, orderBase } from '../helpers';

describe('admin auth edge cases', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.adminUser.create({
      data: { email: 'admin@example.com', passwordHash: await bcrypt.hash('correct-password', 10) },
    });
  });

  it('requires both email and password', async () => {
    const noPassword = await request(app).post('/api/admin/login').send({ email: 'admin@example.com' });
    const noEmail = await request(app).post('/api/admin/login').send({ password: 'x' });
    const empty = await request(app).post('/api/admin/login').send({});
    expect(noPassword.status).toBe(400);
    expect(noEmail.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  it('rejects an unknown email with the same 401 as a wrong password', async () => {
    const res = await request(app).post('/api/admin/login').send({ email: 'nobody@example.com', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('issues an httpOnly, SameSite=Lax session cookie', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@example.com', password: 'correct-password' });
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('logout clears the session cookie', async () => {
    const res = await request(app).post('/api/admin/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(res.headers['set-cookie']?.[0]).toMatch(/admin_session=;/);
  });

  it('a logged-in agent loses access after the cookie is cleared', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    expect((await agent.get('/api/admin/settings')).status).toBe(200);
    await agent.post('/api/admin/logout');
    expect((await agent.get('/api/admin/settings')).status).toBe(401);
  });

  it('rejects a forged session cookie', async () => {
    const res = await request(app).get('/api/admin/products').set('Cookie', 'admin_session=forged.token.value');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid session' });
  });
});

describe('admin route auth and validation', () => {
  beforeEach(async () => {
    await resetDb();
    await seedDatabase(prisma);
  });

  it.each([
    ['post', '/api/admin/products'],
    ['put', '/api/admin/products/x'],
    ['put', '/api/admin/products/x/variants/y'],
    ['post', '/api/admin/categories'],
    ['put', '/api/admin/categories/x'],
    ['delete', '/api/admin/categories/x'],
    ['get', '/api/admin/categories'],
    ['get', '/api/admin/orders'],
    ['put', '/api/admin/orders/x/status'],
    ['get', '/api/admin/settings'],
    ['put', '/api/admin/settings'],
  ] as const)('%s %s requires an admin session', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  describe('products', () => {
    const validVariant = { label: 'Default', stock: 5, sku: 'X-1' };

    it('rejects product creation with missing or malformed fields', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();
      const valid = {
        name: 'P', slug: 'p', description: 'd', categoryId: category.id,
        basePrice: 100, imageUrl: 'u', variants: [validVariant],
      };

      const bad = [
        { ...valid, name: '' },
        { ...valid, basePrice: -5 },
        { ...valid, basePrice: 10.5 },
        { ...valid, variants: [] },
        { ...valid, variants: [{ ...validVariant, stock: -1 }] },
        { ...valid, variants: [{ label: 'x' }] },
      ];
      for (const payload of bad) {
        const res = await agent.post('/api/admin/products').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid product payload');
      }
      expect(await prisma.product.count({ where: { slug: 'p' } })).toBe(0);
    });

    it('stores an originalPrice and per-variant price on creation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();
      const res = await agent.post('/api/admin/products').send({
        name: 'Discounted', slug: 'discounted', description: 'd', categoryId: category.id,
        basePrice: 400, originalPrice: 500, imageUrl: 'u',
        variants: [{ ...validVariant, price: 450 }],
      });
      expect(res.status).toBe(201);
      expect(res.body.originalPrice).toBe(500);
      expect(res.body.variants[0].price).toBe(450);
    });

    it('stores the given images array on creation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();
      const res = await agent.post('/api/admin/products').send({
        name: 'Gallery Product', slug: 'gallery-product', description: 'd', categoryId: category.id,
        basePrice: 400, imageUrl: 'cover.jpg', images: ['cover.jpg', 'side.jpg', 'back.jpg'],
        variants: [validVariant],
      });
      expect(res.status).toBe(201);
      expect(res.body.images).toEqual(['cover.jpg', 'side.jpg', 'back.jpg']);
    });

    it('defaults images to [imageUrl] when none are given on creation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();
      const res = await agent.post('/api/admin/products').send({
        name: 'No Gallery Product', slug: 'no-gallery-product', description: 'd', categoryId: category.id,
        basePrice: 400, imageUrl: 'cover.jpg', variants: [validVariant],
      });
      expect(res.status).toBe(201);
      expect(res.body.images).toEqual(['cover.jpg']);
    });

    it('defaults images to [imageUrl] when an empty array is given on creation', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();
      const res = await agent.post('/api/admin/products').send({
        name: 'Empty Gallery Product', slug: 'empty-gallery-product', description: 'd', categoryId: category.id,
        basePrice: 400, imageUrl: 'cover.jpg', images: [], variants: [validVariant],
      });
      expect(res.status).toBe(201);
      expect(res.body.images).toEqual(['cover.jpg']);
    });

    it('rejects an images array containing an empty string', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();
      const res = await agent.post('/api/admin/products').send({
        name: 'Bad Gallery Product', slug: 'bad-gallery-product', description: 'd', categoryId: category.id,
        basePrice: 400, imageUrl: 'cover.jpg', images: ['cover.jpg', ''], variants: [validVariant],
      });
      expect(res.status).toBe(400);
      expect(await prisma.product.count({ where: { slug: 'bad-gallery-product' } })).toBe(0);
    });

    it('replaces the images array on update', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const product = await prisma.product.findFirstOrThrow();
      const res = await agent
        .put(`/api/admin/products/${product.id}`)
        .send({ images: ['new-a.jpg', 'new-b.jpg'] });
      expect(res.status).toBe(200);
      expect(res.body.images).toEqual(['new-a.jpg', 'new-b.jpg']);
    });

    it('rejects an invalid product update and leaves the product unchanged', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const product = await prisma.product.findFirstOrThrow();
      const res = await agent.put(`/api/admin/products/${product.id}`).send({ basePrice: 'free' });
      expect(res.status).toBe(400);
      const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(after.basePrice).toBe(product.basePrice);
    });

    it('can clear originalPrice by sending null', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const product = await prisma.product.findFirstOrThrow();
      await prisma.product.update({ where: { id: product.id }, data: { originalPrice: 999 } });
      const res = await agent.put(`/api/admin/products/${product.id}`).send({ originalPrice: null });
      expect(res.status).toBe(200);
      expect(res.body.originalPrice).toBeNull();
    });

    it('updates a variant', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const variant = await prisma.productVariant.findFirstOrThrow();
      const res = await agent
        .put(`/api/admin/products/${variant.productId}/variants/${variant.id}`)
        .send({ label: 'Renamed', price: 321, stock: 7, sku: variant.sku });
      expect(res.status).toBe(200);
      const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
      expect(after).toMatchObject({ label: 'Renamed', price: 321, stock: 7 });
    });

    it('rejects an invalid variant update', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const variant = await prisma.productVariant.findFirstOrThrow();
      const res = await agent
        .put(`/api/admin/products/${variant.productId}/variants/${variant.id}`)
        .send({ label: '', stock: -3, sku: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid variant payload');
    });
  });

  describe('categories', () => {
    const valid = { name: 'N', slug: 'n', description: 'd', imageUrl: 'u', icon: 'i' };

    it('rejects an invalid category payload', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const res = await agent.post('/api/admin/categories').send({ ...valid, name: '' });
      expect(res.status).toBe(400);
      expect(await prisma.category.count({ where: { slug: 'n' } })).toBe(0);
    });

    it('rejects an invalid category update but accepts a partial one', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const category = await prisma.category.findFirstOrThrow();

      const bad = await agent.put(`/api/admin/categories/${category.id}`).send({ name: '' });
      expect(bad.status).toBe(400);

      const good = await agent.put(`/api/admin/categories/${category.id}`).send({ icon: '🎉' });
      expect(good.status).toBe(200);
      expect(good.body.icon).toBe('🎉');
      expect(good.body.name).toBe(category.name);
    });
  });

  describe('settings', () => {
    it('rejects negative or non-integer values', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      for (const payload of [
        { flatShippingFee: -1, freeShippingThreshold: 100 },
        { flatShippingFee: 10, freeShippingThreshold: 1.5 },
        { flatShippingFee: 10 },
      ]) {
        const res = await agent.put('/api/admin/settings').send(payload);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid settings payload');
      }
    });
  });

  describe('orders', () => {
    it('rejects statuses an admin may not set', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const order = await prisma.order.create({ data: { ...orderBase, orderNumber: 'ORD-V1' } });
      for (const status of ['PENDING', 'PAID', 'BOGUS']) {
        const res = await agent.put(`/api/admin/orders/${order.id}/status`).send({ status });
        expect(res.status).toBe(400);
      }
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    });

    it('returns 404 when updating an unknown order', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const res = await agent.put('/api/admin/orders/does-not-exist/status').send({ status: 'SHIPPED' });
      expect(res.status).toBe(404);
    });

    it('moves an order forward without touching stock', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const variant = await prisma.productVariant.findFirstOrThrow();
      const order = await prisma.order.create({
        data: {
          ...orderBase, orderNumber: 'ORD-V2', status: 'PAID',
          items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 100, quantity: 3 }] },
        },
      });
      const res = await agent.put(`/api/admin/orders/${order.id}/status`).send({ status: 'SHIPPED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SHIPPED');
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(variant.stock);
    });

    it('does not restock again when cancelling an already cancelled order', async () => {
      const agent = request.agent(app);
      await loginAsAdmin(agent);
      const variant = await prisma.productVariant.findFirstOrThrow();
      const order = await prisma.order.create({
        data: {
          ...orderBase, orderNumber: 'ORD-V3', status: 'CANCELLED',
          items: { create: [{ productVariantId: variant.id, productNameSnapshot: 'x', variantLabelSnapshot: 'x', unitPrice: 100, quantity: 3 }] },
        },
      });
      await agent.put(`/api/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' });
      expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(variant.stock);
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
