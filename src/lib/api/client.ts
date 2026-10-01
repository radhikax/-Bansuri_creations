import createClient from 'openapi-fetch';
import type { paths } from './schema';

// openapi-fetch captures `fetch` by value when a client is created (module
// load time) — before test tooling like MSW patches `globalThis.fetch` in a
// `beforeAll` hook. This wrapper resolves `fetch` lazily at call time
// instead (and forwards both arguments openapi-fetch calls it with, the
// second being the RequestInit extension Next's patched fetch inspects for
// `next.tags`/`revalidate`). It's a no-op in production, where
// `globalThis.fetch` never changes after load.
const lazyFetch = (...args: Parameters<typeof fetch>): Promise<Response> => fetch(...args);

/** Server components / route handlers: talk to Express directly. */
export const serverApi = createClient<paths>({
  baseUrl: process.env.API_INTERNAL_URL ?? 'http://localhost:4000',
  fetch: lazyFetch,
});

/** Browser code: same-origin /api, forwarded to Express by next.config.ts rewrites (keeps the admin cookie first-party). */
export const browserApi = createClient<paths>({ baseUrl: '', credentials: 'include', fetch: lazyFetch });
