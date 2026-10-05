import { useState } from 'react';
import { Product } from '../types';

export function useVariantSelection(product: Product) {
  const variants = product.variants ?? [];
  const hasMultipleVariants = variants.length > 1;
  // Until the shopper picks a size, default to the first one in stock —
  // derived every render, so it also moves off a variant that live stock
  // later reports sold out. An explicit pick always wins.
  const [pickedIndex, setSelectedIndex] = useState<number | null>(null);
  const firstInStock = variants.findIndex((v) => v.stock > 0);
  const selectedIndex = pickedIndex ?? Math.max(firstInStock, 0);

  const selectedVariant = variants[selectedIndex];
  const price = selectedVariant?.price ?? product.price;
  const inStock = selectedVariant ? selectedVariant.stock > 0 : product.inStock;
  const showDiscount = product.originalPrice != null && product.originalPrice > price;
  const discount = showDiscount
    ? Math.round(((product.originalPrice! - price) / product.originalPrice!) * 100)
    : 0;

  function buildCartItem(): Product & { variantId: string } {
    // No variant at all (shouldn't happen once the catalogue always has a
    // "Default" variant, but stay defensive): fall back to the product id.
    if (!selectedVariant) return { ...product, variantId: product.id };
    // Single variant: keep the product's own id (cart-line identity is
    // unchanged) but carry the real variant id explicitly so checkout sends
    // the id the order API actually looks items up by.
    if (!hasMultipleVariants) return { ...product, variantId: selectedVariant.id };
    return {
      ...product,
      id: `${product.id}::${selectedVariant.id}`,
      name: selectedVariant.label === 'Default' ? product.name : `${product.name} (${selectedVariant.label})`,
      price: selectedVariant.price,
      inStock: selectedVariant.stock > 0,
      variantId: selectedVariant.id,
    };
  }

  return {
    variants,
    hasMultipleVariants,
    selectedIndex,
    setSelectedIndex,
    selectedVariant,
    price,
    inStock,
    showDiscount,
    discount,
    buildCartItem,
  };
}
