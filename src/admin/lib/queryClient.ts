import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { AdminUnauthorizedError } from './adminApi';

/**
 * `redirect` comes from the caller (`AdminShell` passes `router.replace`) so
 * this module stays decoupled from `next/navigation`, and so tests can assert
 * the redirect happened without fighting jsdom's lack of real navigation
 * support.
 */
export function createAdminQueryClient(redirect: () => void): QueryClient {
  const handleError = (error: unknown) => {
    if (error instanceof AdminUnauthorizedError) {
      queryClient.clear();
      redirect();
    }
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
  });

  return queryClient;
}
