import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import '../src/styles/index.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Cart } from '@/components/Cart';
import { CartProvider } from '@/components/cart/CartProvider';
import { Toaster } from '@/components/ui/sonner';
import { getCategories } from '@/lib/catalogue';

const heading = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-heading' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:8080'),
  title: { default: 'Bansuri Creations', template: '%s | Bansuri Creations' },
  description: 'Handmade traditional decor, wedding packing and personalised gifts.',
};

// The nav's categories are fetched here on every request — see app/page.tsx
// for why this route tree stays dynamic instead of ISR.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        <CartProvider>
          <Header categories={categories} />
          {children}
          <Footer categories={categories} />
          <Cart />
        </CartProvider>
        <Toaster />
      </body>
    </html>
  );
}
