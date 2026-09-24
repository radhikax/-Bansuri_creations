import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { requireAdminAuth, type AdminRequest } from '../../src/middleware/adminAuth';
import { prisma } from '../../src/db';
import { resetDb } from '../helpers';

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function reqWithToken(token: string) {
  return { cookies: { admin_session: token } } as unknown as AdminRequest;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('requireAdminAuth', () => {
  beforeEach(async () => {
    vi.stubEnv('JWT_SECRET', 'unit-test-secret');
    await resetDb();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('responds 401 when there is no session cookie', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth({ cookies: {} } as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when cookies are not parsed at all', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth({} as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for a token that is not a valid JWT', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken('garbage'), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for a token signed with a different secret', async () => {
    const token = jwt.sign({ adminId: 'a1' }, 'some-other-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for an expired token', async () => {
    const token = jwt.sign({ adminId: 'a1' }, 'unit-test-secret', { expiresIn: -10 });
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the admin in the token no longer exists', async () => {
    const token = jwt.sign({ adminId: 'deleted-admin' }, 'unit-test-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches adminId and calls next for a valid token of an existing admin', async () => {
    const admin = await prisma.adminUser.create({ data: { email: 'a@example.com', passwordHash: 'x' } });
    const token = jwt.sign({ adminId: admin.id }, 'unit-test-secret');
    const req = reqWithToken(token);
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(req, res as unknown as Response, next);
    expect(req.adminId).toBe(admin.id);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a token issued in an earlier second than passwordChangedAt', async () => {
    const changedAt = nowSeconds();
    const admin = await prisma.adminUser.create({
      data: { email: 'a@example.com', passwordHash: 'x', passwordChangedAt: new Date(changedAt * 1000) },
    });
    const token = jwt.sign({ adminId: admin.id, iat: changedAt - 60 }, 'unit-test-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a token issued in the same second as passwordChangedAt', async () => {
    const changedAt = nowSeconds();
    const admin = await prisma.adminUser.create({
      data: { email: 'a@example.com', passwordHash: 'x', passwordChangedAt: new Date(changedAt * 1000) },
    });
    const token = jwt.sign({ adminId: admin.id, iat: changedAt }, 'unit-test-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
