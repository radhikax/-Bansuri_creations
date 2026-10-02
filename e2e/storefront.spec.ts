import { test, expect, type Page } from '@playwright/test';
import { API_ORIGIN } from './env';

interface ApiVariant { price: number | null }
interface ApiProduct { name: string; slug: string; basePrice: number; variants: ApiVariant[] }
interface ApiCategory { name: string; slug: string }

function cardFor(page: Page, productName: string) {
  // Deepest element that holds both the product's heading and an Add to Cart button.
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { level: 3, name: productName, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Add to Cart' }) })
    .last();
}

test('home page shows the real categories and products', async ({ page, request }) => {
  const categories = (await (await request.get(`${API_ORIGIN}/api/categories`)).json()) as ApiCategory[];
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  expect(categories.length).toBeGreaterThan(0);

  await page.goto('/');
  for (const category of categories) {
    await expect(
      page.locator(`a[href="/category/${category.slug}"]`).getByRole('heading', { name: category.name, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 3, name: products[0].name, exact: true })).toBeVisible();
});

test('add to cart and change the quantity', async ({ page, request }) => {
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  const product = products[0];
  const price = product.variants[0]?.price ?? product.basePrice;

  await page.goto('/');
  await cardFor(page, product.name).getByRole('button', { name: 'Add to Cart' }).click();
  // Adding an item no longer opens the cart itself (only the header's cart
  // button does — see src/components/Cart.test.tsx's AutoOpen comment).
  await page.locator('[data-cart-icon-target]').click();

  const cart = page.getByRole('dialog', { name: /Shopping Cart/ });
  await expect(cart).toBeVisible();
  await expect(cart.getByText(product.name, { exact: true })).toBeVisible();
  const subtotalRow = cart.locator('div').filter({ hasText: 'Subtotal' }).last();
  await expect(cart.getByText(`₹${price}`, { exact: true }).first()).toBeVisible();
  await expect(subtotalRow.getByText(`₹${price}`, { exact: true })).toBeVisible();

  await cart.getByRole('button', { name: 'Increase quantity' }).click();
  // Both the line total and the cart's Subtotal row must double.
  await expect(cart.getByText(`₹${price * 2}`, { exact: true }).first()).toBeVisible();
  await expect(subtotalRow.getByText(`₹${price * 2}`, { exact: true })).toBeVisible();
});

test('a category card shows only that category, and Back returns home', async ({ page, request }) => {
  const categories = (await (await request.get(`${API_ORIGIN}/api/categories`)).json()) as ApiCategory[];
  const category = categories[0];
  const expected = (await (await request.get(`${API_ORIGIN}/api/products?category=${category.slug}`)).json()) as ApiProduct[];

  await page.goto('/');
  await page.locator(`a[href="/category/${category.slug}"]`).filter({ hasText: category.name }).first().click();

  await expect(page).toHaveURL(`/category/${category.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: category.name })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 3 })).toHaveCount(expected.length);
  for (const product of expected) {
    await expect(main.getByRole('heading', { level: 3, name: product.name, exact: true })).toBeVisible();
  }

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator(`a[href="/category/${category.slug}"]`).first()).toBeVisible();
});

test('an unknown category shows the not-found page with a real 404', async ({ page }) => {
  const response = await page.goto('/category/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: "We couldn't find that page" })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to shopping' })).toBeVisible();
});

// Pages are now rendered on the server, so a browser-side API outage can no
// longer blank the catalogue; the only browser-side call left is the product
// page's live-stock refresh. Cutting it must leave the page fully usable.
// (A server-side API failure renders app/(shop)/error.tsx — covered by its unit test.)
test('the storefront stays usable, not blank, when the browser cannot reach the API', async ({ page, request }) => {
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  await page.route('**/api/**', (route) => route.abort());
  await page.goto(`/product/${products[0].slug}`);
  await expect(page.getByRole('heading', { level: 1, name: products[0].name })).toBeVisible();
  await expect(page.getByRole('button', { name: /add to cart/i }).first()).toBeEnabled();
});
