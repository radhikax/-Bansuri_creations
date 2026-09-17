import Razorpay from 'razorpay';
import crypto from 'crypto';

let client: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

export async function createRazorpayOrder(amountInRupees: number, receipt: string): Promise<{ id: string }> {
  const order = await getRazorpayClient().orders.create({
    amount: amountInRupees * 100,
    currency: 'INR',
    receipt,
  });
  return { id: order.id };
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}
