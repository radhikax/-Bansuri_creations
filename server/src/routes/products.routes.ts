import { Router } from 'express';
import { prisma } from '../db';

export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: { variants: true, category: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
});
