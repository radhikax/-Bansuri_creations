import { test, expect, type Locator, type Page } from '@playwright/test';
import { API_ORIGIN } from './env';

interface ApiVariant { price: number | null }
interface ApiProduct { name: string; slug: string; basePrice: number; variants: ApiVariant[] }
interface ApiCategory { slug: string }

const VIEWPORTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '1366x800', width: 1366, height: 800 },
];

async function expectNoHorizontalOverflow(page: Page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
}

/**
 * Radix marks everything outside an open modal aria-hidden (its focus-trap
 * behaviour), so the default toBeVisible() — which requires no aria-hidden
 * ancestor — would report the heading behind the popup as "not visible" even
 * though it's still rendered on screen at full size. { includeHidden: true }
 * resolves the locator past that aria-hidden wrapper, and asserting the
 * element is attached with a non-zero bounding box checks what the brief
 * actually cares about: the page behind the popup hasn't been unmounted or
 * collapsed, just marked inert for assistive tech.
 */
async function expectHeadingStillOnScreen(page: Page, name: string) {
  const heading = page.getByRole('heading', { name, includeHidden: true }).first();
  await expect(heading).toBeAttached();
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
}

/**
 * Chromium reports Tailwind v4 colours in the space they were authored in:
 * rgb()/rgba() for some, oklab()/oklch() for colour-mixed ones like
 * bg-(--beige-50)/45. Return the alpha and whether the colour is light
 * (not a black scrim) for either form.
 */
function parseColour(color: string): { a: number; light: boolean } {
  const rgb = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const [r, g, b, a = 1] = rgb[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    return { a, light: (r + g + b) / 3 > 128 };
  }
  const ok = color.match(/^okl(?:ab|ch)\(\s*([\d.]+)%?[^/)]*(?:\/\s*([\d.]+)(%?))?\)$/);
  if (ok) {
    const lightness = parseFloat(ok[1]) > 1 ? parseFloat(ok[1]) / 100 : parseFloat(ok[1]);
    const a = ok[2] === undefined ? 1 : ok[3] === '%' ? parseFloat(ok[2]) / 100 : parseFloat(ok[2]);
    return { a, light: lightness > 0.5 };
  }
  throw new Error(`Unrecognised colour format: ${color}`);
}

/** Exactly one overlay open, and it's the beige veil (bg-(--beige-50)/45), not an opaque black scrim. */
async function expectSingleTranslucentOverlay(overlays: Locator) {
  await expect(overlays).toHaveCount(1);
  const color = await overlays.first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const { a, light } = parseColour(color);
  expect(a).toBeLessThan(0.6);
  expect(a).toBeCloseTo(0.45, 1);
  expect(light).toBe(true);
}

for (const viewport of VIEWPORTS) {
  test.describe(`visual @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('home, category, product, cart, checkout, 404 and admin login all fit the viewport', async ({ page, request }) => {
      const categories = (await (await request.get(`${API_ORIGIN}/api/categories`)).json()) as ApiCategory[];
      const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
      const category = categories[0];
      const product = products[0];
      const overlays = page.locator('[data-slot$="overlay"]');

      // 1. Home
      await page.goto('/');
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/visual/${viewport.label}-home.png`, fullPage: true });

      // 2. First category
      await page.goto(`/category/${category.slug}`);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/visual/${viewport.label}-category.png`, fullPage: true });

      // 3. First product
      await page.goto(`/product/${product.slug}`);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/visual/${viewport.label}-product.png`, fullPage: true });

      // Needed so "Proceed to Checkout" is rendered at all (Cart.tsx only
      // shows it once the cart has items).
      await page.getByRole('button', { name: /add to cart/i }).first().click();

      // 4. Cart open
      await page.locator('[data-cart-icon-target]').click();
      const cart = page.getByRole('dialog', { name: /Shopping Cart/ });
      await expect(cart).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectSingleTranslucentOverlay(overlays);
      await expectHeadingStillOnScreen(page, product.name);
      await page.screenshot({ path: `test-results/visual/${viewport.label}-cart.png`, fullPage: true });

      // 5. Checkout dialog — replaces the cart sheet, so still only one popup.
      await cart.getByRole('button', { name: 'Proceed to Checkout' }).click();
      const checkout = page.getByRole('dialog', { name: 'Shipping' });
      await expect(checkout).toBeVisible();
      await expect(cart).toBeHidden();
      await expectNoHorizontalOverflow(page);
      await expectSingleTranslucentOverlay(overlays);
      await expectHeadingStillOnScreen(page, product.name);
      await page.screenshot({ path: `test-results/visual/${viewport.label}-checkout.png`, fullPage: true });

      // 6. Unknown product
      await page.goto('/product/does-not-exist');
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/visual/${viewport.label}-product-404.png`, fullPage: true });

      // 7. Admin login
      await page.goto('/admin/login');
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/visual/${viewport.label}-admin-login.png`, fullPage: true });
    });
  });
}
