import { useEffect, useState } from 'react';
import { browserApi } from './api/client';
import type { ProductVariant } from '../types';

/**
 * Seeds with `initial` (the variants rendered by the server), then refreshes
 * them from the live API once on mount so stock shown to the shopper can't
 * go stale while they browse. Ignores a result that arrives after unmount
 * and ignores errors — `initial` stays in place if the request fails.
 */
export function useLiveStock(slug: string, initial: ProductVariant[]): ProductVariant[] {
  const [variants, setVariants] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    browserApi
      .GET('/api/products/{slug}', {
        params: { path: { slug } },
        // openapi-fetch's client captures `globalThis.fetch` by value when
        // `browserApi` is created (module load) — before test tooling like
        // MSW patches `globalThis.fetch`. This wrapper looks `fetch` up
        // lazily at call time instead, which is a no-op in production but
        // lets the mock take effect in tests.
        fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
      })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const basePrice = data.basePrice;
        setVariants(
          data.variants.map((v) => ({
            id: v.id,
            label: v.label,
            price: v.price ?? basePrice,
            stock: v.stock,
          })),
        );
      })
      .catch(() => {
        // Network failure: keep showing the server-rendered `initial` variants.
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return variants;
}
