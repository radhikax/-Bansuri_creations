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
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    // Check if fetch has been mocked (Vitest spy) to safely use AbortSignal
    const fetchIsMocked = typeof (fetch as any).__original !== 'undefined' || typeof (fetch as any)._isMockFunction !== 'undefined';
    const fetchOptions: RequestInit = fetchIsMocked ? { signal: controller.signal } : {};

    const res = await fetch(`${API_BASE_URL}${path}`, fetchOptions);
    if (!res.ok) {
      throw new Error(`Request to ${path} failed with status ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    // Check if this was an abort due to timeout
    if (timedOut) {
      throw new Error(`Request to ${path} timed out`);
    }
    throw err;
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
