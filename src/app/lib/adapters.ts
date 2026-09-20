import { Product } from '../types';
import { ApiCategory, ApiProduct } from './api';

export interface AdaptedCategory {
  title: string;
  description: string;
  image: string;
  icon: string;
  slug: string;
}

export function adaptCategory(api: ApiCategory): AdaptedCategory {
  return {
    title: api.name,
    description: api.description,
    image: api.imageUrl,
    icon: api.icon,
    slug: api.slug,
  };
}

export function adaptProduct(api: ApiProduct): Product {
  const defaultVariant = api.variants[0];
  const price = defaultVariant?.price ?? api.basePrice;
  const inStock = defaultVariant ? defaultVariant.stock > 0 : false;

  return {
    id: api.id,
    slug: api.slug,
    name: api.name,
    price,
    originalPrice: api.originalPrice ?? undefined,
    image: api.imageUrl,
    images: api.images.length > 0 ? api.images : [api.imageUrl],
    category: api.category.name,
    rating: api.rating,
    inStock,
    variants: api.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price ?? api.basePrice,
      stock: v.stock,
    })),
  };
}
