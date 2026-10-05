'use client';

import { ErrorFallback } from '@/components/ErrorFallback';
import { fontVariables } from './fonts';
import '../src/styles/index.css';

// Last-resort boundary: it catches errors thrown by the root layout itself
// (fonts, metadata, the Toaster) or anything above app/(shop)/error.tsx and
// app/(shop)/layout.tsx's own degrade-on-error handling. Next.js only
// renders this file's own markup in that case, so — unlike every other
// error.tsx in the app — it must supply its own <html> and <body>, fonts and
// stylesheet import to keep the brand tokens available.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <ErrorFallback error={error} retry={retry} />
      </body>
    </html>
  );
}
