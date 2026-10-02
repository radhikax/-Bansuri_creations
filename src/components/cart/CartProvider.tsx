'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
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

const STORAGE_KEY = 'bansuri-cart-v1';

// `item.id` is `${productId}::${variantId}` for a multi-variant product
// (see useVariantSelection.buildCartItem), and just `${productId}` for a
// single-variant one — derive variantId from whichever form it takes.
function variantIdFrom(id: string): string {
  const separator = id.indexOf('::');
  return separator === -1 ? id : id.slice(separator + 2);
}

type Action =
  | { type: 'hydrate'; items: CartItem[] }
  | { type: 'add'; item: Product }
  | { type: 'setQuantity'; id: string; quantity: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

function cartReducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'hydrate':
      return action.items;
    case 'add': {
      const existing = state.find((i) => i.id === action.item.id);
      if (existing) {
        return state.map((i) => (i.id === action.item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...state, { ...action.item, quantity: 1, variantId: variantIdFrom(action.item.id) }];
    }
    case 'setQuantity':
      return state.map((i) => (i.id === action.id ? { ...i, quantity: action.quantity } : i));
    case 'remove':
      return state.filter((i) => i.id !== action.id);
    case 'clear':
      return [];
    default:
      return state;
  }
}

/** Invalid JSON, a missing key or an unexpected shape all mean an empty cart — never throw. */
function loadCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) {
      return [];
    }
    return (parsed as { items: CartItem[] }).items;
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted items after mount — localStorage isn't available during SSR,
  // and an empty cart until then is the correct state either way.
  useEffect(() => {
    dispatch({ type: 'hydrate', items: loadCart() });
    setHydrated(true);
  }, []);

  // Persist on every change, but only once the initial load above has run —
  // otherwise this would overwrite storage with `[]` before it's read.
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items }));
  }, [items, hydrated]);

  // Stable across renders (useCallback, not recreated with `items`/`isOpen`) —
  // a consumer effect depending on e.g. `open` must not re-fire on every cart change.
  const add = useCallback((item: Product) => dispatch({ type: 'add', item }), []);
  const setQuantity = useCallback((id: string, quantity: number) => dispatch({ type: 'setQuantity', id, quantity }), []);
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo<CartContextValue>(
    () => ({ items, add, setQuantity, remove, clear, count, isOpen, open, close }),
    [items, add, setQuantity, remove, clear, count, isOpen, open, close],
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
