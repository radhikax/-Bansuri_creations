import type { ApiCategory, ApiProduct, ApiProductVariant } from '../../lib/api';

export type { ApiCategory, ApiProduct, ApiProductVariant };

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type AdminSettableOrderStatus = 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface AdminOrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string;
  unitPrice: number;
  quantity: number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPincode: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  items: AdminOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  id: number;
  flatShippingFee: number;
  freeShippingThreshold: number;
}

export interface AdminVariantInput {
  label: string;
  price?: number;
  stock: number;
  sku: string;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  basePrice: number;
  originalPrice?: number;
  imageUrl: string;
  images?: string[];
  variants: AdminVariantInput[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: string;
  basePrice?: number;
  originalPrice?: number | null;
  imageUrl?: string;
  images?: string[];
  isActive?: boolean;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
}

// Same-origin by default: Vite proxies /api in dev and the host rewrites it in
// production, so the admin cookie stays first-party. VITE_API_BASE_URL overrides.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;

export class AdminUnauthorizedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'AdminUnauthorizedError';
  }
}

export class AdminApiError extends Error {
  details?: unknown;
  status?: number;
  constructor(message: string, details?: unknown, status?: number) {
    super(message);
    this.name = 'AdminApiError';
    this.details = details;
    this.status = status;
  }
}

async function adminFetch<T>(
  path: string,
  init?: RequestInit,
  opts: { unauthorizedIsError?: boolean } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (res.status === 401 && !opts.unauthorizedIsError) {
    throw new AdminUnauthorizedError();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; details?: unknown };
    throw new AdminApiError(body.error ?? `Request to ${path} failed with status ${res.status}`, body.details, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// Auth. adminLogin's 401 is a normal "wrong credentials" failure, not a session
// expiry — it must not trigger the central redirect-to-login handling.
export function adminLogin(email: string, password: string): Promise<{ success: true }> {
  return adminFetch(
    '/api/admin/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    { unauthorizedIsError: true },
  );
}

export function adminLogout(): Promise<{ success: true }> {
  return adminFetch('/api/admin/logout', { method: 'POST' });
}

// A 401 with "Current password is incorrect" here means the current password
// is wrong, not an expired session, so it must not trigger the central
// redirect-to-login handling (same as adminLogin). Any other 401 (e.g. the
// middleware's "Not authenticated" / "Invalid session" for a session revoked
// by a password change elsewhere) is re-thrown as AdminUnauthorizedError so
// that central handling still redirects to login.
const WRONG_CURRENT_PASSWORD_MESSAGE = 'Current password is incorrect';

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await adminFetch(
      '/api/admin/password',
      { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
      { unauthorizedIsError: true },
    );
  } catch (err) {
    if (err instanceof AdminApiError && err.status === 401 && err.message !== WRONG_CURRENT_PASSWORD_MESSAGE) {
      throw new AdminUnauthorizedError();
    }
    throw err;
  }
}

// Settings
export function getStoreSettings(): Promise<StoreSettings> {
  return adminFetch('/api/admin/settings');
}

export function updateStoreSettings(data: { flatShippingFee: number; freeShippingThreshold: number }): Promise<StoreSettings> {
  return adminFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
}

// Products
export function getAdminProducts(): Promise<ApiProduct[]> {
  return adminFetch('/api/admin/products');
}

export function createAdminProduct(data: CreateProductInput): Promise<ApiProduct> {
  return adminFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdminProduct(id: string, data: UpdateProductInput): Promise<ApiProduct> {
  return adminFetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function updateAdminVariant(productId: string, variantId: string, data: AdminVariantInput): Promise<ApiProductVariant> {
  return adminFetch(
    `/api/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
}

// Categories
export function getAdminCategories(): Promise<ApiCategory[]> {
  return adminFetch('/api/admin/categories');
}

export function createAdminCategory(data: CategoryInput): Promise<ApiCategory> {
  return adminFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAdminCategory(id: string, data: Partial<CategoryInput>): Promise<ApiCategory> {
  return adminFetch(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteAdminCategory(id: string): Promise<void> {
  return adminFetch(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// Orders
export function getAdminOrders(status?: OrderStatus): Promise<AdminOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminFetch(`/api/admin/orders${query}`);
}

export function updateAdminOrderStatus(id: string, status: AdminSettableOrderStatus): Promise<AdminOrder> {
  return adminFetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}
