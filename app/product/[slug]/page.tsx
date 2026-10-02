import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/catalogue';
import { ProductDetailPage } from '@/views/ProductDetailPage';
import { absoluteUrl, jsonLdScript, productJsonLd, productPrice } from '@/lib/seo';

// See app/page.tsx: caching lives in src/lib/catalogue.ts's fetch options, so
// this route stays dynamic and is never prerendered at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await getProductBySlug(slug);
  // Unknown slug: return empty/default metadata and let the page itself call
  // notFound() — generateMetadata must never throw.
  if (!found) return {};

  const { raw } = found;
  const description = raw.description.slice(0, 155);
  const image = raw.images[0] ?? raw.imageUrl;

  return {
    title: raw.name,
    description,
    alternates: { canonical: absoluteUrl(`/product/${slug}`) },
    openGraph: { type: 'website', title: raw.name, description, images: [image] },
    other: {
      'product:price:amount': String(productPrice(raw)),
      'product:price:currency': 'INR',
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getProductBySlug(slug);
  if (!found) notFound();

  const jsonLd = productJsonLd(found.raw, absoluteUrl(`/product/${slug}`));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <ProductDetailPage product={found.product} />
    </>
  );
}
