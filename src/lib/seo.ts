import type { ApiProduct } from './api';

export const SITE_NAME = 'Bansuri Creations';
export const SITE_DESCRIPTION = 'Handmade traditional decor, wedding packing and personalised gifts.';

// Matches the `next dev -p 5173` / `next start -p 5173` scripts, so an
// unconfigured local checkout still produces usable absolute URLs.
const DEFAULT_SITE_URL = 'http://localhost:5173';

/**
 * Resolves `path` to an absolute URL. Every caller of this module is
 * server-only (route handlers, metadata, JSON-LD), so it reads a runtime,
 * non-public `SITE_URL` first — unlike `NEXT_PUBLIC_*`, that is never
 * inlined into a built bundle, so it can be set per-deployment on an image
 * that was already built. `NEXT_PUBLIC_SITE_URL` is kept only as a
 * build-time fallback for checkouts that still set it, and the localhost
 * default covers an unconfigured local checkout. Read at call time (inside
 * this function), not into a module-level constant, so a value set after
 * the module first loads (e.g. per-request in a long-lived server process)
 * is always picked up. A blank value (e.g. `SITE_URL=` left empty in an env
 * file) counts as unset — otherwise the base would be '' and `new URL()` in
 * the root layout would throw on every request. Strips a trailing slash from
 * the base first so the result never contains `//`.
 */
export function absoluteUrl(path: string): string {
  const configured = [process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL]
    .map((value) => value?.trim())
    .find((value) => value);
  const base = (configured ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** The lowest variant price, falling back to basePrice for a null variant price or no variants. */
export function productPrice(product: ApiProduct): number {
  if (product.variants.length === 0) return product.basePrice;
  return Math.min(...product.variants.map((variant) => variant.price ?? product.basePrice));
}

/** Whether any variant has stock. Mirrors adaptProduct's own `inStock` calculation. */
export function productInStock(product: ApiProduct): boolean {
  return product.variants.some((variant) => variant.stock > 0);
}

function productImages(product: ApiProduct): string[] {
  return product.images.length > 0 ? product.images : [product.imageUrl];
}

/** Builds schema.org Product JSON-LD for a product detail page. */
export function productJsonLd(product: ApiProduct, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: productImages(product),
    description: product.description,
    url,
    offers: {
      '@type': 'Offer',
      price: String(productPrice(product)),
      priceCurrency: 'INR',
      availability: productInStock(product) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}

/**
 * Serialises JSON-LD for a `<script>` tag. Escapes `<` so a product
 * description containing `</script>` can't break out of the tag.
 */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
