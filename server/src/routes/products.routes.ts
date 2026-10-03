import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';

export const productsRouter = Router();

productsRouter.get('/', asyncHandler(async (req, res) => {
  const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: { variants: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }, category: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
}));

productsRouter.get('/:slug', asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { variants: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }, category: true },
  });
  if (!product || !product.isActive) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
}));
