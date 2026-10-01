'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '../../types';

export type CartItem = Product & { quantity: number; variantId: string };

interface CartContextValue {
  items: CartItem[];
  add: (item: Product) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  count: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// `item.id` is `${productId}::${variantId}` for a multi-variant product
// (see useVariantSelection.buildCartItem), and just `${productId}` for a
// single-variant one — derive variantId from whichever form it takes.
function variantIdFrom(id: string): string {
  const separator = id.indexOf('::');
  return separator === -1 ? id : id.slice(separator + 2);
}

/**
 * TEMPORARY stub for Task 6's useCart(), matching its signature exactly
 * (see .superpowers/sdd/2026-10-01-nextjs-storefront-brand-redesign/task-6-interfaces.md).
 * This is in-memory only (no `bansuri-cart-v1` localStorage persistence) and
 * not wired into app/layout.tsx yet — Task 6 replaces this file's body and
 * wraps the app in it.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      add(item: Product) {
        const variantId = variantIdFrom(item.id);
        setItems((prev) => {
          const existing = prev.find((i) => i.id === item.id);
          if (existing) {
            return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
          }
          return [...prev, { ...item, quantity: 1, variantId }];
        });
      },
      setQuantity(id: string, quantity: number) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
      },
      remove(id: string) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      },
      clear() {
        setItems([]);
      },
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      isOpen,
      open() {
        setIsOpen(true);
      },
      close() {
        setIsOpen(false);
      },
    }),
    [items, isOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
