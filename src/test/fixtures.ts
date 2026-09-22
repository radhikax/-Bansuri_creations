import type { ApiCategory, ApiProduct, ApiProductVariant } from '../app/lib/api';
import type { Product } from '../app/types';

export const API_URL = 'http://localhost:4000';

export function makeApiCategory(overrides: Partial<ApiCategory> = {}): ApiCategory {
  return {
    id: 'cat-1',
    name: 'Diwali Decor',
    slug: 'diwali-decor',
    description: 'Lights and lanterns',
    imageUrl: 'https://img.test/cat.jpg',
    icon: '🪔',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeApiVariant(overrides: Partial<ApiProductVariant> = {}): ApiProductVariant {
  return {
    id: 'var-1',
    productId: 'prod-1',
    label: 'Default',
    price: null,
    stock: 5,
    sku: 'SKU-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeApiProduct(overrides: Partial<ApiProduct> = {}): ApiProduct {
  return {
    id: 'prod-1',
    name: 'Brass Diya',
    slug: 'brass-diya',
    description: 'A diya',
    categoryId: 'cat-1',
    category: makeApiCategory(),
    basePrice: 500,
    originalPrice: null,
    imageUrl: 'https://img.test/diya.jpg',
    images: [],
    rating: 4.5,
    isActive: true,
    variants: [makeApiVariant()],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    slug: 'brass-diya',
    name: 'Brass Diya',
    price: 500,
    image: 'https://img.test/diya.jpg',
    images: ['https://img.test/diya.jpg'],
    category: 'Diwali Decor',
    rating: 4.5,
    inStock: true,
    ...overrides,
  };
}

export const sizeVariants = [
  { id: 'v-s', label: 'Small', price: 400, stock: 3 },
  { id: 'v-l', label: 'Large', price: 700, stock: 2 },
  { id: 'v-xl', label: 'XL', price: 900, stock: 0 },
];
