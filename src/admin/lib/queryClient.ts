import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { AdminUnauthorizedError } from './adminApi';

export function redirectToLogin(): void {
  // A full browser navigation is intentional here (not router.push): this
  // runs from a QueryCache error handler outside any component, and a hard
  // reload also clears any in-memory client state left over from the 401.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
