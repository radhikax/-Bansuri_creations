import { test, expect, type APIRequestContext } from '@playwright/test';
import { API_ORIGIN, CHANGED_ADMIN_PASSWORD, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from './env';

interface ApiVariant { price: number | null }
interface ApiProduct { id: string; name: string; slug: string; basePrice: number; variants: ApiVariant[] }

function priceOf(product: ApiProduct): number {
  return product.variants[0]?.price ?? product.basePrice;
}

async function getProducts(request: APIRequestContext): Promise<ApiProduct[]> {
  return (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
}

/**
 * Logs in with the seed password, falling back to the password admin.spec.ts
 * changes it to. Playwright doesn't guarantee this file runs before
 * admin.spec.ts (both workers: 1 and alphabetical order would in fact run
 * admin.spec.ts first), and that test never restores the seed password — so
 * this makes the login independent of which one already ran, rather than
 * relying on a fragile cross-file run order.
 */
async function loginAsAdmin(request: APIRequestContext): Promise<void> {
  const first = await request.post(`${API_ORIGIN}/api/admin/login`, {
    data: { email: SEED_ADMIN_EMAIL, password: SEED_ADMIN_PASSWORD },
  });
  if (first.ok()) return;

  const retry = await request.post(`${API_ORIGIN}/api/admin/login`, {
    data: { email: SEED_ADMIN_EMAIL, password: CHANGED_ADMIN_PASSWORD },
  });
  if (!retry.ok()) throw new Error('Could not log in with either the seed or the changed admin password');
}

test('a product page renders the name, price and Product JSON-LD without JavaScript', async ({ request }) => {
  const products = await getProducts(request);
  const product = products[0];

  // React separates adjacent text nodes in server HTML with <!-- --> markers
  // (e.g. "₹<!-- -->1299"); crawlers read the text as one string, so drop them.
  const body = (await (await request.get(`/product/${product.slug}`)).text()).replaceAll('<!-- -->', '');
  expect(body).toContain(product.name);
  expect(body).toContain(`₹${priceOf(product)}`);
  expect(body).toContain('<script type="application/ld+json">');
  expect(body).toContain('"@type":"Product"');
});

test('the sitemap lists every product', async ({ request }) => {
  const products = await getProducts(request);
  const body = await (await request.get('/sitemap.xml')).text();
  for (const product of products) {
    expect(body).toContain(`/product/${product.slug}`);
  }
});

test('robots.txt disallows the admin panel', async ({ request }) => {
  const body = await (await request.get('/robots.txt')).text();
  expect(body).toContain('Disallow: /admin');
});

test('an unknown product slug 404s', async ({ request }) => {
  const response = await request.get('/product/does-not-exist');
  expect(response.status()).toBe(404);
});

test('an admin product rename shows up on the product page within 10s', async ({ request }) => {
  const products = await getProducts(request);
  const product = products[0];
  const originalName = product.name;
  const newName = `${originalName} (e2e edited)`;

  await loginAsAdmin(request);

  try {
    const putRes = await request.put(`${API_ORIGIN}/api/admin/products/${product.id}`, {
      data: { name: newName },
    });
    expect(putRes.ok()).toBe(true);

    // The API's revalidate call to the web app is fire-and-forget (see
    // server/src/services/revalidate.ts), so poll instead of expecting the
    // very next request to already carry the new name.
    const deadline = Date.now() + 10_000;
    let body = '';
    while (Date.now() < deadline) {
      body = await (await request.get(`/product/${product.slug}`)).text();
      if (body.includes(newName)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    expect(body).toContain(newName);
  } finally {
    const restoreRes = await request.put(`${API_ORIGIN}/api/admin/products/${product.id}`, {
      data: { name: originalName },
    });
    expect(restoreRes.ok()).toBe(true);
  }
});
