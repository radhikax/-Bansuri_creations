import type { Metadata } from 'next';
import '../src/styles/index.css';
import { Toaster } from '@/components/ui/sonner';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';
import { fontVariables } from './fonts';


// A static `metadata` export would be evaluated once, at build/module-load
// time, baking in whatever SITE_URL happened to be set then — the exact bug
// this function avoids. `generateMetadata` instead runs per request, so
// metadataBase always reflects the runtime SITE_URL (see src/lib/seo.ts's
// absoluteUrl, the one source of truth it shares with every page-level
// generateMetadata function for canonical/OG URLs).
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(absoluteUrl('/')),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
  };
}

// The storefront chrome (Header/Footer/Cart) and the categories fetch that
// feeds them live in app/(shop)/layout.tsx instead — this root layout wraps
// every route, including /admin, which must not depend on the catalogue API.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
