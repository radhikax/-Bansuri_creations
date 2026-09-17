import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';
import { asyncHandler } from '../../middleware/asyncHandler';

export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(requireAdminAuth);

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().min(1),
  icon: z.string().min(1),
});

adminCategoriesRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid category payload', details: parsed.error.flatten() });
  }
  const category = await prisma.category.create({ data: parsed.data });
  res.status(201).json(category);
}));

adminCategoriesRouter.put('/:id', asyncHandler(async (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid category payload', details: parsed.error.flatten() });
  }
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(category);
}));

adminCategoriesRouter.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));
