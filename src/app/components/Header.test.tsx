import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { CART_ICON_ATTR } from '../lib/flyToCart';

function renderHeader(count: number, onCartClick = vi.fn()) {
  render(
    <MemoryRouter>
      <Header cartItemsCount={count} onCartClick={onCartClick} />
    </MemoryRouter>,
  );
  return { onCartClick };
}

describe('Header', () => {
  it('links the brand to home and lists category links', () => {
    renderHeader(0);
    expect(screen.getByRole('link', { name: /bansuri creations/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Diwali Decor' })).toHaveAttribute('href', '/category/diwali-decor');
    expect(screen.getByRole('link', { name: 'Kanha Dresses' })).toHaveAttribute('href', '/category/kanha-dresses');
  });

  it('hides the count badge when the cart is empty', () => {
    renderHeader(0);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the item count', () => {
    renderHeader(3);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onCartClick and is the fly-to-cart target', async () => {
    const user = userEvent.setup();
    const { onCartClick } = renderHeader(1);
    const button = document.querySelector(`[${CART_ICON_ATTR}]`) as HTMLElement;
    expect(button).not.toBeNull();
    await user.click(button);
    expect(onCartClick).toHaveBeenCalledTimes(1);
  });
});
