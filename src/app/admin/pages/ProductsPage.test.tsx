import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProductsPage } from './ProductsPage';
import { renderAdminPage } from '../../../test/renderAdmin';
import { server, defaultProducts, defaultCategories } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('ProductsPage', () => {
  it('lists every product with its category and price', async () => {
    renderAdminPage(<ProductsPage />);
    expect(await screen.findByText(defaultProducts[0].name)).toBeInTheDocument();
    expect(screen.getByText(defaultProducts[1].name)).toBeInTheDocument();
    expect(screen.getByText(defaultProducts[0].category.name)).toBeInTheDocument();
  });

  it('creates a product with one default variant', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/products`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultProducts[0], ...(receivedBody as object) }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    await user.click(screen.getByRole('button', { name: '+ New product' }));
    await user.type(screen.getByLabelText('Name'), 'Brass Urli');
    await user.type(screen.getByLabelText('Slug'), 'brass-urli');
    await user.type(screen.getByLabelText('Description'), 'A brass urli bowl');
    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: defaultCategories[0].name }));
    await user.type(screen.getByLabelText('Base price (₹)'), '650');
    await user.type(screen.getByLabelText('Cover image URL'), 'https://img.test/urli.jpg');
    await user.type(screen.getByLabelText('Gallery image URLs (one per line)'), 'https://img.test/urli.jpg\nhttps://img.test/urli2.jpg');
    await user.type(screen.getByLabelText('Default variant stock'), '10');
    await user.type(screen.getByLabelText('Default variant SKU'), 'URL-001');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(receivedBody).toEqual({
        name: 'Brass Urli',
        slug: 'brass-urli',
        description: 'A brass urli bowl',
        categoryId: defaultCategories[0].id,
        basePrice: 650,
        imageUrl: 'https://img.test/urli.jpg',
        images: ['https://img.test/urli.jpg', 'https://img.test/urli2.jpg'],
        variants: [{ label: 'Default', stock: 10, sku: 'URL-001' }],
      }),
    );
  });

  it('edits a product, prefilling its current values, with no variant fields shown', async () => {
    let receivedId = '';
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/products/:id`, async ({ request, params }) => {
        receivedId = String(params.id);
        receivedBody = await request.json();
        return HttpResponse.json({ ...defaultProducts[0], ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    const row = screen.getByText(defaultProducts[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Name')).toHaveValue(defaultProducts[0].name);
    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Default variant stock')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Base price (₹)'));
    await user.type(screen.getByLabelText('Base price (₹)'), '999');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(receivedId).toBe(defaultProducts[0].id));
    expect(receivedBody).toMatchObject({ basePrice: 999 });
  });

  it('shows the variant sub-table and saves an edited variant', async () => {
    let receivedPath = '';
    let receivedBody: unknown;
    server.use(
      http.put(`${API_URL}/api/admin/products/:id/variants/:variantId`, async ({ request, params }) => {
        receivedPath = `${params.id}/${params.variantId}`;
        receivedBody = await request.json();
        return HttpResponse.json({ id: params.variantId, ...(receivedBody as object) });
      }),
    );
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    const row = screen.getByText(defaultProducts[0].name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Variants' }));

    const variant = defaultProducts[0].variants[0];
    expect(await screen.findByText(variant.sku)).toBeInTheDocument();

    // The sub-table renders in a sibling <tr>, not inside `row` — scope to it
    // so this doesn't collide with the other products' row-level Edit buttons.
    const subTableRow = row.nextElementSibling as HTMLElement;
    await user.click(within(subTableRow).getByRole('button', { name: 'Edit' }));
    const stockInput = screen.getByLabelText(`Stock for ${variant.sku}`);
    await user.clear(stockInput);
    await user.type(stockInput, '25');
    await user.click(within(subTableRow).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(receivedPath).toBe(`${defaultProducts[0].id}/${variant.id}`));
    expect(receivedBody).toMatchObject({ stock: 25, sku: variant.sku });
  });

  it('shows the server validation error inline on create', async () => {
    server.use(http.post(`${API_URL}/api/admin/products`, () => HttpResponse.json({ error: 'Invalid product payload' }, { status: 400 })));
    const user = userEvent.setup();
    renderAdminPage(<ProductsPage />);
    await screen.findByText(defaultProducts[0].name);

    await user.click(screen.getByRole('button', { name: '+ New product' }));
    await user.type(screen.getByLabelText('Name'), 'X');
    await user.type(screen.getByLabelText('Slug'), 'x');
    await user.type(screen.getByLabelText('Description'), 'd');
    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: defaultCategories[0].name }));
    await user.type(screen.getByLabelText('Base price (₹)'), '1');
    await user.type(screen.getByLabelText('Cover image URL'), 'u');
    await user.type(screen.getByLabelText('Default variant stock'), '1');
    await user.type(screen.getByLabelText('Default variant SKU'), 'X-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Invalid product payload')).toBeInTheDocument();
  });
});
