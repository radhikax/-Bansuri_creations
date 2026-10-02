import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { makeApiCategory, makeApiProduct } from '../test/fixtures';

// `catalogue.ts` starts with `import 'server-only'`, which throws outside a
// real Server Component. Mock it with an empty module so it can be imported
// here, the way Next itself swaps it for `server-only/empty.js` under the
// `react-server` condition. vitest hoists `vi.mock` above the import below.
vi.mock('server-only', () => ({}));

import { getCategories, getProducts, getProductBySlug, getCategoryBySlug } from './catalogue';

// serverApi talks to Express directly (src/lib/api/client.ts), not through
// the browser-origin MSW fixtures in src/test/server.ts.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/** The `next` extension openapi-fetch stamps directly onto the Request it passes to `fetch`. */
function lastFetchNext(spy: { mock: { calls: unknown[][] } }) {
  const [request] = spy.mock.calls.at(-1) as [{ next?: unknown }];
  return request.next;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getCategories', () => {
  it('adapts the category list and tags it for revalidation', async () => {
    const category = makeApiCategory();
    server.use(http.get(`${API_INTERNAL_URL}/api/categories`, () => HttpResponse.json([category])));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await getCategories();

    expect(result).toEqual([
      { title: category.name, description: category.description, image: category.imageUrl, icon: category.icon, slug: category.slug },
    ]);
    expect(lastFetchNext(fetchSpy)).toEqual({ revalidate: 300, tags: ['catalogue'] });
  });

  it('throws on an API error', async () => {
    server.use(http.get(`${API_INTERNAL_URL}/api/categories`, () => new HttpResponse(null, { status: 500 })));
    await expect(getCategories()).rejects.toThrow();
  });
});

describe('getProducts', () => {
  it('adapts the product list and tags it for revalidation', async () => {
    const product = makeApiProduct();
    server.use(http.get(`${API_INTERNAL_URL}/api/products`, () => HttpResponse.json([product])));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await getProducts();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: product.id, slug: product.slug });
    expect(lastFetchNext(fetchSpy)).toEqual({ revalidate: 300, tags: ['catalogue'] });
  });
});

describe('getProductBySlug', () => {
  it('returns null on a 404', async () => {
    server.use(http.get(`${API_INTERNAL_URL}/api/products/:slug`, () => new HttpResponse(null, { status: 404 })));
    await expect(getProductBySlug('missing')).resolves.toBeNull();
  });

  it('throws on a 500', async () => {
    server.use(http.get(`${API_INTERNAL_URL}/api/products/:slug`, () => new HttpResponse(null, { status: 500 })));
    await expect(getProductBySlug('brass-diya')).rejects.toThrow();
  });

  it('returns { product, raw } on success, tagged for this slug', async () => {
    const product = makeApiProduct({ slug: 'brass-diya' });
    server.use(http.get(`${API_INTERNAL_URL}/api/products/:slug`, () => HttpResponse.json(product)));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const found = await getProductBySlug('brass-diya');

    expect(found).not.toBeNull();
    expect(found?.raw).toEqual(product);
    expect(found?.product.slug).toBe('brass-diya');
    expect(lastFetchNext(fetchSpy)).toEqual({ revalidate: 300, tags: ['catalogue', 'product:brass-diya'] });
  });
});

describe('getCategoryBySlug', () => {
  it('returns null for an unknown slug', async () => {
    server.use(http.get(`${API_INTERNAL_URL}/api/categories`, () => HttpResponse.json([makeApiCategory({ slug: 'diwali-decor' })])));
    await expect(getCategoryBySlug('nope')).resolves.toBeNull();
  });

  it('returns the matching category, tagged for this slug', async () => {
    const category = makeApiCategory({ slug: 'diwali-decor' });
    server.use(http.get(`${API_INTERNAL_URL}/api/categories`, () => HttpResponse.json([category])));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const found = await getCategoryBySlug('diwali-decor');

    expect(found?.slug).toBe('diwali-decor');
    expect(lastFetchNext(fetchSpy)).toEqual({ revalidate: 300, tags: ['catalogue', 'category:diwali-decor'] });
  });
});
