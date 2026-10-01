import createClient from 'openapi-fetch';
import type { paths } from './schema';

/** Server components / route handlers: talk to Express directly. */
export const serverApi = createClient<paths>({ baseUrl: process.env.API_INTERNAL_URL ?? 'http://localhost:4000' });

/** Browser code: same-origin /api, forwarded to Express by next.config.ts rewrites (keeps the admin cookie first-party). */
export const browserApi = createClient<paths>({ baseUrl: '', credentials: 'include' });
