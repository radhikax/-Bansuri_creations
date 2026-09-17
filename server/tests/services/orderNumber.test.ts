import { describe, it, expect } from 'vitest';
import { generateOrderNumber } from '../../src/services/orderNumber';

describe('generateOrderNumber', () => {
  it('starts with ORD-', () => {
    expect(generateOrderNumber()).toMatch(/^ORD-[A-Z0-9]+$/);
  });

  it('generates different numbers on successive calls', () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a).not.toBe(b);
  });
});
