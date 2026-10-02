import { useState } from 'react';
import { Product } from '../types';

export function useVariantSelection(product: Product) {
  const variants = product.variants ?? [];
  const hasMultipleVariants = variants.length > 1;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectedVariant = variants[selectedIndex];
  const price = selectedVariant?.price ?? product.price;
  const inStock = selectedVariant ? selectedVariant.stock > 0 : product.inStock;
  const showDiscount = product.originalPrice != null && product.originalPrice > price;
  const discount = showDiscount
    ? Math.round(((product.originalPrice! - price) / product.originalPrice!) * 100)
    : 0;

  function buildCartItem(): Product {
    if (!hasMultipleVariants || !selectedVariant) return product;
    return {
      ...product,
      id: `${product.id}::${selectedVariant.id}`,
      name: selectedVariant.label === 'Default' ? product.name : `${product.name} (${selectedVariant.label})`,
      price: selectedVariant.price,
      inStock: selectedVariant.stock > 0,
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
