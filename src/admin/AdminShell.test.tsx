import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { usePathname } from 'next/navigation';
import { AdminShell } from './AdminShell';
import { DashboardPage } from './pages/DashboardPage';
import { routerMock } from '../test/next-mocks';
import { server } from '../test/server';
import { API_URL } from '../test/fixtures';

// usePathname is globally stubbed (src/test/next-mocks.ts) to always return
// '/', which exercises the non-login branch (AdminLayout chrome + the
// bootstrap settings query) by default. Login-branch tests below override it.
afterEach(() => {
  vi.mocked(usePathname).mockReturnValue('/');
  routerMock.replace.mockClear();
});

describe('AdminShell auth guard', () => {
  it('redirects to login when the bootstrap settings check gets a 401', async () => {
    server.use(http.get(`${API_URL}/api/admin/settings`, () => new HttpResponse(null, { status: 401 })));
    render(
      <AdminShell>
        <DashboardPage />
      </AdminShell>,
    );
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/admin/login'));
  });

  it('redirects to login when a query 401s after the bootstrap check already succeeded', async () => {
    server.use(http.get(`${API_URL}/api/admin/products`, () => new HttpResponse(null, { status: 401 })));
    render(
      <AdminShell>
        <DashboardPage />
      </AdminShell>,
    );
    await screen.findByRole('heading', { name: 'Dashboard' });
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/admin/login'));
  });

  it('renders the AdminLayout chrome (nav + logout) around the page for a non-login route', async () => {
    render(
      <AdminShell>
        <DashboardPage />
      </AdminShell>,
    );
    expect(await screen.findByText('Bansuri Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });
});

describe('AdminShell on /admin/login', () => {
  it('renders the login route bare, without the AdminLayout chrome or its bootstrap settings query', async () => {
    vi.mocked(usePathname).mockReturnValue('/admin/login');
    let settingsRequested = false;
    server.use(
      http.get(`${API_URL}/api/admin/settings`, () => {
        settingsRequested = true;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    render(
      <AdminShell>
        <h1>Admin login</h1>
      </AdminShell>,
    );

    expect(await screen.findByRole('heading', { name: 'Admin login' })).toBeInTheDocument();
    expect(screen.queryByText('Bansuri Admin')).not.toBeInTheDocument();
    // Give any stray bootstrap fetch a chance to fire before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settingsRequested).toBe(false);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
