import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { getShippingConfig } from '../services/shippingConfig';

export const settingsRouter = Router();

// Public and read-only: the storefront cart shows the same shipping the order route will charge.
settingsRouter.get('/shipping', asyncHandler(async (_req, res) => {
  res.json(await getShippingConfig(prisma));
}));
