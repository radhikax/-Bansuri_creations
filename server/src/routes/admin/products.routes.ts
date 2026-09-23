import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';
import { asyncHandler } from '../../middleware/asyncHandler';

export const adminProductsRouter = Router();
adminProductsRouter.use(requireAdminAuth);

adminProductsRouter.get('/', asyncHandler(async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { variants: true, category: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
}));

const variantSchema = z.object({
  label: z.string().min(1),
  price: z.number().int().positive().optional(),
  stock: z.number().int().min(0),
  sku: z.string().min(1),
});

const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().min(1),
  basePrice: z.number().int().positive(),
  originalPrice: z.number().int().positive().optional(),
  imageUrl: z.string().min(1),
  images: z.array(z.string().min(1)).optional(),
  variants: z.array(variantSchema).min(1),
});

adminProductsRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product payload', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      categoryId: data.categoryId,
      basePrice: data.basePrice,
      originalPrice: data.originalPrice,
      imageUrl: data.imageUrl,
      // Mirrors prisma/seed.ts: every product keeps at least its cover image in the gallery.
      images: data.images && data.images.length > 0 ? data.images : [data.imageUrl],
      variants: { create: data.variants },
    },
    include: { variants: true },
  });

  res.status(201).json(product);
}));

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  basePrice: z.number().int().positive().optional(),
  originalPrice: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().min(1).optional(),
  images: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
});

adminProductsRouter.put('/:id', asyncHandler(async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid product payload', details: parsed.error.flatten() });
  }

  const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(product);
}));

const upsertVariantSchema = variantSchema.extend({ id: z.string().optional() });

adminProductsRouter.put('/:id/variants/:variantId', asyncHandler(async (req, res) => {
  const parsed = upsertVariantSchema.safeParse({ ...req.body, id: req.params.variantId });
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid variant payload', details: parsed.error.flatten() });
  }

  const variant = await prisma.productVariant.update({
    where: { id: req.params.variantId },
    data: {
      label: parsed.data.label,
      price: parsed.data.price,
      stock: parsed.data.stock,
      sku: parsed.data.sku,
    },
  });
  res.json(variant);
}));
