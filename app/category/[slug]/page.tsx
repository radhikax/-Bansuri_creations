import { notFound } from 'next/navigation';
import { getCategoryBySlug, getProducts } from '@/lib/catalogue';
import { CategoryPage } from '@/views/CategoryPage';

// See app/page.tsx: caching lives in src/lib/catalogue.ts's fetch options, so
// this route stays dynamic and is never prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, products] = await Promise.all([getCategoryBySlug(slug), getProducts()]);
  if (!category) notFound();
  return <CategoryPage category={category} products={products.filter((p) => p.categorySlug === slug)} />;
}
