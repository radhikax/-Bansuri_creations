import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';
import { asyncHandler } from '../../middleware/asyncHandler';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdminAuth);

const orderStatusValues = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

// PENDING and PAID are machine-owned: checkout creates PENDING, and the Razorpay
// webhook is the sole authority that may transition an order to PAID.
const adminSettableStatusValues = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

// Stock is decremented exactly once, by the webhook on PENDING -> PAID. Only orders
// that already passed through that transition may be restocked when cancelled.
const restockableStatuses: readonly string[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

adminOrdersRouter.get('/', asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as (typeof orderStatusValues)[number] } : undefined,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}));

const statusUpdateSchema = z.object({ status: z.enum(adminSettableStatusValues) });

adminOrdersRouter.put('/:id/status', asyncHandler(async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status payload', details: parsed.error.flatten() });
  }

  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const shouldRestock =
    parsed.data.status === 'CANCELLED' && restockableStatuses.includes(order.status);

  await prisma.$transaction(async (tx) => {
    // Compare-and-swap on the exact status we read, so a concurrent writer
    // (e.g. the webhook confirming payment) cannot be clobbered.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: parsed.data.status },
    });
    if (claimed.count === 0) {
      return;
    }
    if (shouldRestock) {
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
}));
