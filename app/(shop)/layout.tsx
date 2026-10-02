import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Cart } from '@/components/Cart';
import { CartProvider } from '@/components/cart/CartProvider';
import { getCategories } from '@/lib/catalogue';

// The nav's categories are fetched here on every request — see
// app/(shop)/page.tsx for why this route tree stays dynamic instead of ISR.
export const dynamic = 'force-dynamic';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

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
