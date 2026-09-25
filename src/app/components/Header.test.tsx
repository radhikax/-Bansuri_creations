import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { CART_ICON_ATTR } from '../lib/flyToCart';
import type { AdaptedCategory } from '../lib/adapters';

const categories: AdaptedCategory[] = [
  { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' },
  { title: 'Customized Gifting', description: '', image: '', icon: '', slug: 'customized-gifting' },
];

function renderHeader(count: number, onCartClick = vi.fn(), cats: AdaptedCategory[] = categories) {
  render(
    <MemoryRouter>
      <Header cartItemsCount={count} onCartClick={onCartClick} categories={cats} />
    </MemoryRouter>,
  );
  return { onCartClick };
}

describe('Header', () => {
  it('links the brand to home and lists the categories it is given', () => {
    renderHeader(0);
    expect(screen.getByRole('link', { name: /bansuri creations/i })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('link', { name: 'Diwali Decor' })[0]).toHaveAttribute('href', '/category/diwali-decor');
    expect(screen.getAllByRole('link', { name: 'Customized Gifting' })[0]).toHaveAttribute('href', '/category/customized-gifting');
    expect(screen.queryByRole('link', { name: 'Kanha Dresses' })).not.toBeInTheDocument();
  });

  it('shows only Home while categories are loading', () => {
    renderHeader(0, vi.fn(), []);
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Diwali Decor' })).not.toBeInTheDocument();
  });

  it('opens a phone menu with the category links and closes it after a tap', async () => {
    const user = userEvent.setup();
    renderHeader(0);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('dialog', { name: 'Menu' });
    const link = within(menu).getByRole('link', { name: 'Customized Gifting' });
    expect(link).toHaveAttribute('href', '/category/customized-gifting');
    await user.click(link);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
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
