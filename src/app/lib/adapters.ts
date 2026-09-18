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
    name: api.name,
    price,
    originalPrice: api.originalPrice ?? undefined,
    image: api.imageUrl,
    category: api.category.name,
    rating: api.rating,
    inStock,
  };
}
