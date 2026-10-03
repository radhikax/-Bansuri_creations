// Cache tags the web app's fetches carry (src/lib/catalogue.ts). Kept in their
// own module so tests can mock services/revalidate without losing these.
export const PRODUCT_LIST_TAG = 'product-list';

/**
 * Tags to expire when stock changes outside an admin product edit (a sale or a
 * cancel restock): each product's page, plus every product list, because home
 * and category cards have no live-stock check and would otherwise keep showing
 * stale availability for up to 5 minutes.
 */
export function stockChangeTags(items: { productVariant: { product: { slug: string } } }[]): string[] {
  const slugs = new Set(items.map((item) => item.productVariant.product.slug));
  return [PRODUCT_LIST_TAG, ...Array.from(slugs, (slug) => `product:${slug}`)];
}
