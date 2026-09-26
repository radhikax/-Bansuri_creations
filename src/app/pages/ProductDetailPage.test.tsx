import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductDetailPage } from './ProductDetailPage';
import { makeProduct, sizeVariants } from '../../test/fixtures';
import type { Product } from '../types';

function renderAt(slug: string, products: Product[], onAddToCart = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[`/product/${slug}`]}>
      <Routes>
        <Route
          path="/product/:slug"
          element={<ProductDetailPage products={products} onAddToCart={onAddToCart} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return { onAddToCart };
}

describe('ProductDetailPage', () => {
  it('shows a not-found message with a link home for an unknown slug', () => {
    renderAt('missing', [makeProduct()]);
    expect(screen.getByText("We couldn't find that product.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to shopping' })).toHaveAttribute('href', '/');
  });

  it('renders product details', () => {
    renderAt('brass-diya', [makeProduct({ price: 500, originalPrice: 625 })]);
    expect(screen.getByRole('heading', { level: 1, name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByText('Diwali Decor')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('₹625')).toBeInTheDocument();
    expect(screen.getByText('20% OFF')).toBeInTheDocument();
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });

  it('shows a thumbnail per image when there are several, and none for one', () => {
    renderAt('brass-diya', [makeProduct({ images: ['a.jpg', 'b.jpg', 'c.jpg'] })]);
    expect(screen.getAllByAltText(/Brass Diya thumbnail/)).toHaveLength(3);
  });

  it('switches the main image when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    renderAt('brass-diya', [makeProduct({ images: ['a.jpg', 'b.jpg'] })]);
    await user.click(screen.getByAltText('Brass Diya thumbnail 2').closest('button')!);
    await waitFor(() => {
      const main = screen.getAllByAltText('Brass Diya');
      expect(main.some((img) => img.getAttribute('src') === 'b.jpg')).toBe(true);
    });
  });

  it('shows no thumbnails for a single image', () => {
    renderAt('brass-diya', [makeProduct()]);
    expect(screen.queryByAltText(/thumbnail/)).not.toBeInTheDocument();
  });

  it('adds to cart and shows confirmation', async () => {
    const user = userEvent.setup();
    const { onAddToCart } = renderAt('brass-diya', [makeProduct()]);
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'prod-1' }));
    expect(await screen.findByText('Added!')).toBeInTheDocument();
  });

  it('shows out-of-stock and disables the button', () => {
    renderAt('brass-diya', [makeProduct({ inStock: false })]);
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.queryByText('In stock')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  it('lets the shopper pick a variant, updating price and the cart item', async () => {
    const user = userEvent.setup();
    const { onAddToCart } = renderAt('brass-diya', [makeProduct({ variants: sizeVariants })]);
    expect(screen.getByText('₹400')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XL' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Large' }));
    expect(await screen.findByText('₹700')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(onAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'prod-1::v-l', name: 'Brass Diya (Large)', price: 700 }),
    );
  });
});
