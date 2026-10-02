import { describe, expect, it, vi } from 'vitest';
import { SITE_NAME } from '@/lib/seo';

const { getCategories, getProducts } = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getProducts: vi.fn(),
}));

// The route is a Server Component that calls into src/lib/catalogue.ts
// (server-only, real network access). Mock it wholesale, as
// app/category/[slug]/page.test.tsx does, since this test only exercises
// generateMetadata's own logic.
vi.mock('@/lib/catalogue', () => ({ getCategories, getProducts }));

import { generateMetadata } from './page';

describe('app/page generateMetadata', () => {
  it('sets an absolute title so the root layout template cannot double it up', async () => {
    const metadata = await generateMetadata();

    // A plain string title would be run through the layout's
    // `'%s | Bansuri Creations'` template and render as
    // "Bansuri Creations | Bansuri Creations". `{ absolute }` opts out.
    expect(metadata.title).toEqual({ absolute: SITE_NAME });
    expect(metadata.title).not.toBe(SITE_NAME);
  });
});
