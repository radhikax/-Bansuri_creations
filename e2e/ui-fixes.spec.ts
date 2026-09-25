import { test, expect, type Page } from '@playwright/test';
import { API_ORIGIN } from './env';

interface ApiVariant { price: number | null }
interface ApiProduct { name: string; slug: string; basePrice: number; variants: ApiVariant[] }
interface ApiCategory { name: string; slug: string }

/** Collects every console message mentioning React's ref warning. */
function watchRefWarnings(page: Page): string[] {
  const found: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('cannot be given refs')) found.push(m.text().slice(0, 200));
  });
  return found;
}

test('images are resized and the home page stays under 5 MB of images', async ({ page, request }) => {
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  const unsizedUnsplash: string[] = [];
  let homeImageBytes = 0;
  page.on('request', (r) => {
    if (r.url().includes('images.unsplash.com') && !new URL(r.url()).searchParams.has('w')) unsizedUnsplash.push(r.url());
  });
  const countBytes = async (r: import('@playwright/test').Request) => {
    if (r.resourceType() === 'image') {
      try { homeImageBytes += (await r.sizes()).responseBodySize; } catch { /* aborted */ }
    }
  };
  page.on('requestfinished', countBytes);

  await page.goto('/');
  // Scroll through the page so lazy images below the fold load too.
  for (let y = 0; y < 6000; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);
  }
  await page.waitForLoadState('networkidle');
  page.off('requestfinished', countBytes);
  expect(homeImageBytes).toBeLessThan(5 * 1024 * 1024);

  await page.goto(`/product/${products[0].slug}`);
  await page.waitForLoadState('networkidle');
  expect(unsizedUnsplash).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu drawer navigates to a category', async ({ page, request }) => {
    const refWarnings = watchRefWarnings(page);
    const categories = (await (await request.get(`${API_ORIGIN}/api/categories`)).json()) as ApiCategory[];
    const target = categories[0];

    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: target.name, exact: true }).click();

    await expect(page).toHaveURL(`/category/${target.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: target.name })).toBeVisible();
    await expect(menu).toBeHidden();
    expect(refWarnings).toEqual([]);
  });
});

test('the cart ships free at the store threshold and the total equals the subtotal', async ({ page, request }) => {
  const refWarnings = watchRefWarnings(page);
  const { freeShippingThreshold } = (await (await request.get(`${API_ORIGIN}/api/settings/shipping`)).json()) as {
    freeShippingThreshold: number;
  };
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  const product = products[0];
  const price = product.variants[0]?.price ?? product.basePrice;
  const quantity = Math.max(1, Math.ceil(freeShippingThreshold / price));

  await page.goto(`/product/${product.slug}`);
  await page.getByRole('button', { name: /add to cart/i }).first().click();
  const cart = page.getByRole('dialog', { name: /Shopping Cart/ });
  await expect(cart).toBeVisible();
  for (let i = 1; i < quantity; i++) {
    await cart.getByRole('button', { name: 'Increase quantity' }).first().click();
  }

  const subtotal = price * quantity;
  const subtotalRow = cart.locator('div').filter({ has: page.getByText('Subtotal', { exact: true }) }).last();
  const totalRow = cart.locator('div').filter({ has: page.getByText('Total', { exact: true }) }).last();
  await expect(subtotalRow.getByText(`₹${subtotal}`, { exact: true })).toBeVisible();
  await expect(cart.getByText('Free', { exact: true })).toBeVisible();
  await expect(totalRow.getByText(`₹${subtotal}`, { exact: true })).toBeVisible();
  expect(refWarnings).toEqual([]);
});

test('the hero buttons scroll to their sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'View Collections' }).click();
  await expect(page).toHaveURL(/#categories$/);
  await expect(page.getByRole('heading', { name: 'Shop by Category' })).toBeInViewport();
  await page.getByRole('link', { name: 'Shop Now' }).scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: 'Shop Now' }).click();
  await expect(page).toHaveURL(/#featured$/);
  await expect(page.getByRole('heading', { name: 'Featured Products' })).toBeInViewport();
});
