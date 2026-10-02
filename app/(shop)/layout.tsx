import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Cart } from '@/components/Cart';
import { CartProvider } from '@/components/cart/CartProvider';
import { getCategories } from '@/lib/catalogue';

// The nav's categories are fetched here on every request — see
// app/(shop)/page.tsx for why this route tree stays dynamic instead of ISR.
export const dynamic = 'force-dynamic';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // An error.tsx boundary never catches errors thrown by the layout.tsx of
  // its own segment, so a failing categories fetch here would otherwise
  // bypass (shop)/error.tsx entirely and hit Next's unbranded default error
  // page. Degrade instead: render with no category links, and let each
  // page's own fetch (which does throw into the boundary) show the branded
  // Retry UI for the part of the page that actually needs the API.
  const categories = await getCategories().catch((error: unknown) => {
    console.error('Failed to load categories for the shop layout', error);
    return [];
  });

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <Header categories={categories} />
        <main className="flex-1">{children}</main>
        <Footer categories={categories} />
      </div>
      <Cart />
    </CartProvider>
  );
}
