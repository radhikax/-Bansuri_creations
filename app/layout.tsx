import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import '../src/styles/index.css';
import { Toaster } from '@/components/ui/sonner';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

const heading = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-heading' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

export const metadata: Metadata = {
  // One source of truth for NEXT_PUBLIC_SITE_URL and its local fallback:
  // src/lib/seo.ts's absoluteUrl, so this never disagrees with the
  // canonical/OG URLs the page-level generateMetadata functions build.
  metadataBase: new URL(absoluteUrl('/')),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

// The storefront chrome (Header/Footer/Cart) and the categories fetch that
// feeds them live in app/(shop)/layout.tsx instead — this root layout wraps
// every route, including /admin, which must not depend on the catalogue API.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
