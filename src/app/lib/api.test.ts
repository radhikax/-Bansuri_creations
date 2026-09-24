import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { getCategories, getProductBySlug, getProducts, REQUEST_TIMEOUT_MS } from './api';
import { server, defaultCategories, defaultProducts } from '../../test/server';
import { API_URL } from '../../test/fixtures';

describe('api client', () => {
  it('getCategories returns the parsed list', async () => {
    const categories = await getCategories();
    expect(categories.map((c) => c.slug)).toEqual(defaultCategories.map((c) => c.slug));
  });

  it('getProducts without a filter requests all products', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${API_URL}/api/products`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await getProducts();
    expect(requestedUrl).toBe(`${API_URL}/api/products`);
  });

  it('getProducts encodes the category slug in the query string', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${API_URL}/api/products`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await getProducts('a&b c');
    expect(requestedUrl).toBe(`${API_URL}/api/products?category=a%26b%20c`);
  });

  it('getProductBySlug returns the matching product', async () => {
    const product = await getProductBySlug('kanha-poshak');
    expect(product.id).toBe(defaultProducts[1].id);
  });

  it('throws an error naming the path and status on a non-ok response', async () => {
    await expect(getProductBySlug('missing')).rejects.toThrow(
      'Request to /api/products/missing failed with status 404',
    );
  });

  it('throws on a server error', async () => {
    server.use(http.get(`${API_URL}/api/categories`, () => new HttpResponse(null, { status: 500 })));
    await expect(getCategories()).rejects.toThrow('status 500');
  });
});

describe('request timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects with a timeout error when the API does not answer in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // A fetch that never settles, standing in for a hung backend.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    const request = getCategories();
    const assertion = expect(request).rejects.toThrow('Request to /api/categories timed out');
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
  });
});
