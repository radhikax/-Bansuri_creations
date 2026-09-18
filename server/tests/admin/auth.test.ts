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

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
