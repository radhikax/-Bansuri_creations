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

// Same-origin by default: Vite proxies /api in dev and the host rewrites it in
// production, so the admin cookie stays first-party. VITE_API_BASE_URL overrides.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;

export const REQUEST_TIMEOUT_MS = 10_000;

async function fetchJson<T>(path: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request to ${path} timed out`)), REQUEST_TIMEOUT_MS);
  });
  try {
    const res = await Promise.race([fetch(`${API_BASE_URL}${path}`), timeout]);
    if (!res.ok) {
      throw new Error(`Request to ${path} failed with status ${res.status}`);
    }
    return await Promise.race([res.json() as Promise<T>, timeout]);
  } finally {
    clearTimeout(timer);
  }
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

export interface ShippingSettings {
  flatShippingFee: number;
  freeShippingThreshold: number;
}

export function getShippingSettings(): Promise<ShippingSettings> {
  return fetchJson<ShippingSettings>('/api/settings/shipping');
}
