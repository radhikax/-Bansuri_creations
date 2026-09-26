import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/db';
import { resetDb } from './helpers';

describe('GET /api/settings/shipping', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the defaults when no settings row exists', async () => {
    const res = await request(app).get('/api/settings/shipping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ flatShippingFee: 50, freeShippingThreshold: 999 });
  });

  it('returns only the two shipping values from the stored settings', async () => {
    await prisma.storeSettings.create({ data: { id: 1, flatShippingFee: 75, freeShippingThreshold: 1500 } });
    const res = await request(app).get('/api/settings/shipping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ flatShippingFee: 75, freeShippingThreshold: 1500 });
  });

  it('needs no admin session', async () => {
    const res = await request(app).get('/api/settings/shipping');
    expect(res.status).not.toBe(401);
  });
});
