import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryPage } from './CategoryPage';
import { CartProvider } from '../components/cart/CartProvider';
import { makeProduct } from '../test/fixtures';
import type { AdaptedCategory } from '../lib/adapters';
import type { Product } from '../types';

const diwaliDecor: AdaptedCategory = { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' };

// The route (app/category/[slug]/page.tsx) resolves the category and filters
// products by slug before rendering; CategoryPage itself is now props-only.
function renderPage(category: AdaptedCategory, products: Product[]) {
  render(
    <CartProvider>
      <CategoryPage category={category} products={products} />
    </CartProvider>,
  );
}

describe('CategoryPage', () => {
  it('shows the category title and its products', () => {
    const products = [
      makeProduct({ id: '1', slug: 'diya', name: 'Brass Diya' }),
      makeProduct({ id: '2', slug: 'lantern', name: 'Paper Lantern' }),
    ];
    renderPage(diwaliDecor, products);
    expect(screen.getByRole('heading', { level: 1, name: 'Diwali Decor' })).toBeInTheDocument();
    expect(screen.getByText('Browse our collection of diwali decor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paper Lantern' })).toBeInTheDocument();
  });

  it('shows an empty message for a category with no products', () => {
    renderPage(diwaliDecor, []);
    expect(screen.getByText('No products found in this category.')).toBeInTheDocument();
  });
});
