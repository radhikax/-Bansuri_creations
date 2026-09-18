import { Resend } from 'resend';

let client: Resend | null = null;

function getResendClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY!);
  }
  return client;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  items: { productNameSnapshot: string; variantLabelSnapshot: string; quantity: number; unitPrice: number }[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOrderEmailHtml(data: OrderEmailData): string {
  const rows = data.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.productNameSnapshot)} (${escapeHtml(item.variantLabelSnapshot)})</td><td>${item.quantity}</td><td>Rs. ${item.unitPrice}</td></tr>`
    )
    .join('');
  return `<h2>Order ${data.orderNumber}</h2><p>${escapeHtml(data.customerName)}</p><table>${rows}</table><p>Total: Rs. ${data.total}</p>`;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  await getResendClient().emails.send({
    from: process.env.STORE_EMAIL_FROM!,
    to: data.customerEmail,
    subject: `Order Confirmed - ${data.orderNumber}`,
    html: renderOrderEmailHtml(data),
  });
}

export async function sendAdminNewOrderEmail(data: OrderEmailData): Promise<void> {
  await getResendClient().emails.send({
    from: process.env.STORE_EMAIL_FROM!,
    to: process.env.STORE_OWNER_EMAIL!,
    subject: `New Order - ${data.orderNumber}`,
    html: renderOrderEmailHtml(data),
  });
}
