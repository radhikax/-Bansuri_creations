import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryBySlug, getProducts } from '@/lib/catalogue';
import { CategoryPage } from '@/views/CategoryPage';
import { absoluteUrl } from '@/lib/seo';

// See app/(shop)/page.tsx: caching lives in src/lib/catalogue.ts's fetch options, so
// this route stays dynamic and is never prerendered at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  // Unknown slug: return empty/default metadata and let the page itself call
  // notFound() — generateMetadata must never throw.
  if (!category) return {};

  return {
    title: category.title,
    description: category.description,
    alternates: { canonical: absoluteUrl(`/category/${slug}`) },
    openGraph: {
      type: 'website',
      title: category.title,
      description: category.description,
      images: category.image ? [category.image] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, products] = await Promise.all([getCategoryBySlug(slug), getProducts()]);
  if (!category) notFound();
  return <CategoryPage category={category} products={products.filter((p) => p.categorySlug === slug)} />;
}
