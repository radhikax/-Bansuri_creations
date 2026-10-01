import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/catalogue';
import { ProductDetailPage } from '@/views/ProductDetailPage';

// See app/page.tsx: caching lives in src/lib/catalogue.ts's fetch options, so
// this route stays dynamic and is never prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getProductBySlug(slug);
  if (!found) notFound();
  return <ProductDetailPage product={found.product} />;
}
