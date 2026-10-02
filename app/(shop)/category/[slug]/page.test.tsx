import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { notFound } from 'next/navigation';
import { CartProvider } from '@/components/cart/CartProvider';
import { makeProduct } from '@/test/fixtures';
import type { AdaptedCategory } from '@/lib/adapters';

const { getCategoryBySlug, getProducts } = vi.hoisted(() => ({
  getCategoryBySlug: vi.fn(),
  getProducts: vi.fn(),
}));

// The route is a Server Component that calls into src/lib/catalogue.ts
// (server-only, real network access). Mock it wholesale so this test exercises
// only the route's own logic: the notFound() branch and passing the slug to getProducts.
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

  it('asks the API for only this category’s products, by slug', async () => {
    const category: AdaptedCategory = { title: 'Gifts', description: '', image: '', icon: '', slug: 'gifts-b' };
    getCategoryBySlug.mockResolvedValue(category);
    getProducts.mockResolvedValue([
      makeProduct({ id: 'b', slug: 'b', name: 'Gift B', category: 'Gifts', categorySlug: 'gifts-b' }),
    ]);

    await renderPage('gifts-b');

    expect(getProducts).toHaveBeenCalledWith('gifts-b');
    expect(screen.getByRole('heading', { level: 1, name: 'Gifts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gift B' })).toBeInTheDocument();
  });
});
