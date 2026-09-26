import { describe, it, expect } from 'vitest';
import { resolveUnitPrice, validateStock, computeOrderTotals, OrderValidationError } from '../../src/services/pricing';

const variants = [
  { id: 'v1', price: null, stock: 5, product: { basePrice: 500, isActive: true } },
  { id: 'v2', price: 800, stock: 2, product: { basePrice: 500, isActive: true } },
  { id: 'v3', price: 300, stock: 10, product: { basePrice: 300, isActive: false } },
];

describe('resolveUnitPrice', () => {
  it('uses the variant price when set', () => {
    expect(resolveUnitPrice(variants[1])).toBe(800);
  });

  it('falls back to the product base price when variant price is null', () => {
    expect(resolveUnitPrice(variants[0])).toBe(500);
  });
});

describe('validateStock', () => {
  it('passes when stock is sufficient', () => {
    expect(() => validateStock([{ variantId: 'v1', quantity: 3 }], variants)).not.toThrow();
  });

  it('throws OrderValidationError when stock is insufficient', () => {
    expect(() => validateStock([{ variantId: 'v2', quantity: 5 }], variants)).toThrow(OrderValidationError);
  });

  it('throws OrderValidationError for an unknown variant', () => {
    expect(() => validateStock([{ variantId: 'missing', quantity: 1 }], variants)).toThrow(OrderValidationError);
  });

  it('throws OrderValidationError for a variant on an inactive product', () => {
    expect(() => validateStock([{ variantId: 'v3', quantity: 1 }], variants)).toThrow(OrderValidationError);
  });

  it('sums quantity for the same variant repeated across lines', () => {
    // v2 has stock 2: two lines of 1 each fit individually but not combined.
    expect(() =>
      validateStock([{ variantId: 'v2', quantity: 1 }, { variantId: 'v2', quantity: 1 }], variants),
    ).not.toThrow();
    expect(() =>
      validateStock([{ variantId: 'v2', quantity: 1 }, { variantId: 'v2', quantity: 2 }], variants),
    ).toThrow(OrderValidationError);
  });
});

describe('computeOrderTotals', () => {
  const settings = { flatShippingFee: 50, freeShippingThreshold: 999 };

  it('adds flat shipping below the free-shipping threshold', () => {
    const totals = computeOrderTotals([{ variantId: 'v1', quantity: 1 }], variants, settings);
    expect(totals).toEqual({ subtotal: 500, shippingFee: 50, total: 550 });
  });

  it('waives shipping at or above the free-shipping threshold', () => {
    const totals = computeOrderTotals([{ variantId: 'v2', quantity: 2 }], variants, settings);
    expect(totals).toEqual({ subtotal: 1600, shippingFee: 0, total: 1600 });
  });
});
