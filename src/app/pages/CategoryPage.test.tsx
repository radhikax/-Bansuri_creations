import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CategoryPage } from './CategoryPage';
import { makeProduct } from '../../test/fixtures';

const categories = [
  { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' },
  { title: 'Kanha Dresses', description: '', image: '', icon: '', slug: 'kanha-dresses' },
];
const products = [
  makeProduct({ id: '1', slug: 'diya', name: 'Brass Diya', category: 'Diwali Decor' }),
  makeProduct({ id: '2', slug: 'lantern', name: 'Paper Lantern', category: 'Diwali Decor' }),
  makeProduct({ id: '3', slug: 'poshak', name: 'Kanha Poshak', category: 'Kanha Dresses' }),
];

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/category/:category"
          element={<CategoryPage products={products} categories={categories} onAddToCart={() => {}} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CategoryPage', () => {
  it('shows the category title and only its products', () => {
    renderAt('/category/diwali-decor');
    expect(screen.getByRole('heading', { level: 1, name: 'Diwali Decor' })).toBeInTheDocument();
    expect(screen.getByText('Browse our collection of diwali decor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paper Lantern' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kanha Poshak' })).not.toBeInTheDocument();
  });

  it('shows an empty message for an unknown category', () => {
    renderAt('/category/nope');
    expect(screen.getByText('No products found in this category.')).toBeInTheDocument();
  });

  it('shows an empty message for a category with no products', () => {
    render(
      <MemoryRouter initialEntries={['/category/diwali-decor']}>
        <Routes>
          <Route
            path="/category/:category"
            element={<CategoryPage products={[]} categories={categories} onAddToCart={() => {}} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('No products found in this category.')).toBeInTheDocument();
  });
});
