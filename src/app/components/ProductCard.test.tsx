import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { makeProduct, sizeVariants } from '../../test/fixtures';
import type { Product } from '../types';

function renderCard(product: Product, onAddToCart = vi.fn()) {
  render(
    <MemoryRouter>
      <ProductCard product={product} onAddToCart={onAddToCart} />
    </MemoryRouter>,
  );
  return { onAddToCart };
}

describe('ProductCard', () => {
  it('shows name, category, price, rating and links to the detail page', () => {
    renderCard(makeProduct({ rating: 4.5 }));
    expect(screen.getByRole('heading', { name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByText('Diwali Decor')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('(4.5)')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.every((l) => l.getAttribute('href') === '/product/brass-diya')).toBe(true);
  });

  it('renders filled stars equal to the floored rating', () => {
    renderCard(makeProduct({ rating: 3.8 }));
    expect(screen.getAllByText('★')).toHaveLength(3);
    expect(screen.getAllByText('☆')).toHaveLength(2);
  });

  it('shows the discount badge and struck-through original price', () => {
    renderCard(makeProduct({ price: 750, originalPrice: 1000 }));
    expect(screen.getByText('25% OFF')).toBeInTheDocument();
    expect(screen.getByText('₹1000')).toBeInTheDocument();
  });

  it('does not show a discount when there is no original price', () => {
    renderCard(makeProduct());
    expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument();
  });

  it('adds the product to the cart and briefly confirms', async () => {
    const user = userEvent.setup();
    const product = makeProduct();
    const { onAddToCart } = renderCard(product);
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(onAddToCart).toHaveBeenCalledWith(product);
    expect(await screen.findByText('Added!')).toBeInTheDocument();
  });

  it('disables add to cart and shows the badge when out of stock', () => {
    renderCard(makeProduct({ inStock: false }));
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  describe('variants', () => {
    it('does not render variant chips for a single variant', () => {
      renderCard(makeProduct({ variants: [sizeVariants[0]] }));
      expect(screen.queryByRole('button', { name: 'Small' })).not.toBeInTheDocument();
    });

    it('renders chips, disables out-of-stock ones and updates the price on selection', async () => {
      const user = userEvent.setup();
      renderCard(makeProduct({ variants: sizeVariants }));
      expect(screen.getByText('₹400')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'XL' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Large' }));
      expect(await screen.findByText('₹700')).toBeInTheDocument();
    });

    it('adds a variant-specific item to the cart', async () => {
      const user = userEvent.setup();
      const { onAddToCart } = renderCard(makeProduct({ variants: sizeVariants }));
      await user.click(screen.getByRole('button', { name: 'Large' }));
      await user.click(screen.getByRole('button', { name: /add to cart/i }));
      expect(onAddToCart).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'prod-1::v-l', name: 'Brass Diya (Large)', price: 700 }),
      );
    });
  });

  it('requests a 600px Unsplash image with a 2x candidate, lazily', () => {
    renderCard(makeProduct({ image: 'https://images.unsplash.com/photo-card' }));
    const img = screen.getByRole('img', { name: 'Brass Diya' });
    expect(img.getAttribute('src')).toContain('w=600');
    expect(img.getAttribute('srcset')).toContain('w=1200');
    expect(img).toHaveAttribute('loading', 'lazy');
  });
});
