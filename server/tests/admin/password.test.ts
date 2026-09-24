import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { resetDb, loginAsAdmin } from '../helpers';

const NEW_PASSWORD = 'brand-new-pass';

describe('POST /api/admin/password', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects requests without a session', async () => {
    const res = await request(app).post('/api/admin/password').send({ currentPassword: 'pw', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid payload', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'pw' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid payload' });
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'pw', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'New password must be at least 8 characters' });
  });

  it('rejects a new password equal to the current one', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    await prisma.adminUser.update({
      where: { email: 'admin@example.com' },
      data: { passwordHash: await bcrypt.hash('same-password', 10) },
    });
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'same-password', newPassword: 'same-password' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'New password must be different from the current password' });
  });

  it('rejects a wrong current password', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'wrong', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Current password is incorrect' });
  });

  it('changes the password, keeps this session, and signs out older sessions', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email: 'admin@example.com' } });
    // A session from a minute ago, i.e. issued before the change.
    const oldToken = jwt.sign(
      { adminId: admin.id, iat: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!,
    );

    const res = await agent.post('/api/admin/password').send({ currentPassword: 'pw', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(res.headers['set-cookie']?.[0]).toMatch(/admin_session=/);

    // This browser (agent now holds the fresh cookie) stays logged in.
    expect((await agent.get('/api/admin/settings')).status).toBe(200);

    // The older session is rejected.
    const oldRes = await request(app).get('/api/admin/settings').set('Cookie', `admin_session=${oldToken}`);
    expect(oldRes.status).toBe(401);
    expect(oldRes.body).toEqual({ error: 'Not authenticated' });

    // Old password no longer logs in; the new one does.
    const oldLogin = await request(app).post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/admin/login').send({ email: 'admin@example.com', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
  });
});
