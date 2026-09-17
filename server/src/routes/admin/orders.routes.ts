import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdminAuth);

const orderStatusValues = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

adminOrdersRouter.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as (typeof orderStatusValues)[number] } : undefined,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

const statusUpdateSchema = z.object({ status: z.enum(orderStatusValues) });

adminOrdersRouter.put('/:id/status', async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status payload', details: parsed.error.flatten() });
  }

  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: { not: parsed.data.status } },
      data: { status: parsed.data.status },
    });
    if (claimed.count === 0) {
      return;
    }
    if (parsed.data.status === 'CANCELLED') {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  });

  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  res.json(updated);
});
