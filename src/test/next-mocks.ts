import { vi } from 'vitest';
import React from 'react';

export const routerMock = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: vi.fn(() => '/'),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
vi.mock('next/image', () => ({
  // `unoptimized` surfaces as data-unoptimized so tests can assert which images skip the optimizer.
  default: ({ src, alt, fill: _fill, priority: _priority, unoptimized, sizes, ...rest }: Record<string, unknown>) =>
    React.createElement('img', {
      src: typeof src === 'string' ? src : '',
      alt,
      sizes,
      'data-unoptimized': unoptimized ? 'true' : undefined,
      ...rest,
    }),
}));
// next/font only works under the Next compiler; each loader returns its CSS variable name as a class.
vi.mock('next/font/google', () => {
  const loader = (opts: { variable?: string }) => ({
    className: '',
    variable: `${(opts.variable ?? '').replace(/^--/, '')}-var`,
    style: {},
  });
  return { Cormorant_Garamond: loader, Inter: loader };
});
