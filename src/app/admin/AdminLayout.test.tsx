import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { AdminLayout } from './AdminLayout';
import { createAdminQueryClient } from './lib/queryClient';
import { server } from '../../test/server';
import { API_URL } from '../../test/fixtures';

function renderLayout() {
  const queryClient = createAdminQueryClient(() => {});
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<h1>Dashboard</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
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
});
