import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';
import { CartProvider, useCart, type CartItem } from './cart/CartProvider';
import { CART_ICON_ATTR } from '../lib/flyToCart';
import type { AdaptedCategory } from '../lib/adapters';
import { makeProduct } from '../test/fixtures';

const STORAGE_KEY = 'bansuri-cart-v1';

const categories: AdaptedCategory[] = [
  { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' },
  { title: 'Customized Gifting', description: '', image: '', icon: '', slug: 'customized-gifting' },
];

/** Exposes whether the cart is open, so tests can assert the header's cart button opened it. */
function CartOpenProbe() {
  const { isOpen } = useCart();
  return <div data-testid="cart-open">{isOpen ? 'open' : 'closed'}</div>;
}

function seedCart(items: CartItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items }));
}

function renderHeader(cats: AdaptedCategory[] = categories) {
  render(
    <CartProvider>
      <Header categories={cats} />
      <CartOpenProbe />
    </CartProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('Header', () => {
  it('links the brand to home and lists the categories it is given', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /bansuri creations/i })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('link', { name: 'Diwali Decor' })[0]).toHaveAttribute('href', '/category/diwali-decor');
    expect(screen.getAllByRole('link', { name: 'Customized Gifting' })[0]).toHaveAttribute('href', '/category/customized-gifting');
    expect(screen.queryByRole('link', { name: 'Kanha Dresses' })).not.toBeInTheDocument();
  });

  it('shows only Home while categories are loading', () => {
    renderHeader([]);
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Diwali Decor' })).not.toBeInTheDocument();
  });

  it('opens a phone menu with the category links and closes it after a tap', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('dialog', { name: 'Menu' });
    const link = within(menu).getByRole('link', { name: 'Customized Gifting' });
    expect(link).toHaveAttribute('href', '/category/customized-gifting');
    await user.click(link);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
  });

  it('hides the count badge when the cart is empty', () => {
    renderHeader();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the item count from the cart, as the sum of quantities', async () => {
    seedCart([
      { ...makeProduct(), quantity: 2, variantId: 'prod-1' },
      { ...makeProduct({ id: 'prod-2' }), quantity: 1, variantId: 'prod-2' },
    ]);
    renderHeader();
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('opens the cart and is the fly-to-cart target', async () => {
    const user = userEvent.setup();
    renderHeader();
    expect(screen.getByTestId('cart-open')).toHaveTextContent('closed');
    const button = document.querySelector(`[${CART_ICON_ATTR}]`) as HTMLElement;
    expect(button).not.toBeNull();
    await user.click(button);
    expect(screen.getByTestId('cart-open')).toHaveTextContent('open');
  });
});
