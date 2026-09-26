import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { API_URL, makeAdminOrder, makeApiCategory, makeApiProduct, makeApiVariant, makeStoreSettings } from './fixtures';

export const defaultCategories = [
  makeApiCategory(),
  makeApiCategory({ id: 'cat-2', name: 'Kanha Dresses', slug: 'kanha-dresses', icon: '👗' }),
];

export const defaultProducts = [
  makeApiProduct(),
  makeApiProduct({
    id: 'prod-2',
    name: 'Kanha Poshak',
    slug: 'kanha-poshak',
    categoryId: 'cat-2',
    category: defaultCategories[1],
    basePrice: 800,
    originalPrice: 1000,
    variants: [
      makeApiVariant({ id: 'v-s', productId: 'prod-2', label: 'Size 1', price: 800, stock: 4 }),
      makeApiVariant({ id: 'v-l', productId: 'prod-2', label: 'Size 2', price: 900, stock: 4 }),
    ],
  }),
];

export const handlers = [
  http.get(`${API_URL}/api/categories`, () => HttpResponse.json(defaultCategories)),
  http.get(`${API_URL}/api/settings/shipping`, () => HttpResponse.json({ flatShippingFee: 50, freeShippingThreshold: 999 })),
  http.get(`${API_URL}/api/products`, ({ request }) => {
    const category = new URL(request.url).searchParams.get('category');
    const list = category ? defaultProducts.filter((p) => p.category.slug === category) : defaultProducts;
    return HttpResponse.json(list);
  }),
  http.get(`${API_URL}/api/products/:slug`, ({ params }) => {
    const found = defaultProducts.find((p) => p.slug === params.slug);
    return found ? HttpResponse.json(found) : new HttpResponse(null, { status: 404 });
  }),
];

export const defaultStoreSettings = makeStoreSettings();
export const defaultAdminOrders = [makeAdminOrder()];

export const adminHandlers = [
  http.post(`${API_URL}/api/admin/login`, () => HttpResponse.json({ success: true })),
  http.post(`${API_URL}/api/admin/logout`, () => HttpResponse.json({ success: true })),
  http.post(`${API_URL}/api/admin/password`, () => HttpResponse.json({ success: true })),
  http.get(`${API_URL}/api/admin/settings`, () => HttpResponse.json(defaultStoreSettings)),
  http.put(`${API_URL}/api/admin/settings`, async ({ request }) =>
    HttpResponse.json({ ...defaultStoreSettings, ...(await request.json() as object) }),
  ),
  http.get(`${API_URL}/api/admin/products`, () => HttpResponse.json(defaultProducts)),
  http.post(`${API_URL}/api/admin/products`, async ({ request }) =>
    HttpResponse.json({ ...defaultProducts[0], ...(await request.json() as object) }, { status: 201 }),
  ),
  http.put(`${API_URL}/api/admin/products/:id`, async ({ request, params }) => {
    const found = defaultProducts.find((p) => p.id === params.id) ?? defaultProducts[0];
    return HttpResponse.json({ ...found, ...(await request.json() as object) });
  }),
  http.put(`${API_URL}/api/admin/products/:id/variants/:variantId`, async ({ request, params }) =>
    HttpResponse.json({
      id: params.variantId,
      productId: params.id,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...(await request.json() as object),
    }),
  ),
  http.get(`${API_URL}/api/admin/categories`, () => HttpResponse.json(defaultCategories)),
  http.post(`${API_URL}/api/admin/categories`, async ({ request }) =>
    HttpResponse.json({ ...defaultCategories[0], ...(await request.json() as object) }, { status: 201 }),
  ),
  http.put(`${API_URL}/api/admin/categories/:id`, async ({ request, params }) => {
    const found = defaultCategories.find((c) => c.id === params.id) ?? defaultCategories[0];
    return HttpResponse.json({ ...found, ...(await request.json() as object) });
  }),
  http.delete(`${API_URL}/api/admin/categories/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_URL}/api/admin/orders`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    const list = status ? defaultAdminOrders.filter((o) => o.status === status) : defaultAdminOrders;
    return HttpResponse.json(list);
  }),
  http.put(`${API_URL}/api/admin/orders/:id/status`, async ({ request, params }) => {
    const found = defaultAdminOrders.find((o) => o.id === params.id) ?? defaultAdminOrders[0];
    const body = (await request.json()) as { status: string };
    return HttpResponse.json({ ...found, status: body.status });
  }),
];

export const server = setupServer(...handlers, ...adminHandlers);
