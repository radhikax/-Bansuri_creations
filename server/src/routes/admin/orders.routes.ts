import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { requireAdminAuth } from '../../middleware/adminAuth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { revalidate } from '../../services/revalidate';
import { stockChangeTags } from '../../services/cacheTags';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdminAuth);

type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

// PENDING and PAID are machine-owned: checkout creates PENDING, and the Razorpay
// webhook is the sole authority that may transition an order to PAID.
const adminSettableStatusValues = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

// Stock is decremented exactly once, by the webhook on PENDING -> PAID. Only orders
// that already passed through that transition may be restocked when cancelled.
const restockableStatuses: readonly string[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

// Which admin changes each status allows. CANCELLED is final: reopening it would
// let a second cancel restock the same units again. An unpaid PENDING order can
// only be cancelled; moving it on would hide it from the webhook, which claims
// orders by status=PENDING, so a later payment would never be recorded.
function transitionError(from: OrderStatus, to: string): string | null {
  if (from === 'CANCELLED') return 'A CANCELLED order cannot be changed';
  if (from === 'PENDING' && to !== 'CANCELLED') return 'An unpaid PENDING order can only be cancelled';
  return null;
}

adminOrdersRouter.get('/', asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as OrderStatus } : undefined,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
}));

export const statusUpdateSchema = z.object({ status: z.enum(adminSettableStatusValues) });

adminOrdersRouter.put('/:id/status', asyncHandler(async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid status payload', details: parsed.error.flatten() });
  }

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { productVariant: { select: { product: { select: { slug: true } } } } } } },
  });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const rejected = transitionError(order.status, parsed.data.status);
  if (rejected) {
    return res.status(409).json({ error: rejected });
  }

  const shouldRestock =
    parsed.data.status === 'CANCELLED' && restockableStatuses.includes(order.status);

  const restocked = await prisma.$transaction(async (tx) => {
    // Compare-and-swap on the exact status we read, so a concurrent writer
    // (e.g. the webhook confirming payment) cannot be clobbered.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: parsed.data.status },
    });
    if (claimed.count === 0 || !shouldRestock) {
      return false;
    }
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    return true;
  });

  if (restocked) {
    revalidate(stockChangeTags(order.items));
  }

  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  res.json(updated);
}));
