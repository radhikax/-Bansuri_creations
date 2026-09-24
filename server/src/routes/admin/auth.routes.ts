import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../db';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAdminAuth, type AdminRequest } from '../../middleware/adminAuth';
import { setAdminSessionCookie } from '../../services/adminSession';

export const adminAuthRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

adminAuthRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  setAdminSessionCookie(res, admin.id);
  res.json({ success: true });
}));

adminAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie('admin_session');
  res.json({ success: true });
});

adminAuthRouter.post('/password', requireAdminAuth, asyncHandler(async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { currentPassword, newPassword } = parsed.data;
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must be different from the current password' });
  }

  const adminId = (req as AdminRequest).adminId!;
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Truncate to the whole second so it compares cleanly with JWT iat.
  const passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), passwordChangedAt },
  });

  setAdminSessionCookie(res, admin.id);
  res.json({ success: true });
}));
