import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryPage } from './CategoryPage';
import { makeProduct } from '../test/fixtures';
import type { AdaptedCategory } from '../lib/adapters';
import type { Product } from '../types';

const categories: AdaptedCategory[] = [
  { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' },
  { title: 'Kanha Dresses', description: '', image: '', icon: '', slug: 'kanha-dresses' },
];
const products = [
  makeProduct({ id: '1', slug: 'diya', name: 'Brass Diya', category: 'Diwali Decor', categorySlug: 'diwali-decor' }),
  makeProduct({ id: '2', slug: 'lantern', name: 'Paper Lantern', category: 'Diwali Decor', categorySlug: 'diwali-decor' }),
  makeProduct({ id: '3', slug: 'poshak', name: 'Kanha Poshak', category: 'Kanha Dresses', categorySlug: 'kanha-dresses' }),
];

// `path` is unused now: CategoryPage reads its slug from next/navigation's
// useParams, which src/test/next-mocks.ts stubs to always return {}. Real
// per-route params come back in Task 5 with an actual app/category/[slug] route.
function renderAt(path: string, pageProducts: Product[] = products, pageCategories: AdaptedCategory[] = categories) {
  void path;
  render(<CategoryPage products={pageProducts} categories={pageCategories} onAddToCart={() => {}} />);
}

// Needs a real dynamic route to supply the :category param — see the note on
// renderAt above. re-enabled in Task 5.
describe.skip('CategoryPage', () => {
  it('shows the category title and only its products', () => {
    renderAt('/category/diwali-decor');
    expect(screen.getByRole('heading', { level: 1, name: 'Diwali Decor' })).toBeInTheDocument();
    expect(screen.getByText('Browse our collection of diwali decor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paper Lantern' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kanha Poshak' })).not.toBeInTheDocument();
  });

  it('shows "Category not found" with a link home for an unknown category', () => {
    renderAt('/category/nope');
    expect(screen.getByText('Category not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to shopping' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('shows an empty message for a category with no products', () => {
    renderAt('/category/diwali-decor', []);
    expect(screen.getByText('No products found in this category.')).toBeInTheDocument();
  });

  it('filters by slug, not display name, when two categories share a name', () => {
    const sameName: AdaptedCategory[] = [
      { title: 'Gifts', description: '', image: '', icon: '', slug: 'gifts-a' },
      { title: 'Gifts', description: '', image: '', icon: '', slug: 'gifts-b' },
    ];
    const giftProducts = [
      makeProduct({ id: 'a', slug: 'a', name: 'Gift A', category: 'Gifts', categorySlug: 'gifts-a' }),
      makeProduct({ id: 'b', slug: 'b', name: 'Gift B', category: 'Gifts', categorySlug: 'gifts-b' }),
    ];
    renderAt('/category/gifts-b', giftProducts, sameName);
    expect(screen.getByRole('heading', { name: 'Gift B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gift A' })).not.toBeInTheDocument();
  });
});
