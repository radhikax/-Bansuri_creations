import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { CartProvider, useCart } from './CartProvider';
import { makeProduct } from '../../test/fixtures';

const STORAGE_KEY = 'bansuri-cart-v1';

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

  it('takes variantId from the item id', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });

    act(() => result.current.add(makeProduct({ id: 'prod-1::var-2' })));
    expect(result.current.items[0].variantId).toBe('var-2');

    act(() => result.current.add(makeProduct({ id: 'prod-3' })));
    const singleVariant = result.current.items.find((i) => i.id === 'prod-3')!;
    expect(singleVariant.variantId).toBe('prod-3');
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

  it('gives an empty cart when storage is missing', () => {
    const { result } = renderHook(() => useCart(), { wrapper: CartProvider });
    expect(result.current.items).toEqual([]);
  });
});
