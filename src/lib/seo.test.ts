import { afterEach, describe, expect, it } from 'vitest';
import { makeApiProduct, makeApiVariant } from '../test/fixtures';
import { absoluteUrl, jsonLdScript, productInStock, productJsonLd, productPrice } from './seo';

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
});

describe('absoluteUrl', () => {
  it('falls back to the local dev origin when NEXT_PUBLIC_SITE_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(absoluteUrl('/product/brass-diya')).toBe('http://localhost:5173/product/brass-diya');
  });

  it('uses NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bansuricreations.example';
    expect(absoluteUrl('/category/diwali-decor')).toBe('https://bansuricreations.example/category/diwali-decor');
  });

  it('strips a trailing slash from the base so the result never contains //', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bansuricreations.example/';
    expect(absoluteUrl('/')).toBe('https://bansuricreations.example/');
  });

  it('adds a leading slash to a path that is missing one', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bansuricreations.example';
    expect(absoluteUrl('sitemap.xml')).toBe('https://bansuricreations.example/sitemap.xml');
  });
});

describe('productPrice', () => {
  it('picks the lowest variant price', () => {
    const product = makeApiProduct({
      basePrice: 500,
      variants: [
        makeApiVariant({ id: 'v-1', price: 700, stock: 1 }),
        makeApiVariant({ id: 'v-2', price: 400, stock: 1 }),
        makeApiVariant({ id: 'v-3', price: 900, stock: 1 }),
      ],
    });
    expect(productPrice(product)).toBe(400);
  });

  it('falls back to basePrice for a variant with a null price', () => {
    const product = makeApiProduct({
      basePrice: 500,
      variants: [makeApiVariant({ id: 'v-1', price: null, stock: 1 })],
    });
    expect(productPrice(product)).toBe(500);
  });

  it('falls back to basePrice when there are no variants', () => {
    const product = makeApiProduct({ basePrice: 500, variants: [] });
    expect(productPrice(product)).toBe(500);
  });

  it('competes the null-substituted basePrice against non-null prices, picking the substituted basePrice when it is lowest', () => {
    const product = makeApiProduct({
      basePrice: 250,
      variants: [
        makeApiVariant({ id: 'v-1', price: null, stock: 1 }),
        makeApiVariant({ id: 'v-2', price: 300, stock: 1 }),
        makeApiVariant({ id: 'v-3', price: 500, stock: 1 }),
      ],
    });
    expect(productPrice(product)).toBe(250);
  });

  it('competes the null-substituted basePrice against non-null prices, picking a non-null price when it is lowest', () => {
    const product = makeApiProduct({
      basePrice: 400,
      variants: [
        makeApiVariant({ id: 'v-1', price: null, stock: 1 }),
        makeApiVariant({ id: 'v-2', price: 300, stock: 1 }),
        makeApiVariant({ id: 'v-3', price: 500, stock: 1 }),
      ],
    });
    expect(productPrice(product)).toBe(300);
  });
});

describe('productInStock', () => {
  it('is true when any variant has stock', () => {
    const product = makeApiProduct({
      variants: [makeApiVariant({ id: 'v-1', stock: 0 }), makeApiVariant({ id: 'v-2', stock: 3 })],
    });
    expect(productInStock(product)).toBe(true);
  });

  it('is false when no variant has stock', () => {
    const product = makeApiProduct({
      variants: [makeApiVariant({ id: 'v-1', stock: 0 }), makeApiVariant({ id: 'v-2', stock: 0 })],
    });
    expect(productInStock(product)).toBe(false);
  });
});

describe('productJsonLd', () => {
  it('builds schema.org Product JSON-LD with the lowest price and InStock availability', () => {
    const product = makeApiProduct({
      name: 'Brass Diya',
      description: 'A handmade brass diya.',
      images: ['https://img.test/a.jpg', 'https://img.test/b.jpg'],
      basePrice: 500,
      variants: [makeApiVariant({ id: 'v-1', price: 600, stock: 0 }), makeApiVariant({ id: 'v-2', price: 450, stock: 2 })],
    });

    const jsonLd = productJsonLd(product, 'https://bansuricreations.example/product/brass-diya');

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Brass Diya',
      image: ['https://img.test/a.jpg', 'https://img.test/b.jpg'],
      description: 'A handmade brass diya.',
      url: 'https://bansuricreations.example/product/brass-diya',
      offers: {
        '@type': 'Offer',
        price: '450',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
    });
  });

  it('is OutOfStock when no variant has stock', () => {
    const product = makeApiProduct({ variants: [makeApiVariant({ id: 'v-1', price: 500, stock: 0 })] });
    const jsonLd = productJsonLd(product, 'https://bansuricreations.example/product/brass-diya');
    expect((jsonLd.offers as Record<string, unknown>).availability).toBe('https://schema.org/OutOfStock');
  });

  it('falls back to imageUrl when the product has no images', () => {
    const product = makeApiProduct({ images: [], imageUrl: 'https://img.test/fallback.jpg' });
    const jsonLd = productJsonLd(product, 'https://bansuricreations.example/product/brass-diya');
    expect(jsonLd.image).toEqual(['https://img.test/fallback.jpg']);
  });

  it('prices the offer off a mix of null and non-null variant prices', () => {
    const product = makeApiProduct({
      basePrice: 400,
      variants: [
        makeApiVariant({ id: 'v-1', price: null, stock: 0 }),
        makeApiVariant({ id: 'v-2', price: 300, stock: 1 }),
        makeApiVariant({ id: 'v-3', price: 500, stock: 0 }),
      ],
    });
    const jsonLd = productJsonLd(product, 'https://bansuricreations.example/product/brass-diya');
    expect((jsonLd.offers as Record<string, unknown>).price).toBe('300');
  });
});

describe('jsonLdScript', () => {
  it('escapes < as \\u003c so </script> in product text cannot close the tag early', () => {
    const product = makeApiProduct({ description: 'Beautiful piece</script><script>alert(1)</script>' });
    const jsonLd = productJsonLd(product, 'https://bansuricreations.example/product/brass-diya');

    const serialised = jsonLdScript(jsonLd);

    expect(serialised).not.toContain('</script>');
    expect(serialised).toContain('Beautiful piece\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
    expect(JSON.parse(serialised.replace(/\\u003c/g, '<')).description).toBe(
      'Beautiful piece</script><script>alert(1)</script>',
    );
  });
});
