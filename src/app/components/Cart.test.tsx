import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Cart, type CartItem } from './Cart';
import { makeProduct } from '../../test/fixtures';

const diya: CartItem = { ...makeProduct(), quantity: 2 }; // 2 x 500
const poshak: CartItem = {
  ...makeProduct({ id: 'prod-2', slug: 'kanha-poshak', name: 'Kanha Poshak', price: 800 }),
  quantity: 1,
};

function renderCart(items: CartItem[], overrides: Partial<React.ComponentProps<typeof Cart>> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onUpdateQuantity: vi.fn(),
    onRemoveItem: vi.fn(),
    ...overrides,
  };
  render(<Cart items={items} {...props} />);
  return props;
}

/** Stateful wrapper so quantity/remove behave like the real app. */
function Harness({ initial, onClose }: { initial: CartItem[]; onClose?: () => void }) {
  const [items, setItems] = useState(initial);
  return (
    <Cart
      isOpen
      onClose={onClose ?? (() => {})}
      items={items}
      onUpdateQuantity={(id, quantity) =>
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)))
      }
      onRemoveItem={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
    />
  );
}

describe('Cart', () => {
  it('shows an empty state with no checkout button', () => {
    renderCart([]);
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /proceed to checkout/i })).not.toBeInTheDocument();
  });

  it('lists items with line totals and the item count in the title', () => {
    renderCart([diya, poshak]);
    expect(screen.getByText('Shopping Cart (2)')).toBeInTheDocument();
    expect(screen.getByText('Brass Diya')).toBeInTheDocument();
    expect(screen.getByText('₹1000')).toBeInTheDocument(); // 2 x 500 line total
    expect(screen.getByText('Kanha Poshak')).toBeInTheDocument();
  });

  it('computes subtotal, ₹50 shipping and total', () => {
    renderCart([diya, poshak]); // 1000 + 800
    const summary = screen.getByText('Subtotal').parentElement!;
    expect(within(summary).getByText('₹1800')).toBeInTheDocument();
    expect(screen.getByText('₹50')).toBeInTheDocument();
    expect(screen.getByText('₹1850')).toBeInTheDocument();
  });

  it('increments and decrements quantity through callbacks', async () => {
    const user = userEvent.setup();
    const props = renderCart([diya]);
    const buttons = screen.getAllByRole('button');
    const minus = buttons.find((b) => b.querySelector('svg.lucide-minus'))!;
    const plus = buttons.find((b) => b.querySelector('svg.lucide-plus'))!;
    await user.click(plus);
    expect(props.onUpdateQuantity).toHaveBeenLastCalledWith('prod-1', 3);
    await user.click(minus);
    expect(props.onUpdateQuantity).toHaveBeenLastCalledWith('prod-1', 1);
  });

  it('never decrements below 1', async () => {
    const user = userEvent.setup();
    const props = renderCart([{ ...diya, quantity: 1 }]);
    const minus = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-minus'))!;
    await user.click(minus);
    expect(props.onUpdateQuantity).toHaveBeenCalledWith('prod-1', 1);
  });

  it('removes an item', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[diya, poshak]} />);
    const trash = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-trash-2'))!;
    await user.click(trash);
    expect(screen.queryByText('Brass Diya')).not.toBeInTheDocument();
    expect(screen.getByText('Kanha Poshak')).toBeInTheDocument();
    expect(screen.getByText('Shopping Cart (1)')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderCart([diya], { isOpen: false });
    expect(screen.queryByText(/shopping cart/i)).not.toBeInTheDocument();
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

    it('starts on the shipping step with Continue disabled until every field is filled', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[diya]} />);
      await openCheckout(user);
      expect(screen.getByRole('heading', { name: 'Shipping' })).toBeInTheDocument();
      const next = screen.getByRole('button', { name: 'Continue' });
      expect(next).toBeDisabled();

      await fillShipping(user);
      expect(next).toBeEnabled();
    });

    it('keeps Continue disabled when a field is only whitespace', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[diya]} />);
      await openCheckout(user);
      await fillShipping(user);
      await user.clear(screen.getByLabelText('City'));
      await user.type(screen.getByLabelText('City'), '   ');
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('cancel closes the dialog', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[diya]} />);
      await openCheckout(user);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'Shipping' })).not.toBeInTheDocument();
    });

    it('walks shipping → payment → review and pays', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Harness initial={[diya]} onClose={onClose} />);
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
      expect(onClose).toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Review' })).not.toBeInTheDocument();
    });

    it('back navigation preserves the entered shipping details', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[diya]} />);
      await openCheckout(user);
      await fillShipping(user);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await screen.findByText('1 item in cart');
      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(await screen.findByLabelText('Full name')).toHaveValue('Asha Rao');
    });

    it('defaults payment to UPI', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[diya]} />);
      await openCheckout(user);
      await fillShipping(user);
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await screen.findByText('1 item in cart');
      expect(screen.getByLabelText(/^UPI/)).toBeChecked();
    });
  });
});
