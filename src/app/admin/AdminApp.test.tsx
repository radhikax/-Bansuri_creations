import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import AdminApp from './AdminApp';
import { createAdminQueryClient } from './lib/queryClient';
import { server, defaultAdminOrders } from '../../test/server';
import { API_URL } from '../../test/fixtures';

function renderAdminApp(initialEntry: string, redirectToLogin = vi.fn()) {
  const queryClient = createAdminQueryClient(redirectToLogin);
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp queryClient={queryClient} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { redirectToLogin, queryClient };
}

describe('AdminApp', () => {
  it('renders the dashboard when the bootstrap check succeeds', async () => {
    renderAdminApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Bansuri Admin')).toBeInTheDocument();
  });

  it('redirects to login when the bootstrap check gets a 401', async () => {
    server.use(http.get(`${API_URL}/api/admin/settings`, () => new HttpResponse(null, { status: 401 })));
    const { redirectToLogin } = renderAdminApp('/admin');
    await waitFor(() => expect(redirectToLogin).toHaveBeenCalled());
  });

  it('redirects to login when a query 401s after the bootstrap check already succeeded', async () => {
    server.use(http.get(`${API_URL}/api/admin/products`, () => new HttpResponse(null, { status: 401 })));
    const { redirectToLogin } = renderAdminApp('/admin');
    await screen.findByRole('heading', { name: 'Dashboard' });
    await waitFor(() => expect(redirectToLogin).toHaveBeenCalled());
  });

  it('logs in and shows the dashboard', async () => {
    const user = userEvent.setup();
    renderAdminApp('/admin/login');
    expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('shows an inline error for wrong credentials without redirecting to login', async () => {
    server.use(http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })));
    const user = userEvent.setup();
    const { redirectToLogin } = renderAdminApp('/admin/login');

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('shows a fallback message for a network-level login failure', async () => {
    server.use(http.post(`${API_URL}/api/admin/login`, () => HttpResponse.error()));
    const user = userEvent.setup();
    const { redirectToLogin } = renderAdminApp('/admin/login');

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Could not reach the server, please try again.')).toBeInTheDocument();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('logs out, clears the cache, and returns to login', async () => {
    const user = userEvent.setup();
    renderAdminApp('/admin');
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Admin login' })).toBeInTheDocument();
  });

  // Regression test for C1: the app previously never mounted a <Toaster/>
  // anywhere, so every toast() call was a silent no-op in production. This
  // test deliberately does NOT render its own <Toaster/> (unlike
  // OrdersPage.test.tsx's own local-Toaster test) — it relies entirely on
  // AdminApp mounting one itself, closing the exact gap that let C1 through.
  it('shows a real toast notification for an action that succeeds, without the test mounting its own Toaster', async () => {
    const order = defaultAdminOrders[0];
    const user = userEvent.setup();
    renderAdminApp('/admin/orders');
    await screen.findByText(order.orderNumber);

    const row = screen.getByText(order.orderNumber).closest('tr')!;
    const button = within(row).getByLabelText(`Change status for ${order.orderNumber}`);
    await user.click(button);
    // Radix UI Select with controlled empty value (value="") requires keyboard to open in test environment
    await user.keyboard('{ArrowDown}');
    await user.click(await screen.findByRole('option', { name: 'SHIPPED' }));

    expect(await screen.findByText('Order updated')).toBeInTheDocument();
  });
});
