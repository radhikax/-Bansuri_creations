import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdminAuth);

adminSettingsRouter.get('/', async (_req, res) => {
  const settings = await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, flatShippingFee: 50, freeShippingThreshold: 999 },
  });
  res.json(settings);
});

const settingsSchema = z.object({
  flatShippingFee: z.number().int().min(0),
  freeShippingThreshold: z.number().int().min(0),
});

adminSettingsRouter.put('/', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.flatten() });
  }
  const settings = await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });
  res.json(settings);
});
