import type { MetadataRoute } from 'next';
import { getCategories, getProducts } from '@/lib/catalogue';
import { absoluteUrl } from '@/lib/seo';

// See app/(shop)/page.tsx: caching lives in src/lib/catalogue.ts's fetch options, so
// this route stays dynamic and next build never calls the API to prerender it.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  return [
    { url: absoluteUrl('/') },
    ...categories.map((category) => ({ url: absoluteUrl(`/category/${category.slug}`) })),
    ...products.map((product) => ({ url: absoluteUrl(`/product/${product.slug}`) })),
  ];
}
