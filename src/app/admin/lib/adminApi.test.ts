import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  AdminApiError,
  AdminUnauthorizedError,
  adminLogin,
  adminLogout,
  changePassword,
  createAdminCategory,
  createAdminProduct,
  deleteAdminCategory,
  getAdminCategories,
  getAdminOrders,
  getAdminProducts,
  getStoreSettings,
  updateAdminCategory,
  updateAdminOrderStatus,
  updateAdminProduct,
  updateAdminVariant,
  updateStoreSettings,
} from './adminApi';
import { server, defaultAdminOrders, defaultCategories, defaultProducts, defaultStoreSettings } from '../../../test/server';
import { API_URL } from '../../../test/fixtures';

describe('adminApi', () => {
  it('adminLogin posts credentials with cookies included', async () => {
    let receivedBody: unknown;
    let receivedCredentials: RequestCredentials | undefined;
    server.use(
      http.post(`${API_URL}/api/admin/login`, async ({ request }) => {
        receivedBody = await request.json();
        receivedCredentials = request.credentials;
        return HttpResponse.json({ success: true });
      }),
    );
    await adminLogin('admin@example.com', 'pw');
    expect(receivedBody).toEqual({ email: 'admin@example.com', password: 'pw' });
    expect(receivedCredentials).toBe('include');
  });

  it('adminLogin throws AdminApiError (not AdminUnauthorizedError) with the server message on a 401', async () => {
    server.use(
      http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })),
    );
    await expect(adminLogin('admin@example.com', 'wrong')).rejects.toMatchObject({
      message: 'Invalid credentials',
    });
    server.use(http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })));
    await expect(adminLogin('admin@example.com', 'wrong')).rejects.not.toBeInstanceOf(AdminUnauthorizedError);
  });

  it('adminLogout succeeds', async () => {
    await expect(adminLogout()).resolves.toEqual({ success: true });
  });

  it('getStoreSettings returns the settings', async () => {
    await expect(getStoreSettings()).resolves.toEqual(defaultStoreSettings);
  });

  it('updateStoreSettings sends a PUT with the new values', async () => {
    const updated = await updateStoreSettings({ flatShippingFee: 75, freeShippingThreshold: 500 });
    expect(updated.flatShippingFee).toBe(75);
    expect(updated.freeShippingThreshold).toBe(500);
  });

  it('getAdminProducts returns all products', async () => {
    await expect(getAdminProducts()).resolves.toEqual(defaultProducts);
  });

  it('createAdminProduct posts the payload', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/products`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(defaultProducts[0], { status: 201 });
      }),
    );
    await createAdminProduct({
      name: 'New', slug: 'new', description: 'd', categoryId: 'cat-1',
      basePrice: 100, imageUrl: 'u', variants: [{ label: 'Default', stock: 1, sku: 'X' }],
    });
    expect(receivedBody).toMatchObject({ name: 'New', slug: 'new' });
  });

  it('updateAdminProduct sends a PUT to /api/admin/products/:id', async () => {
    let receivedId = '';
    server.use(
      http.put(`${API_URL}/api/admin/products/:id`, async ({ request, params }) => {
        receivedId = String(params.id);
        return HttpResponse.json({ ...defaultProducts[0], ...(await request.json() as object) });
      }),
    );
    await updateAdminProduct('prod-1', { basePrice: 999 });
    expect(receivedId).toBe('prod-1');
  });

  it('updateAdminVariant sends a PUT to the nested variant route', async () => {
    let receivedPath = '';
    server.use(
      http.put(`${API_URL}/api/admin/products/:id/variants/:variantId`, async ({ request, params }) => {
        receivedPath = `${params.id}/${params.variantId}`;
        return HttpResponse.json({ id: params.variantId, ...(await request.json() as object) });
      }),
    );
    await updateAdminVariant('prod-1', 'var-1', { label: 'Default', stock: 5, sku: 'X' });
    expect(receivedPath).toBe('prod-1/var-1');
  });

  it('getAdminCategories returns all categories', async () => {
    await expect(getAdminCategories()).resolves.toEqual(defaultCategories);
  });

  it('createAdminCategory posts the payload', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(`${API_URL}/api/admin/categories`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(defaultCategories[0], { status: 201 });
      }),
    );
    await createAdminCategory({ name: 'N', slug: 'n', description: 'd', imageUrl: 'u', icon: 'i' });
    expect(receivedBody).toEqual({ name: 'N', slug: 'n', description: 'd', imageUrl: 'u', icon: 'i' });
  });

  it('updateAdminCategory sends a partial PUT', async () => {
    const updated = await updateAdminCategory('cat-1', { icon: '🎉' });
    expect(updated.icon).toBe('🎉');
  });

  it('deleteAdminCategory resolves with no content on a 204', async () => {
    await expect(deleteAdminCategory('cat-1')).resolves.toBeUndefined();
  });

  it('getAdminOrders without a status fetches every order', async () => {
    await expect(getAdminOrders()).resolves.toEqual(defaultAdminOrders);
  });

  it('getAdminOrders encodes the status filter in the query string', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${API_URL}/api/admin/orders`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await getAdminOrders('SHIPPED');
    expect(requestedUrl).toBe(`${API_URL}/api/admin/orders?status=SHIPPED`);
  });

  it('updateAdminOrderStatus sends the new status', async () => {
    const updated = await updateAdminOrderStatus(defaultAdminOrders[0].id, 'SHIPPED');
    expect(updated.status).toBe('SHIPPED');
  });

  it('changePassword throws AdminApiError with the server message when the current password is wrong', async () => {
    server.use(
      http.post(`${API_URL}/api/admin/password`, () => HttpResponse.json({ error: 'Current password is incorrect' }, { status: 401 })),
    );
    await expect(changePassword('wrong', 'new-password-1')).rejects.toMatchObject({
      message: 'Current password is incorrect',
    });
    server.use(
      http.post(`${API_URL}/api/admin/password`, () => HttpResponse.json({ error: 'Current password is incorrect' }, { status: 401 })),
    );
    await expect(changePassword('wrong', 'new-password-1')).rejects.toBeInstanceOf(AdminApiError);
  });

  it('changePassword throws AdminUnauthorizedError on a 401 caused by a revoked session', async () => {
    server.use(
      http.post(`${API_URL}/api/admin/password`, () => HttpResponse.json({ error: 'Not authenticated' }, { status: 401 })),
    );
    await expect(changePassword('old-password', 'new-password-1')).rejects.toBeInstanceOf(AdminUnauthorizedError);
  });

  it('throws AdminUnauthorizedError on a 401 from a non-login endpoint', async () => {
    server.use(http.get(`${API_URL}/api/admin/products`, () => new HttpResponse(null, { status: 401 })));
    await expect(getAdminProducts()).rejects.toBeInstanceOf(AdminUnauthorizedError);
  });

  it('throws AdminApiError carrying the response body on a non-401 failure', async () => {
    server.use(
      http.post(`${API_URL}/api/admin/categories`, () =>
        HttpResponse.json({ error: 'Invalid category payload', details: { fieldErrors: { name: ['Required'] } } }, { status: 400 }),
      ),
    );
    let caught: unknown;
    try {
      await createAdminCategory({ name: '', slug: 'n', description: 'd', imageUrl: 'u', icon: 'i' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AdminApiError);
    expect((caught as AdminApiError).message).toBe('Invalid category payload');
    expect((caught as AdminApiError).details).toEqual({ fieldErrors: { name: ['Required'] } });
  });
});
