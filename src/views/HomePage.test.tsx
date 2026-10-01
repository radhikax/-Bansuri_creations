import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomePage } from './HomePage';
import { CartProvider, useCart } from '../components/cart/CartProvider';
import { makeProduct } from '../test/fixtures';
import type { Product } from '../types';

const categories = [
  { title: 'Diwali Decor', description: 'Lights', image: 'a.jpg', icon: '🪔', slug: 'diwali-decor' },
  { title: 'Kanha Dresses', description: 'Outfits', image: 'b.jpg', icon: '👗', slug: 'kanha-dresses' },
];

function CartProbe() {
  const { items } = useCart();
  return <div data-testid="cart-items">{JSON.stringify(items)}</div>;
}

function renderHome(products: Product[] = [makeProduct()]) {
  render(
    <CartProvider>
      <HomePage products={products} categories={categories} />
      <CartProbe />
    </CartProvider>,
  );
}

describe('HomePage', () => {
  it('renders the hero and section headings', () => {
    renderHome();
    expect(screen.getByText(/handcrafted decor for every celebration/i)).toBeInTheDocument();
    expect(screen.getByText('Shop by Category')).toBeInTheDocument();
    expect(screen.getByText('Featured Products')).toBeInTheDocument();
  });

  it('renders a linked card per category', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /Diwali Decor/ })).toHaveAttribute('href', '/category/diwali-decor');
    expect(screen.getByRole('link', { name: /Kanha Dresses/ })).toHaveAttribute('href', '/category/kanha-dresses');
  });

  it('shows at most 8 featured products', () => {
    const products = Array.from({ length: 10 }, (_, i) =>
      makeProduct({ id: `p${i}`, slug: `p${i}`, name: `Product ${i}` }),
    );
    renderHome(products);
    expect(screen.getAllByRole('button', { name: /add to cart/i })).toHaveLength(8);
    expect(screen.queryByText('Product 8')).not.toBeInTheDocument();
  });

  it('forwards add-to-cart from a product card', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(screen.getByTestId('cart-items')).toHaveTextContent('"id":"prod-1"');
  });
});
