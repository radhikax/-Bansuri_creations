import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { CartProvider, useCart } from './CartProvider';
import { makeProduct } from '../../test/fixtures';

const STORAGE_KEY = 'bansuri-cart-v2';

beforeEach(() => {
  window.localStorage.clear();
});

describe('CartProvider', () => {
  it('adding the same item twice increments its quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    const product = makeProduct();

    act(() => result.current.add(product));
    act(() => result.current.add(product));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('falls back to parsing variantId from the item id when none is given', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.add(makeProduct({ id: 'prod-1::var-2' })));
    expect(result.current.items[0].variantId).toBe('var-2');
  });

  it('prefers an explicit variantId over the item id, so a single-variant product keeps its real variant id', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.add({ ...makeProduct({ id: 'prod-3' }), variantId: 'real-variant-id' }));
    const singleVariant = result.current.items.find((i) => i.id === 'prod-3')!;
    expect(singleVariant.variantId).toBe('real-variant-id');
  });

  it('counts the sum of quantities, not the number of line items', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.add(makeProduct()));
    act(() => result.current.add(makeProduct()));
    act(() => result.current.add(makeProduct({ id: 'prod-2' })));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.count).toBe(3);
  });

  it('survives an unmount and remount via localStorage', async () => {
    const first = renderHook(() => useCart(), { wrapper: CartProvider });
    act(() => first.result.current.add(makeProduct()));
    act(() => first.result.current.add(makeProduct({ id: 'prod-2' })));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
      expect(stored.items).toHaveLength(2);
    });

    first.unmount();

    const second = renderHook(() => useCart(), { wrapper: CartProvider });
    await waitFor(() => expect(second.result.current.items).toHaveLength(2));
    expect(second.result.current.count).toBe(2);
  });

  it('gives an empty cart for corrupt storage, without throwing', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{oops');

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.count).toBe(0);
  });

  it('drops saved items that are missing fields or have an invalid price or quantity, keeping the valid ones', async () => {
    const valid = { ...makeProduct(), quantity: 2, variantId: 'v-1' };
    const { name: _name, ...missingName } = { ...makeProduct({ id: 'no-name' }), quantity: 1, variantId: 'v-2' };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 2,
        items: [
          valid,
          { id: 'bare', variantId: 'v-3', quantity: 1 },
          missingName,
          { ...makeProduct({ id: 'no-image' }), image: '', quantity: 1, variantId: 'v-4' },
          { ...makeProduct({ id: 'bad-price' }), price: 'free', quantity: 1, variantId: 'v-5' },
          { ...makeProduct({ id: 'zero-qty' }), quantity: 0, variantId: 'v-6' },
          { ...makeProduct({ id: 'neg-qty' }), quantity: -2, variantId: 'v-7' },
          { ...makeProduct({ id: 'frac-qty' }), quantity: 1.5, variantId: 'v-8' },
          null,
        ],
      }),
    );

    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]).toMatchObject({ id: valid.id, quantity: 2 });
    expect(result.current.count).toBe(2);
  });

  it('gives an empty cart when storage is missing', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    expect(result.current.items).toEqual([]);
  });
});
