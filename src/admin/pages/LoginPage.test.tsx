import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { LoginPage } from './LoginPage';
import { renderAdminPage } from '../../test/renderAdmin';
import { routerMock } from '../../test/next-mocks';
import { server } from '../../test/server';
import { API_URL } from '../../test/fixtures';

afterEach(() => {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
});

describe('LoginPage', () => {
  it('logs in and navigates to the dashboard', async () => {
    const user = userEvent.setup();
    renderAdminPage(<LoginPage />);
    expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/admin'));
  });

  it('shows an inline error for wrong credentials without redirecting to login', async () => {
    server.use(http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })));
    const user = userEvent.setup();
    renderAdminPage(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('shows a fallback message for a network-level login failure', async () => {
    server.use(http.post(`${API_URL}/api/admin/login`, () => HttpResponse.error()));
    const user = userEvent.setup();
    renderAdminPage(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Could not reach the server, please try again.')).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
