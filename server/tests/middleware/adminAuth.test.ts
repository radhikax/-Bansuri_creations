import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { requireAdminAuth, type AdminRequest } from '../../src/middleware/adminAuth';

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('requireAdminAuth', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'unit-test-secret');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('responds 401 when there is no session cookie', () => {
    const res = mockRes();
    const next = vi.fn();
    requireAdminAuth({ cookies: {} } as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when cookies are not parsed at all', () => {
    const res = mockRes();
    const next = vi.fn();
    requireAdminAuth({} as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for a token that is not a valid JWT', () => {
    const res = mockRes();
    const next = vi.fn();
    requireAdminAuth({ cookies: { admin_session: 'garbage' } } as unknown as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for a token signed with a different secret', () => {
    const token = jwt.sign({ adminId: 'a1' }, 'some-other-secret');
    const res = mockRes();
    const next = vi.fn();
    requireAdminAuth({ cookies: { admin_session: token } } as unknown as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for an expired token', () => {
    const token = jwt.sign({ adminId: 'a1' }, 'unit-test-secret', { expiresIn: -10 });
    const res = mockRes();
    const next = vi.fn();
    requireAdminAuth({ cookies: { admin_session: token } } as unknown as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches adminId and calls next for a valid token', () => {
    const token = jwt.sign({ adminId: 'admin-42' }, 'unit-test-secret');
    const req = { cookies: { admin_session: token } } as unknown as AdminRequest;
    const res = mockRes();
    const next = vi.fn();
    requireAdminAuth(req, res as unknown as Response, next);
    expect(req.adminId).toBe('admin-42');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
