import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { validateStock, computeOrderTotals, resolveUnitPrice, OrderValidationError } from '../services/pricing';
import { generateOrderNumber } from '../services/orderNumber';
import { createRazorpayOrder } from '../services/razorpay';

export const ordersRouter = Router();

const checkoutSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(6),
  customerEmail: z.string().email(),
  addressStreet: z.string().min(1),
  addressCity: z.string().min(1),
  addressState: z.string().min(1),
  addressPincode: z.string().min(1),
  items: z.array(z.object({ variantId: z.string(), quantity: z.number().int().positive() })).min(1),
});

ordersRouter.post('/', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order payload', details: parsed.error.flatten() });
  }
  const data = parsed.data;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { id: { in: data.items.map((i) => i.variantId) } },
        include: { product: true },
      });

      validateStock(data.items, variants);

      const settings = (await tx.storeSettings.findUnique({ where: { id: 1 } })) ?? {
        flatShippingFee: 50,
        freeShippingThreshold: 999,
      };
      const totals = computeOrderTotals(data.items, variants, settings);
      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          addressStreet: data.addressStreet,
          addressCity: data.addressCity,
          addressState: data.addressState,
          addressPincode: data.addressPincode,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          total: totals.total,
          items: {
            create: data.items.map((item) => {
              const variant = variants.find((v) => v.id === item.variantId)!;
              return {
                productVariantId: variant.id,
                productNameSnapshot: variant.product.name,
                variantLabelSnapshot: variant.label,
                unitPrice: resolveUnitPrice(variant),
                quantity: item.quantity,
              };
            }),
          },
        },
      });

      return { order, totals };
    });

    const razorpayOrder = await createRazorpayOrder(created.totals.total, created.order.orderNumber);
    await prisma.order.update({
      where: { id: created.order.id },
      data: { razorpayOrderId: razorpayOrder.id },
    });

    res.status(201).json({
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: created.totals.total,
    });
  } catch (err) {
    if (err instanceof OrderValidationError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

ordersRouter.get('/:orderNumber', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber: req.params.orderNumber },
    include: { items: true },
  });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});
