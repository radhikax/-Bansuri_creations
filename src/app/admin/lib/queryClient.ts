import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { AdminUnauthorizedError } from './adminApi';

export function redirectToLogin(): void {
  window.location.href = '/admin/login';
}

/**
 * `redirect` is injectable so tests can assert the redirect happened without
 * fighting jsdom's lack of real navigation support.
 */
export function createAdminQueryClient(redirect: () => void = redirectToLogin): QueryClient {
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
