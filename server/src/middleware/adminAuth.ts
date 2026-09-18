import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminRequest extends Request {
  adminId?: string;
}

export function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_session;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { adminId: string };
    req.adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}
