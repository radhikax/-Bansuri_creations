import { useEffect, useState } from 'react';

interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs `fetcher` once, on mount, and tracks its loading/error/data state.
 *
 * Later changes to `fetcher` are deliberately ignored (the effect has no deps),
 * so pass a stable fetcher. A fetcher that closes over changing values — e.g.
 * `() => getProducts(slug)` with a route param — will keep returning the first
 * result; add a deps parameter before using it that way.
 */
export function useApiData<T>(fetcher: () => Promise<T>): ApiDataState<T> {
  const [state, setState] = useState<ApiDataState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetcher()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          setState({ data: null, loading: false, error: message });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional run-once-on-mount effect; fetcher is deliberately not tracked, see doc comment above
  }, []);

  return state;
}
