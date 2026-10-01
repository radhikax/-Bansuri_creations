import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/components/cart/CartProvider';
import { makeProduct } from '@/test/fixtures';
import type { AdaptedCategory } from '@/lib/adapters';
import type { Product } from '@/types';

const { getCategoryBySlug, getProducts } = vi.hoisted(() => ({
  getCategoryBySlug: vi.fn(),
  getProducts: vi.fn(),
}));

// The route is a Server Component that calls into src/lib/catalogue.ts
// (server-only, real network access). Mock it wholesale so this test exercises
// only the route's own logic: the notFound() branch and the category-slug filter.
vi.mock('@/lib/catalogue', () => ({ getCategoryBySlug, getProducts }));

import Page from './page';

async function renderPage(slug: string) {
  const element = await Page({ params: Promise.resolve({ slug }) });
  render(<CartProvider>{element}</CartProvider>);
}

describe('app/category/[slug]/page', () => {
  it('calls notFound() for an unknown category slug', async () => {
    getCategoryBySlug.mockResolvedValue(null);
    getProducts.mockResolvedValue([]);

    await expect(Page({ params: Promise.resolve({ slug: 'nope' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('filters products by category slug, not display name', async () => {
    const sameNameCategories: AdaptedCategory[] = [
      { title: 'Gifts', description: '', image: '', icon: '', slug: 'gifts-a' },
      { title: 'Gifts', description: '', image: '', icon: '', slug: 'gifts-b' },
    ];
    const products: Product[] = [
      makeProduct({ id: 'a', slug: 'a', name: 'Gift A', category: 'Gifts', categorySlug: 'gifts-a' }),
      makeProduct({ id: 'b', slug: 'b', name: 'Gift B', category: 'Gifts', categorySlug: 'gifts-b' }),
    ];
    getCategoryBySlug.mockResolvedValue(sameNameCategories[1]);
    getProducts.mockResolvedValue(products);

    await renderPage('gifts-b');

    expect(screen.getByRole('heading', { level: 1, name: 'Gifts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gift B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gift A' })).not.toBeInTheDocument();
  });
});
