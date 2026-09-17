import { Request, Response } from 'express';
import { prisma } from '../db';
import { verifyWebhookSignature } from '../services/razorpay';
import { sendOrderConfirmationEmail, sendAdminNewOrderEmail } from '../services/email';

export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = (req.body as Buffer).toString();

  if (typeof signature !== 'string' || !verifyWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET!)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const payload = JSON.parse(rawBody);
  if (payload.event !== 'payment.captured') {
    res.status(200).json({ received: true });
    return;
  }

  const razorpayOrderId = payload.payload.payment.entity.order_id;
  const razorpayPaymentId = payload.payload.payment.entity.id;

  const order = await prisma.order.findUnique({ where: { razorpayOrderId }, include: { items: true } });
  if (!order || order.status !== 'PENDING') {
    res.status(200).json({ received: true });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID', razorpayPaymentId, paidAt: new Date() },
    });
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { decrement: item.quantity } },
      });
    }
  });

  const emailData = {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    total: order.total,
    items: order.items,
  };
  await sendOrderConfirmationEmail(emailData);
  await sendAdminNewOrderEmail(emailData);

  res.status(200).json({ received: true });
}
