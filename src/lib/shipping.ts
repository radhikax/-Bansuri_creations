import type { ShippingSettings } from './api';

/** Same rule as the server's computeOrderTotals: free for an empty cart or at/above the threshold. */
export function calculateShipping(subtotal: number, config: ShippingSettings): number {
  if (subtotal <= 0) return 0;
  return subtotal >= config.freeShippingThreshold ? 0 : config.flatShippingFee;
}
