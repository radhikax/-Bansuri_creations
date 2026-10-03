import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCard } from './ProductCard';
import { CartProvider, useCart } from './cart/CartProvider';
import { makeProduct, sizeVariants } from '../test/fixtures';
import type { Product } from '../types';

function CartProbe() {
  const { items } = useCart();
  return <div data-testid="cart-items">{JSON.stringify(items)}</div>;
}

function renderCard(product: Product) {
  render(
    <CartProvider>
      <ProductCard product={product} />
      <CartProbe />
    </CartProvider>,
  );
}

describe('ProductCard', () => {
  it('serves an image from a host outside the optimizer allowlist unoptimized, so it still loads', () => {
    renderCard(makeProduct({ image: 'https://res.cloudinary.com/demo/image/upload/diya.jpg' }));
    expect(screen.getByRole('img', { name: 'Brass Diya' })).toHaveAttribute('data-unoptimized', 'true');
  });

  it('still optimizes an allowlisted Unsplash image', () => {
    renderCard(makeProduct({ image: 'https://images.unsplash.com/photo-1?w=400' }));
    expect(screen.getByRole('img', { name: 'Brass Diya' })).not.toHaveAttribute('data-unoptimized');
  });

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
    renderCard(makeProduct());
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(screen.getByTestId('cart-items')).toHaveTextContent('"id":"prod-1"');
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
      renderCard(makeProduct({ variants: sizeVariants }));
      await user.click(screen.getByRole('button', { name: 'Large' }));
      await user.click(screen.getByRole('button', { name: /add to cart/i }));
      const cartText = screen.getByTestId('cart-items').textContent ?? '';
      expect(cartText).toContain('"id":"prod-1::v-l"');
      expect(cartText).toContain('"name":"Brass Diya (Large)"');
      expect(cartText).toContain('"price":700');
    });
  });

  it('renders the image with the card sizes hint', () => {
    renderCard(makeProduct({ image: 'https://images.unsplash.com/photo-card' }));
    const img = screen.getByRole('img', { name: 'Brass Diya' });
    expect(img.getAttribute('src')).toBe('https://images.unsplash.com/photo-card');
    expect(img).toHaveAttribute('sizes', '(min-width:1024px) 25vw, (min-width:768px) 50vw, 100vw');
  });
});
