import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app';
import { prisma } from '../../src/db';

async function loginAsAdmin(agent: ReturnType<typeof request.agent>) {
  await prisma.adminUser.create({ data: { email: 'admin@example.com', passwordHash: await bcrypt.hash('pw', 10) } });
  await agent.post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
}

describe('admin categories routes', () => {
  beforeEach(async () => {
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.adminUser.deleteMany();
  });

  it('creates, updates, and deletes a category', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);

    const createRes = await agent.post('/api/admin/categories').send({
      name: 'Test Category',
      slug: 'test-category',
      description: 'desc',
      imageUrl: 'https://example.com/img.jpg',
      icon: '🎉',
    });
    expect(createRes.status).toBe(201);
    const categoryId = createRes.body.id;

    const updateRes = await agent.put(`/api/admin/categories/${categoryId}`).send({ name: 'Renamed Category' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Renamed Category');

    const deleteRes = await agent.delete(`/api/admin/categories/${categoryId}`);
    expect(deleteRes.status).toBe(204);

    const found = await prisma.category.findUnique({ where: { id: categoryId } });
    expect(found).toBeNull();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
