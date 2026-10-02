import type { Metadata } from 'next';
import { getCategories, getProducts } from '@/lib/catalogue';
import { HomePage } from '@/views/HomePage';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

// Fetched data is instead cached at the fetch level (src/lib/catalogue.ts's
// `next: { revalidate: 300, tags }`) — this route itself must stay dynamic so
// `next build` never calls the API.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    alternates: { canonical: absoluteUrl('/') },
    openGraph: { type: 'website', title: SITE_NAME, description: SITE_DESCRIPTION },
  };
}

export default async function Page() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return <HomePage categories={categories} products={products} />;
}
