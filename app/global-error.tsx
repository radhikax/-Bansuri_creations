'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import '../src/styles/index.css';

// Last-resort boundary: it catches errors thrown by the root layout itself
// (fonts, metadata, the Toaster) or anything above app/(shop)/error.tsx and
// app/(shop)/layout.tsx's own degrade-on-error handling. Next.js only
// renders this file's own markup in that case, so — unlike every other
// error.tsx in the app — it must supply its own <html> and <body> and its
// own stylesheet import to keep the brand tokens available.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="container mx-auto px-4 py-24 flex flex-col items-center text-center text-maroon-900">
          <AlertTriangle className="h-10 w-10 mb-4" aria-hidden="true" />
          <p className="text-lg mb-6">Something went wrong loading this page.</p>
          <Button onClick={() => reset()}>Retry</Button>
        </div>
      </body>
    </html>
  );
}
