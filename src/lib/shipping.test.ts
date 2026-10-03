import { describe, expect, it } from 'vitest';
import { calculateShipping } from './shipping';

const config = { flatShippingFee: 50, freeShippingThreshold: 999 };

describe('calculateShipping (mirrors the server rule)', () => {
  it.each([
    [0, 0],
    [500, 50],
    [998, 50],
    [999, 0],
    [1598, 0],
  ])('subtotal %i → shipping %i', (subtotal, expected) => {
    expect(calculateShipping(subtotal, config)).toBe(expected);
  });
});
