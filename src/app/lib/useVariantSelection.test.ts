import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVariantSelection } from './useVariantSelection';
import { makeProduct, sizeVariants } from '../../test/fixtures';

describe('useVariantSelection', () => {
  it('uses the product price and stock when there are no variants', () => {
    const { result } = renderHook(() => useVariantSelection(makeProduct({ price: 500, inStock: false })));
    expect(result.current.hasMultipleVariants).toBe(false);
    expect(result.current.price).toBe(500);
    expect(result.current.inStock).toBe(false);
  });

  it('defaults to the first variant', () => {
    const { result } = renderHook(() => useVariantSelection(makeProduct({ variants: sizeVariants })));
    expect(result.current.hasMultipleVariants).toBe(true);
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.price).toBe(400);
  });

  it('updates price and stock when another variant is selected', () => {
    const { result } = renderHook(() => useVariantSelection(makeProduct({ variants: sizeVariants })));
    act(() => result.current.setSelectedIndex(2));
    expect(result.current.price).toBe(900);
    expect(result.current.inStock).toBe(false);
  });

  it('computes a rounded discount only when originalPrice exceeds the price', () => {
    const { result } = renderHook(() =>
      useVariantSelection(makeProduct({ price: 750, originalPrice: 1000 })),
    );
    expect(result.current.showDiscount).toBe(true);
    expect(result.current.discount).toBe(25);

    const same = renderHook(() => useVariantSelection(makeProduct({ price: 500, originalPrice: 500 })));
    expect(same.result.current.showDiscount).toBe(false);
    expect(same.result.current.discount).toBe(0);

    const none = renderHook(() => useVariantSelection(makeProduct()));
    expect(none.result.current.showDiscount).toBe(false);
  });

  it('recomputes the discount against the selected variant price', () => {
    const { result } = renderHook(() =>
      useVariantSelection(makeProduct({ variants: sizeVariants, originalPrice: 1000 })),
    );
    expect(result.current.discount).toBe(60);
    act(() => result.current.setSelectedIndex(1));
    expect(result.current.discount).toBe(30);
  });

  describe('buildCartItem', () => {
    it('returns the product unchanged when there is a single variant', () => {
      const product = makeProduct({ variants: [sizeVariants[0]] });
      const { result } = renderHook(() => useVariantSelection(product));
      expect(result.current.buildCartItem()).toBe(product);
    });

    it('returns a variant-specific cart item for multi-variant products', () => {
      const product = makeProduct({ variants: sizeVariants });
      const { result } = renderHook(() => useVariantSelection(product));
      act(() => result.current.setSelectedIndex(1));
      expect(result.current.buildCartItem()).toMatchObject({
        id: 'prod-1::v-l',
        name: 'Brass Diya (Large)',
        price: 700,
        inStock: true,
      });
    });

    it('does not append the label when the variant is called Default', () => {
      const product = makeProduct({
        variants: [
          { id: 'a', label: 'Default', price: 100, stock: 1 },
          { id: 'b', label: 'Other', price: 200, stock: 1 },
        ],
      });
      const { result } = renderHook(() => useVariantSelection(product));
      expect(result.current.buildCartItem().name).toBe('Brass Diya');
      expect(result.current.buildCartItem().id).toBe('prod-1::a');
    });
  });
});
