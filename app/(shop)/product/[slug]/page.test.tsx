import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/components/cart/CartProvider';
import { adaptProduct } from '@/lib/adapters';
import { makeApiProduct, makeApiVariant } from '@/test/fixtures';

const { getProductBySlug } = vi.hoisted(() => ({
  getProductBySlug: vi.fn(),
}));

// The route is a Server Component that calls into src/lib/catalogue.ts
// (server-only, real network access). Mock it wholesale, as
// app/category/[slug]/page.test.tsx does, so this test exercises only the
// route's own logic: the notFound() branch and the JSON-LD script render.
vi.mock('@/lib/catalogue', () => ({ getProductBySlug }));

import Page from './page';

async function renderPage(slug: string) {
  const element = await Page({ params: Promise.resolve({ slug }) });
  return render(<CartProvider>{element}</CartProvider>);
}

describe('app/product/[slug]/page', () => {
  it('calls notFound() for an unknown product slug', async () => {
    getProductBySlug.mockResolvedValue(null);

    await expect(Page({ params: Promise.resolve({ slug: 'nope' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('renders the Open Graph price as <meta property=...>, which OG parsers read (not name=)', async () => {
    const raw = makeApiProduct({
      slug: 'brass-diya',
      basePrice: 900,
      variants: [makeApiVariant({ id: 'v-1', price: 650, stock: 2 }), makeApiVariant({ id: 'v-2', price: 800, stock: 1 })],
    });
    getProductBySlug.mockResolvedValue({ product: adaptProduct(raw), raw });

    const { container } = await renderPage('brass-diya');

    expect(container.querySelector('meta[property="product:price:amount"]')?.getAttribute('content')).toBe('650');
    expect(container.querySelector('meta[property="product:price:currency"]')?.getAttribute('content')).toBe('INR');
    expect(container.querySelector('meta[name="product:price:amount"]')).toBeNull();
  });

  it('escapes a </script> in the product description inside the rendered JSON-LD script tag', async () => {
    // Slug matches src/test/server.ts's default MSW fixture, so the client
    // ProductDetailPage's own background live-stock fetch (useLiveStock) has
    // a handler and doesn't error — this test only cares about the
    // server-rendered <script> tag the route itself produces.
    const raw = makeApiProduct({
      slug: 'brass-diya',
      description: 'Beautiful piece</script><script>alert(1)</script>',
    });
    getProductBySlug.mockResolvedValue({ product: adaptProduct(raw), raw });

    const { container } = await renderPage('brass-diya');

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const html = script?.innerHTML ?? '';
    expect(html).toContain('\\u003c/script');
    expect(html).not.toContain('</script');
  });
});
