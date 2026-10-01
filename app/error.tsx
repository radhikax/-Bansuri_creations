'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-24 flex flex-col items-center text-center text-maroon-900">
      <AlertTriangle className="h-10 w-10 mb-4" aria-hidden="true" />
      <p className="text-lg mb-6">Something went wrong loading this page.</p>
      <Button onClick={() => reset()}>Retry</Button>
    </div>
  );
}
