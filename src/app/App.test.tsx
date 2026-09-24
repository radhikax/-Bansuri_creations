import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import App from './App';
import { server } from '../test/server';
import { API_URL } from '../test/fixtures';

function goTo(path: string) {
  window.history.pushState({}, '', path);
}

beforeEach(() => goTo('/'));

describe('App (with mocked API)', () => {
  it('shows skeletons while loading, then the storefront', async () => {
    render(<App />);
    expect(screen.queryByText('Shop by Category')).not.toBeInTheDocument();
    expect(await screen.findByText('Shop by Category')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kanha Poshak' })).toBeInTheDocument();
  });

  it('shows an error message when the API fails', async () => {
    server.use(http.get(`${API_URL}/api/products`, () => new HttpResponse(null, { status: 500 })));
    render(<App />);
    expect(await screen.findByText("Couldn't load products or categories. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText('Shop by Category')).not.toBeInTheDocument();
  });

  it('shows an error when categories fail too', async () => {
    server.use(http.get(`${API_URL}/api/categories`, () => HttpResponse.error()));
    render(<App />);
    expect(await screen.findByText("Couldn't load products or categories. Please try again.")).toBeInTheDocument();
  });

  it('renders a category page from the URL', async () => {
    goTo('/category/kanha-dresses');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Kanha Dresses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kanha Poshak' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Brass Diya' })).not.toBeInTheDocument();
  });

  it('renders a product page from the URL', async () => {
    goTo('/product/brass-diya');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Brass Diya' })).toBeInTheDocument();
  });

  it('shows not-found for an unknown product', async () => {
    goTo('/product/ghost');
    render(<App />);
    expect(await screen.findByText("We couldn't find that product.")).toBeInTheDocument();
  });

  it('adds to cart, opens the cart, and merges duplicate additions', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Featured Products');

    const addDiya = () => {
      const card = screen.getByRole('heading', { name: 'Brass Diya' }).closest('[data-slot="card"]') as HTMLElement;
      return within(card).getByRole('button', { name: /add to cart/i });
    };

    await user.click(addDiya());
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Shopping Cart (1)')).toBeInTheDocument();
    expect(within(dialog).getByText('₹550')).toBeInTheDocument(); // 500 + 50 shipping

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // "Added!" confirmation resets after ~900ms
    await waitFor(() => expect(addDiya()).toBeEnabled(), { timeout: 5000 });
    await user.click(addDiya());

    dialog = await screen.findByRole('dialog');
    // same product merges into one line with quantity 2
    expect(within(dialog).getByText('Shopping Cart (1)')).toBeInTheDocument();
    expect(within(dialog).getByText('₹1050')).toBeInTheDocument(); // 2 x 500 + 50
  });

  it('navigates from a category card to its page', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Shop by Category');
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: /Kanha Dresses/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Kanha Dresses' })).toBeInTheDocument();
  });

  it('renders the admin section independently of the storefront\'s own data state', async () => {
    server.use(http.get(`${API_URL}/api/products`, () => new HttpResponse(null, { status: 500 })));
    goTo('/admin');
    render(<App />);
    // Longer timeout: this chain is a lazy import + Suspense + a real MSW round trip
    // for the admin bootstrap query, which can run close to the default 1000ms under load.
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load products or categories. Please try again.")).not.toBeInTheDocument();
  });
});
