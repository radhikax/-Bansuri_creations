import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const ordersCreateMock = vi.fn();

vi.mock('razorpay', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      orders: { create: ordersCreateMock },
    })),
  };
});

import { createRazorpayOrder, verifyWebhookSignature } from '../../src/services/razorpay';

describe('createRazorpayOrder', () => {
  beforeEach(() => {
    ordersCreateMock.mockReset();
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  });

  it('converts rupees to paise when calling Razorpay', async () => {
    ordersCreateMock.mockResolvedValue({ id: 'order_abc123' });

    const result = await createRazorpayOrder(550, 'ORD-TEST1');

    expect(ordersCreateMock).toHaveBeenCalledWith({
      amount: 55000,
      currency: 'INR',
      receipt: 'ORD-TEST1',
    });
    expect(result).toEqual({ id: 'order_abc123' });
  });
});

describe('verifyWebhookSignature', () => {
  it('returns true for a matching signature', () => {
    const secret = 'whsec_test';
    const body = '{"event":"payment.captured"}';
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('returns false for a mismatched signature', () => {
    expect(verifyWebhookSignature('{"event":"x"}', 'bad-signature', 'whsec_test')).toBe(false);
  });
});
