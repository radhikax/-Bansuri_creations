import { getCategories, getProducts } from '@/lib/catalogue';
import { HomePage } from '@/views/HomePage';

// Fetched data is instead cached at the fetch level (src/lib/catalogue.ts's
// `next: { revalidate: 300, tags }`) — this route itself must stay dynamic so
// `next build` never calls the API.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return <HomePage categories={categories} products={products} />;
}
