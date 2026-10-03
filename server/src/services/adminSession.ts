import type { Response } from 'express';
import jwt from 'jsonwebtoken';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Signs a fresh admin JWT and sets it as the httpOnly `admin_session` cookie. */
export function setAdminSessionCookie(res: Response, adminId: string): void {
  const token = jwt.sign({ adminId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  });
}
