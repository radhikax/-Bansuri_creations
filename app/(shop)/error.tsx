'use client';

import { ErrorFallback } from '@/components/ErrorFallback';

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorFallback error={error} retry={retry} />;
}
