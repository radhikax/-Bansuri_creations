import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { http, HttpResponse } from 'msw';
import { Cart } from './Cart';
import { CartProvider, useCart, type CartItem } from './cart/CartProvider';
import { server } from '../test/server';
import { API_URL, makeProduct } from '../test/fixtures';

const STORAGE_KEY = 'bansuri-cart-v1';

const diya: CartItem = { ...makeProduct(), quantity: 2, variantId: 'prod-1' }; // 2 x 500
const poshak: CartItem = {
  ...makeProduct({ id: 'prod-2', slug: 'kanha-poshak', name: 'Kanha Poshak', price: 800 }),
  quantity: 1,
  variantId: 'prod-2',
};

// A high threshold keeps the existing ₹50-shipping assertions meaningful.
const testShipping = { flatShippingFee: 50, freeShippingThreshold: 5000 };

function mockShipping(settings: { flatShippingFee: number; freeShippingThreshold: number }) {
  server.use(http.get(`${API_URL}/api/settings/shipping`, () => HttpResponse.json(settings)));
}

/** Opens the cart sheet on mount — in the real app, Header's cart button does this via useCart().open(). */
function AutoOpen() {
  const { open } = useCart();
  useEffect(() => {
    open();
  }, [open]);
  return null;
}

function renderCart(items: CartItem[] = [], { opened = true } = {}) {
  if (items.length > 0) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items }));
  }
  render(
    <CartProvider>
      {opened && <AutoOpen />}
      <Cart />
    </CartProvider>,
  );
}

function itemRow(name: string) {
  return screen.getByText(name).closest('div')!;
}

beforeEach(() => {
  window.localStorage.clear();
  mockShipping(testShipping);
});

describe('Cart', () => {
  it('shows an empty state with no checkout button', async () => {
    renderCart([]);
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /proceed to checkout/i })).not.toBeInTheDocument();
  });

  it('lists items with line totals and the item count in the title', async () => {
    renderCart([diya, poshak]);
    expect(await screen.findByText('Shopping Cart (2)')).toBeInTheDocument();
    expect(screen.getByText('Brass Diya')).toBeInTheDocument();
    expect(screen.getByText('₹1000')).toBeInTheDocument(); // 2 x 500 line total
    expect(screen.getByText('Kanha Poshak')).toBeInTheDocument();
  });

  it('computes subtotal, ₹50 shipping and total', async () => {
    renderCart([diya, poshak]); // 1000 + 800
    await screen.findByText('Shopping Cart (2)');
    const summary = screen.getByText('Subtotal').parentElement!;
    await waitFor(() => expect(screen.getByText('₹50')).toBeInTheDocument());
    expect(within(summary).getByText('₹1800')).toBeInTheDocument();
    expect(screen.getByText('₹1850')).toBeInTheDocument();
  });

  it('increments and decrements quantity', async () => {
    const user = userEvent.setup();
    renderCart([{ ...diya, quantity: 1 }]);
    await screen.findByText('Brass Diya');
    const row = itemRow('Brass Diya');
    const minus = within(row).getAllByRole('button').find((b) => b.querySelector('svg.lucide-minus'))!;
    const plus = within(row).getAllByRole('button').find((b) => b.querySelector('svg.lucide-plus'))!;

    await user.click(plus);
    expect(within(row).getByText('2')).toBeInTheDocument();
    await user.click(minus);
    expect(within(row).getByText('1')).toBeInTheDocument();
  });

  it('never decrements below 1', async () => {
    const user = userEvent.setup();
    renderCart([{ ...diya, quantity: 1 }]);
    await screen.findByText('Brass Diya');
    const row = itemRow('Brass Diya');
    const minus = within(row).getAllByRole('button').find((b) => b.querySelector('svg.lucide-minus'))!;
    await user.click(minus);
    expect(within(row).getByText('1')).toBeInTheDocument();
  });

  it('removes an item', async () => {
    const user = userEvent.setup();
    renderCart([diya, poshak]);
    await screen.findByText('Brass Diya');
    const row = itemRow('Brass Diya');
    const trash = within(row).getAllByRole('button').find((b) => b.querySelector('svg.lucide-trash-2'))!;
    await user.click(trash);
    expect(screen.queryByText('Brass Diya')).not.toBeInTheDocument();
    expect(screen.getByText('Kanha Poshak')).toBeInTheDocument();
    expect(screen.getByText('Shopping Cart (1)')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderCart([diya], { opened: false });
    expect(screen.queryByText(/shopping cart/i)).not.toBeInTheDocument();
  });

  it('shows free shipping at or above the store threshold', async () => {
    mockShipping({ flatShippingFee: 50, freeShippingThreshold: 999 });
    renderCart([diya, poshak]); // 1800
    await screen.findByText('Shopping Cart (2)');
    const summary = screen.getByText('Subtotal').closest('div')!.parentElement!;
    await waitFor(() => expect(within(summary).getByText('Free')).toBeInTheDocument());
    expect(within(summary).getAllByText('₹1800')).toHaveLength(2); // subtotal and total
  });

  it('charges the flat fee below the store threshold', async () => {
    mockShipping({ flatShippingFee: 75, freeShippingThreshold: 999 });
    renderCart([{ ...diya, quantity: 1 }]); // 500
    await screen.findByText('Shopping Cart (1)');
    await waitFor(() => expect(screen.getByText('₹75')).toBeInTheDocument());
    expect(screen.getByText('₹575')).toBeInTheDocument();
  });

  it('says "Calculated at checkout" and totals the subtotal when settings are unavailable', async () => {
    server.use(http.get(`${API_URL}/api/settings/shipping`, () => HttpResponse.error()));
    renderCart([diya, poshak]); // 1800
    await screen.findByText('Shopping Cart (2)');
    await waitFor(() => expect(screen.getByText('Calculated at checkout')).toBeInTheDocument());
    expect(screen.getAllByText('₹1800')).toHaveLength(2);
  });

  describe('checkout flow', () => {
    const alertSpy = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('alert', alertSpy);
    });
    afterEach(() => {
      alertSpy.mockClear();
      vi.unstubAllGlobals();
    });

    async function openCheckout(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /proceed to checkout/i }));
      return screen.findByRole('dialog');
    }

    async function fillShipping(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Full name'), 'Asha Rao');
      await user.type(screen.getByLabelText('Address'), '12 MG Road');
      await user.type(screen.getByLabelText('City'), 'Pune');
      await user.type(screen.getByLabelText('State'), 'MH');
      await user.type(screen.getByLabelText('Pincode'), '411001');
      await user.type(screen.getByLabelText('Phone'), '9876543210');
    }

    it('closes the cart sheet and opens the checkout dialog on Proceed to Checkout', async () => {
      const user = userEvent.setup();
      renderCart([diya]);
      await screen.findByRole('dialog', { name: /shopping cart/i });

      await user.click(screen.getByRole('button', { name: /proceed to checkout/i }));

      expect(screen.queryByRole('dialog', { name: /shopping cart/i })).not.toBeInTheDocument();
      expect(await screen.findByRole('dialog', { name: 'Shipping' })).toBeInTheDocument();
    });

    it('Back to cart closes the checkout dialog and reopens the cart sheet', async () => {
      const user = userEvent.setup();
      renderCart([diya]);
      await openCheckout(user);
      await screen.findByRole('dialog', { name: 'Shipping' });

      await user.click(screen.getByRole('button', { name: 'Back to cart' }));

      expect(screen.queryByRole('dialog', { name: 'Shipping' })).not.toBeInTheDocument();
      expect(await screen.findByRole('dialog', { name: /shopping cart/i })).toBeInTheDocument();
    });

    it('starts on the shipping step with Continue disabled until every field is filled', async () => {
      const user = userEvent.setup();
      renderCart([diya]);
      await openCheckout(user);
      expect(screen.getByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
      const next = screen.getByRole('button', { name: 'Continue' });
      expect(next).toBeDisabled();

      await fillShipping(user);
      expect(next).toBeEnabled();
    });

    it('keeps Continue disabled when a field is only whitespace', async () => {
      const user = userEvent.setup();
      renderCart([diya]);
      await openCheckout(user);
      await fillShipping(user);
      await user.clear(screen.getByLabelText('City'));
      await user.type(screen.getByLabelText('City'), '   ');
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('walks shipping → payment → review and pays', async () => {
      const user = userEvent.setup();
      renderCart([diya]);
      await openCheckout(user);
      await fillShipping(user);
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByText('1 item in cart')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument();
      await user.click(screen.getByLabelText(/cash on delivery/i));
      await user.click(screen.getByRole('button', { name: 'Review Order' }));

      expect(await screen.findByText(/Asha Rao, 12 MG Road, Pune/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument();
      expect(screen.getByText('9876543210')).toBeInTheDocument();
      expect(screen.getByText('Cash on Delivery')).toBeInTheDocument();
      // 2 x 500 + 50 shipping
      await user.click(screen.getByRole('button', { name: 'Pay ₹1050' }));

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('cod'));
      expect(screen.queryByRole('heading', { name: 'Review' })).not.toBeInTheDocument();
      // Paying doesn't reopen the cart sheet — it was already closed by Proceed to Checkout.
      expect(screen.queryByRole('dialog', { name: /shopping cart/i })).not.toBeInTheDocument();
    });

    it('back navigation preserves the entered shipping details', async () => {
      const user = userEvent.setup();
      renderCart([diya]);
      await openCheckout(user);
      await fillShipping(user);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await screen.findByText('1 item in cart');
      await user.click(screen.getByRole('button', { name: /^back$/i }));

      expect(await screen.findByLabelText('Full name')).toHaveValue('Asha Rao');
    });

    it('defaults payment to UPI', async () => {
      const user = userEvent.setup();
      renderCart([diya]);
      await openCheckout(user);
      await fillShipping(user);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await screen.findByText('1 item in cart');
      expect(screen.getByLabelText(/^UPI/)).toBeChecked();
    });
  });
});
