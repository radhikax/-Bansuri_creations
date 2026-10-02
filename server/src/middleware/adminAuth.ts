import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

export interface AdminRequest extends Request {
  adminId?: string;
}

interface AdminSessionPayload {
  adminId: string;
  iat?: number;
}

export async function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.admin_session;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  let payload: AdminSessionPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as AdminSessionPayload;
  } catch {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminId },
      select: { passwordChangedAt: true },
    });
    if (!admin) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }
    // iat has one-second resolution and passwordChangedAt is stored truncated to
    // the second, so the session issued alongside a password change (same second)
    // stays valid while every earlier session is rejected.
    if (admin.passwordChangedAt && (payload.iat ?? 0) < Math.floor(admin.passwordChangedAt.getTime() / 1000)) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    req.adminId = payload.adminId;
    next();
  } catch (err) {
    next(err);
  }
}
