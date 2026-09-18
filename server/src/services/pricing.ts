export class OrderValidationError extends Error {}

export interface CartItemInput {
  variantId: string;
  quantity: number;
}

export interface VariantForPricing {
  id: string;
  price: number | null;
  stock: number;
  product: { basePrice: number };
}

export function resolveUnitPrice(variant: VariantForPricing): number {
  return variant.price ?? variant.product.basePrice;
}

export function validateStock(items: CartItemInput[], variants: VariantForPricing[]): void {
  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) {
      throw new OrderValidationError(`Item ${item.variantId} is no longer available`);
    }
    if (variant.stock < item.quantity) {
      throw new OrderValidationError(`Insufficient stock for item ${item.variantId}`);
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
