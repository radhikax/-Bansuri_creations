import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { CategoriesPage } from './CategoriesPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultCategories } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('CategoriesPage', () => {
  it('lists every category', async () => {
    renderAdminPage(<CategoriesPage />);
    expect(await screen.findByText(defaultCategories[0].name)).toBeInTheDocument();
    expect(screen.getByText(defaultCategories[1].name)).toBeInTheDocument();
  });

  it('shows an error message instead of an empty table when the list fetch fails', async () => {
    server.use(http.get(`${API_URL}/api/admin/categories`, () => new HttpResponse(null, { status: 500 })));
    renderAdminPage(<CategoriesPage />);

    expect(await screen.findByText("Couldn't load categories, please try again.")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('creates a category', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/categories`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultCategories[0], ...(receivedBody as object) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    await user.click(screen.getByRole('button', { name: '+ New category' }));
    await user.type(screen.getByLabelText('Name'), 'Holi Colors');
    await user.type(screen.getByLabelText('Slug'), 'holi-colors');
    await user.type(screen.getByLabelText('Description'), 'Colors and pichkaris');
    await user.type(screen.getByLabelText('Image URL'), 'https://img.test/holi.jpg');
    await user.type(screen.getByLabelText('Icon (emoji)'), '🎨');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        name: 'Holi Colors', slug: 'holi-colors', description: 'Colors and pichkaris',
        imageUrl: 'https://img.test/holi.jpg', icon: '🎨',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits a category, prefilling the current values', async () => {
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/categories/:id`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultCategories[0], ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    const row = screen.getByText(defaultCategories[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Name')).toHaveValue(defaultCategories[0].name);
    await user.clear(screen.getByLabelText('Icon (emoji)'));
    await user.type(screen.getByLabelText('Icon (emoji)'), '🌟');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(receivedBody).toMatchObject({ icon: '🌟' }));
  });

  it('shows the server validation error inline', async () => {
    server.use(http.post(`${API_URL}/api/admin/categories`, () => HttpResponse.json({ error: 'Invalid category payload' }, { status: 400 })));
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    await user.click(screen.getByRole('button', { name: '+ New category' }));
    await user.type(screen.getByLabelText('Name'), 'X');
    await user.type(screen.getByLabelText('Slug'), 'x');
    await user.type(screen.getByLabelText('Description'), 'd');
    await user.type(screen.getByLabelText('Image URL'), 'u');
    await user.type(screen.getByLabelText('Icon (emoji)'), 'i');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Invalid category payload')).toBeInTheDocument();
  });

  it('deletes a category after confirming', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${API_URL}/api/admin/categories/:id`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<CategoriesPage />);
    await screen.findByText(defaultCategories[0].name);

    const row = screen.getByText(defaultCategories[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete', description: undefined }));

    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});
