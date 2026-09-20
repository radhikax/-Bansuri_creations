export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProductVariant {
  id: string;
  productId: string;
  label: string;
  price: number | null;
  stock: number;
  sku: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  category: ApiCategory;
  basePrice: number;
  originalPrice: number | null;
  imageUrl: string;
  images: string[];
  rating: number;
  isActive: boolean;
  variants: ApiProductVariant[];
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getCategories(): Promise<ApiCategory[]> {
  return fetchJson<ApiCategory[]>('/api/categories');
}

export function getProducts(categorySlug?: string): Promise<ApiProduct[]> {
  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : '';
  return fetchJson<ApiProduct[]>(`/api/products${query}`);
}

export function getProductBySlug(slug: string): Promise<ApiProduct> {
  return fetchJson<ApiProduct>(`/api/products/${encodeURIComponent(slug)}`);
}
