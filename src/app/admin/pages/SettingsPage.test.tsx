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
});
