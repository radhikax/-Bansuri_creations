import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SettingsPage } from './SettingsPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultStoreSettings } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('SettingsPage', () => {
  it('loads and prefills the current settings', async () => {
    renderAdminPage(<SettingsPage />);
    expect(await screen.findByLabelText('Flat shipping fee (₹)')).toHaveValue(defaultStoreSettings.flatShippingFee);
    expect(screen.getByLabelText('Free shipping threshold (₹)')).toHaveValue(defaultStoreSettings.freeShippingThreshold);
  });

  it('saves updated settings', async () => {
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/settings`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ id: 1, ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<SettingsPage />);
    await screen.findByLabelText('Flat shipping fee (₹)');

    await user.clear(screen.getByLabelText('Flat shipping fee (₹)'));
    await user.type(screen.getByLabelText('Flat shipping fee (₹)'), '75');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({ flatShippingFee: 75, freeShippingThreshold: defaultStoreSettings.freeShippingThreshold }),
    );
  });

  it('shows the server error inline on save failure', async () => {
    server.use(http.put(`${API_URL}/api/admin/settings`, () => HttpResponse.json({ error: 'Invalid settings payload' }, { status: 400 })));
    const user = userEvent.setup();
    renderAdminPage(<SettingsPage />);
    await screen.findByLabelText('Flat shipping fee (₹)');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Invalid settings payload')).toBeInTheDocument();
  });

  describe('change password', () => {
    async function fillPasswordForm(user: ReturnType<typeof userEvent.setup>, current: string, next: string, confirm: string) {
      await screen.findByLabelText('Current password');
      if (current) await user.type(screen.getByLabelText('Current password'), current);
      if (next) await user.type(screen.getByLabelText('New password'), next);
      if (confirm) await user.type(screen.getByLabelText('Confirm new password'), confirm);
      await user.click(screen.getByRole('button', { name: 'Change password' }));
    }

    it('blocks the request when the confirmation does not match', async () => {
      let called = false;
      server.use(http.post(`${API_URL}/api/admin/password`, () => { called = true; return HttpResponse.json({ success: true }); }));
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'old-password', 'new-password-1', 'new-password-2');
      expect(await screen.findByText('New passwords do not match')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('blocks the request when the new password is shorter than 8 characters', async () => {
      let called = false;
      server.use(http.post(`${API_URL}/api/admin/password`, () => { called = true; return HttpResponse.json({ success: true }); }));
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'old-password', 'short', 'short');
      expect(await screen.findByText('New password must be at least 8 characters')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('blocks the request when a field is empty', async () => {
      let called = false;
      server.use(http.post(`${API_URL}/api/admin/password`, () => { called = true; return HttpResponse.json({ success: true }); }));
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, '', 'new-password-1', 'new-password-1');
      expect(await screen.findByText('Fill in all three password fields')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('shows the server error inline when the current password is wrong', async () => {
      server.use(
        http.post(`${API_URL}/api/admin/password`, () =>
          HttpResponse.json({ error: 'Current password is incorrect' }, { status: 401 }),
        ),
      );
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'wrong-password', 'new-password-1', 'new-password-1');
      expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    });

    it('sends both passwords and clears the form on success', async () => {
      let receivedBody: unknown;
      server.use(
        http.post(`${API_URL}/api/admin/password`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ success: true });
        }),
      );
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'old-password', 'new-password-1', 'new-password-1');
      await waitFor(() => expect(receivedBody).toEqual({ currentPassword: 'old-password', newPassword: 'new-password-1' }));
      await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
      expect(screen.getByLabelText('New password')).toHaveValue('');
      expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
    });
  });
});
