import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';

describe('POST /api/admin/login', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.storeSettings.deleteMany();
    await prisma.adminUser.create({
      data: { email: 'admin@example.com', passwordHash: await bcrypt.hash('correct-password', 10) },
    });
  });

  it('sets an admin_session cookie on correct credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/admin_session=/);
  });

  it('rejects incorrect credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  describe('brute-force limit', () => {
    async function makeAdmin(email: string) {
      await prisma.adminUser.create({ data: { email, passwordHash: await bcrypt.hash('correct-password', 10) } });
    }
    const login = (email: string, password: string) =>
      request(app).post('/api/admin/login').send({ email, password });

    it('blocks an account after 10 failed logins in the window, even with the right password', async () => {
      await makeAdmin('locked@example.com');
      for (let i = 0; i < 10; i++) {
        expect((await login('locked@example.com', 'wrong-password')).status).toBe(401);
      }

      const blocked = await login('locked@example.com', 'correct-password');
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual({ error: 'Too many login attempts. Try again in 15 minutes.' });
      expect(blocked.headers['set-cookie']).toBeUndefined();
    });

    it('counts attempts per account, case-insensitively, without affecting other accounts', async () => {
      await makeAdmin('first@example.com');
      await makeAdmin('second@example.com');
      for (let i = 0; i < 10; i++) {
        await login(i % 2 ? 'FIRST@example.com' : 'first@example.com', 'wrong-password');
      }

      expect((await login('first@example.com', 'correct-password')).status).toBe(429);
      expect((await login('second@example.com', 'correct-password')).status).toBe(200);
    });

    it('does not count successful logins', async () => {
      await makeAdmin('busy@example.com');
      for (let i = 0; i < 12; i++) {
        expect((await login('busy@example.com', 'correct-password')).status).toBe(200);
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
