import request from 'supertest';
import bcrypt from 'bcrypt';
import { prisma } from '../src/db';

export async function resetDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.storeSettings.deleteMany();
}

export async function loginAsAdmin(agent: ReturnType<typeof request.agent>) {
  await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash: await bcrypt.hash('pw', 10) },
    create: { email: 'admin@example.com', passwordHash: await bcrypt.hash('pw', 10) },
  });
  await agent.post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
}

export const orderBase = {
  customerName: 'Test Customer',
  customerPhone: '9999999999',
  customerEmail: 'customer@example.com',
  addressStreet: 'x',
  addressCity: 'x',
  addressState: 'x',
  addressPincode: 'x',
  subtotal: 100,
  shippingFee: 0,
  total: 100,
};
