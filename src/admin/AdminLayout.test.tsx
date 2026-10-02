import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { AdminLayout } from './AdminLayout';
import { createAdminQueryClient } from './lib/queryClient';
import { routerMock } from '../test/next-mocks';
import { server } from '../test/server';
import { API_URL } from '../test/fixtures';

function renderLayout() {
  const queryClient = createAdminQueryClient(() => {});
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminLayout>
        <h1>Dashboard</h1>
      </AdminLayout>
    </QueryClientProvider>,
  );
}

describe('AdminLayout', () => {
  it('shows an error message and retry button (not a blank page) on a non-401 bootstrap failure', async () => {
    let callCount = 0;
    server.use(
      http.get(`${API_URL}/api/admin/settings`, () => {
        callCount += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderLayout();

    expect(await screen.findByText("Couldn't load the admin panel, please try again.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(callCount).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(callCount).toBe(2));
  });

  it('logs out and navigates to the login page', async () => {
    const user = userEvent.setup();
    renderLayout();
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/admin/login'));
  });
});
