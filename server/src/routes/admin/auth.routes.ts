import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../db';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAdminAuth, type AdminRequest } from '../../middleware/adminAuth';
import { setAdminSessionCookie } from '../../services/adminSession';

export const adminAuthRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

// Brute-force limits, keyed per account rather than per IP: requests reach the
// API through the Next.js server, which doesn't forward the client's address,
// so every visitor would share one IP (and X-Forwarded-For can be spoofed).
// Only failed attempts count. The cost: someone who knows the admin email can
// lock that account out for one window, which beats unlimited guessing.
const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 10;

function failedAttemptLimiter(key: (req: Request) => string, error: string) {
  return rateLimit({
    windowMs: FAILED_ATTEMPT_WINDOW_MS,
    limit: MAX_FAILED_ATTEMPTS,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: key,
    handler: (_req, res) => res.status(429).json({ error }),
  });
}

const loginLimiter = failedAttemptLimiter(
  (req) => `login:${String((req.body as { email?: unknown })?.email ?? '').trim().toLowerCase()}`,
  'Too many login attempts. Try again in 15 minutes.',
);

// Runs after requireAdminAuth, so adminId is set.
const passwordLimiter = failedAttemptLimiter(
  (req) => `password:${(req as AdminRequest).adminId}`,
  'Too many password attempts. Try again in 15 minutes.',
);

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

adminAuthRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
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

adminAuthRouter.post('/password', requireAdminAuth, passwordLimiter, asyncHandler(async (req, res) => {
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
