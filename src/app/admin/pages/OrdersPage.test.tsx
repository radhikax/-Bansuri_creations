import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { OrdersPage } from './OrdersPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultAdminOrders } from '../../../test/server';
import { API_URL, makeAdminOrder } from '../../../test/fixtures';
import { Toaster } from '../../components/ui/sonner';

describe('OrdersPage', () => {
  it('lists orders with order number, customer, total, and status', async () => {
    renderAdminPage(<OrdersPage />);
    const order = defaultAdminOrders[0];
    expect(await screen.findByText(order.orderNumber)).toBeInTheDocument();
    expect(screen.getByText(order.customerName)).toBeInTheDocument();
    expect(screen.getByText(`₹${order.total}`)).toBeInTheDocument();
    expect(screen.getByText(order.status)).toBeInTheDocument();
  });

  it('refetches with the status query param when the filter changes', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${API_URL}/api/admin/orders`, ({ request }) => {
        requestedUrl = request.url;
        const shipped = makeAdminOrder({ id: 'order-2', orderNumber: 'ORD-0002', status: 'SHIPPED' });
        return HttpResponse.json(new URL(request.url).searchParams.get('status') === 'SHIPPED' ? [shipped] : defaultAdminOrders);
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<OrdersPage />);
    await screen.findByText(defaultAdminOrders[0].orderNumber);

    await user.click(screen.getByLabelText('Filter by status'));
    await user.click(screen.getByRole('option', { name: 'SHIPPED' }));

    await waitFor(() => expect(requestedUrl).toBe(`${API_URL}/api/admin/orders?status=SHIPPED`));
    expect(await screen.findByText('ORD-0002')).toBeInTheDocument();
  });

  it('offers only the 4 admin-settable statuses, not PENDING or PAID', async () => {
    const user = userEvent.setup();
    renderAdminPage(<OrdersPage />);
    const order = defaultAdminOrders[0];
    await screen.findByText(order.orderNumber);

    const row = screen.getByText(order.orderNumber).closest('tr')!;
    const button = within(row).getByLabelText(`Change status for ${order.orderNumber}`);
    await user.click(button);
    // Radix UI Select with controlled empty value (value="") requires keyboard to open in test environment
    await user.keyboard('{ArrowDown}');

    expect(await screen.findByRole('option', { name: 'PROCESSING' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'SHIPPED' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'DELIVERED' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'CANCELLED' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PENDING' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PAID' })).not.toBeInTheDocument();
  });

  it('updates an order status', async () => {
    let receivedBody: unknown;
    const order = defaultAdminOrders[0];
    server.use(
      http.put(`${API_URL}/api/admin/orders/:id/status`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...order, status: 'SHIPPED' });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<OrdersPage />);
    await screen.findByText(order.orderNumber);

    const row = screen.getByText(order.orderNumber).closest('tr')!;
    const button = within(row).getByLabelText(`Change status for ${order.orderNumber}`);
    await user.click(button);
    // Radix UI Select with controlled empty value (value="") requires keyboard to open in test environment
    await user.keyboard('{ArrowDown}');
    await user.click(await screen.findByRole('option', { name: 'SHIPPED' }));

    await waitFor(() => expect(receivedBody).toEqual({ status: 'SHIPPED' }));
  });

  it('shows an error toast-worthy message when the status update fails', async () => {
    const order = defaultAdminOrders[0];
    server.use(http.put(`${API_URL}/api/admin/orders/:id/status`, () => HttpResponse.json({ error: 'Order not found' }, { status: 404 })));
    const user = userEvent.setup();
    renderAdminPage(
      <>
        <OrdersPage />
        <Toaster />
      </>,
    );
    await screen.findByText(order.orderNumber);

    const row = screen.getByText(order.orderNumber).closest('tr')!;
    const button = within(row).getByLabelText(`Change status for ${order.orderNumber}`);
    await user.click(button);
    // Radix UI Select with controlled empty value (value="") requires keyboard to open in test environment
    await user.keyboard('{ArrowDown}');
    await user.click(await screen.findByRole('option', { name: 'SHIPPED' }));

    expect(await screen.findByText('Order not found')).toBeInTheDocument();
  });
});
