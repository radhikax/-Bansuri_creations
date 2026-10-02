import 'server-only';
import { serverApi } from './api/client';
import { adaptCategory, adaptProduct, type AdaptedCategory } from './adapters';
import type { ApiProduct } from './api';
import type { Product } from '../types';

// A 300s/5min revalidation window shared by every catalogue read, tagged so
// an admin write (see server/) can selectively revalidate just the affected
// list/product/category via revalidateTag.
const REVALIDATE_SECONDS = 300;
const CATALOGUE_TAG = 'catalogue';
// Every product-list read (home and category pages) also carries this tag, so
// a sale can refresh list stock without expiring every cached page the way
// 'catalogue' would. Must match server/src/routes/webhook.routes.ts.
export const PRODUCT_LIST_TAG = 'product-list';

export async function getCategories(): Promise<AdaptedCategory[]> {
  const { data, error } = await serverApi.GET('/api/categories', {
    next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOGUE_TAG] },
  });
  if (error) throw new Error('Failed to load categories');
  return data.map(adaptCategory);
}

/** All active products, or only `categorySlug`'s when given (filtered by the API, not here). */
export async function getProducts(categorySlug?: string): Promise<Product[]> {
  const { data, error } = await serverApi.GET('/api/products', {
    params: { query: categorySlug ? { category: categorySlug } : {} },
    next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOGUE_TAG, PRODUCT_LIST_TAG] },
  });
  if (error) throw new Error('Failed to load products');
  return data.map(adaptProduct);
}

export async function getProductBySlug(slug: string): Promise<{ product: Product; raw: ApiProduct } | null> {
  const { data, error, response } = await serverApi.GET('/api/products/{slug}', {
    params: { path: { slug } },
    next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOGUE_TAG, `product:${slug}`] },
  });
  if (response.status === 404) return null;
  if (error || !data) throw new Error(`Failed to load product "${slug}"`);
  return { product: adaptProduct(data), raw: data };
}

export async function getCategoryBySlug(slug: string): Promise<AdaptedCategory | null> {
  // No single-category endpoint exists; the category-specific tag still lets
  // an admin category update revalidate just this slug's cache entry.
  const { data, error } = await serverApi.GET('/api/categories', {
    next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOGUE_TAG, `category:${slug}`] },
  });
  if (error) throw new Error('Failed to load categories');
  const found = data.find((category) => category.slug === slug);
  return found ? adaptCategory(found) : null;
}
