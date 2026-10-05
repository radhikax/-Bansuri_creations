export class OrderValidationError extends Error {}

export interface CartItemInput {
  variantId: string;
  quantity: number;
}

export interface VariantForPricing {
  id: string;
  price: number | null;
  stock: number;
  product: { basePrice: number; isActive: boolean };
}

export function resolveUnitPrice(variant: VariantForPricing): number {
  return variant.price ?? variant.product.basePrice;
}

export function validateStock(items: CartItemInput[], variants: VariantForPricing[]): void {
  // Sum requested quantity per variant first: the same variant can appear on more than one
  // line, and checking each line against stock independently would let the total oversell.
  const requestedByVariant = new Map<string, number>();
  for (const item of items) {
    requestedByVariant.set(item.variantId, (requestedByVariant.get(item.variantId) ?? 0) + item.quantity);
  }

  for (const [variantId, quantity] of requestedByVariant) {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant || !variant.product.isActive) {
      throw new OrderValidationError(`Item ${variantId} is no longer available`);
    }
    if (variant.stock < quantity) {
      throw new OrderValidationError(`Insufficient stock for item ${variantId}`);
    }
  }
}

export interface ShippingConfig {
  flatShippingFee: number;
  freeShippingThreshold: number;
}

export function computeOrderTotals(
  items: CartItemInput[],
  variants: VariantForPricing[],
  settings: ShippingConfig
): { subtotal: number; shippingFee: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    const variant = variants.find((v) => v.id === item.variantId)!;
    return sum + resolveUnitPrice(variant) * item.quantity;
  }, 0);
  const shippingFee = subtotal >= settings.freeShippingThreshold ? 0 : settings.flatShippingFee;
  return { subtotal, shippingFee, total: subtotal + shippingFee };
}
