import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { API_URL, makeApiCategory, makeApiProduct, makeApiVariant } from './fixtures';

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

export const server = setupServer(...handlers);
