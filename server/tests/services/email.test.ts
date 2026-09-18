import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn().mockResolvedValue({ id: 'email_123' });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendOrderConfirmationEmail, sendAdminNewOrderEmail, OrderEmailData } from '../../src/services/email';

const sampleOrder: OrderEmailData = {
  orderNumber: 'ORD-TEST1',
  customerName: 'Test Customer',
  customerEmail: 'customer@example.com',
  total: 1050,
  items: [{ productNameSnapshot: 'Diwali Diyas Set', variantLabelSnapshot: 'Default', quantity: 2, unitPrice: 499 }],
};

describe('email service', () => {
  beforeEach(() => {
    sendMock.mockClear();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.STORE_EMAIL_FROM = 'orders@example.com';
    process.env.STORE_OWNER_EMAIL = 'owner@example.com';
  });

  it('sends a confirmation email to the customer', async () => {
    await sendOrderConfirmationEmail(sampleOrder);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'customer@example.com', subject: expect.stringContaining('ORD-TEST1') })
    );
  });

  it('sends an alert email to the store owner', async () => {
    await sendAdminNewOrderEmail(sampleOrder);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com', subject: expect.stringContaining('ORD-TEST1') })
    );
  });
});
