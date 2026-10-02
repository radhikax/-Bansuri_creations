import { browserApi } from '../../lib/api/client';
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

interface AdminErrorBody {
  error?: string;
  details?: unknown;
}

// Unwraps an openapi-fetch `{ data, error, response }` result into the plain
// value the exported functions resolve with, or throws. `browserApi` already
// sets `credentials: 'include'`, so the admin cookie rides along as before.
function unwrap<T>(
  result: { data?: unknown; error?: unknown; response: Response },
  path: string,
  opts: { unauthorizedIsError?: boolean } = {},
): T {
  const { data, error, response } = result;

  if (response.status === 401 && !opts.unauthorizedIsError) {
    throw new AdminUnauthorizedError();
  }
  if (!response.ok) {
    const body = (typeof error === 'object' && error !== null ? error : {}) as AdminErrorBody;
    throw new AdminApiError(body.error ?? `Request to ${path} failed with status ${response.status}`, body.details, response.status);
  }
  return data as T;
}

// Auth. adminLogin's 401 is a normal "wrong credentials" failure, not a session
// expiry — it must not trigger the central redirect-to-login handling.
export async function adminLogin(email: string, password: string): Promise<{ success: true }> {
  const result = await browserApi.POST('/api/admin/login', { body: { email, password } });
  return unwrap<{ success: true }>(result, '/api/admin/login', { unauthorizedIsError: true });
}

export async function adminLogout(): Promise<{ success: true }> {
  const result = await browserApi.POST('/api/admin/logout');
  return unwrap<{ success: true }>(result, '/api/admin/logout');
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
    const result = await browserApi.POST('/api/admin/password', { body: { currentPassword, newPassword } });
    unwrap<{ success: true }>(result, '/api/admin/password', { unauthorizedIsError: true });
  } catch (err) {
    if (err instanceof AdminApiError && err.status === 401 && err.message !== WRONG_CURRENT_PASSWORD_MESSAGE) {
      throw new AdminUnauthorizedError();
    }
    throw err;
  }
}

// Settings
export async function getStoreSettings(): Promise<StoreSettings> {
  const result = await browserApi.GET('/api/admin/settings');
  return unwrap<StoreSettings>(result, '/api/admin/settings');
}

export async function updateStoreSettings(data: { flatShippingFee: number; freeShippingThreshold: number }): Promise<StoreSettings> {
  const result = await browserApi.PUT('/api/admin/settings', { body: data });
  return unwrap<StoreSettings>(result, '/api/admin/settings');
}

// Products
export async function getAdminProducts(): Promise<ApiProduct[]> {
  const result = await browserApi.GET('/api/admin/products');
  return unwrap<ApiProduct[]>(result, '/api/admin/products');
}

export async function createAdminProduct(data: CreateProductInput): Promise<ApiProduct> {
  const result = await browserApi.POST('/api/admin/products', { body: data });
  return unwrap<ApiProduct>(result, '/api/admin/products');
}

export async function updateAdminProduct(id: string, data: UpdateProductInput): Promise<ApiProduct> {
  const result = await browserApi.PUT('/api/admin/products/{id}', { params: { path: { id } }, body: data });
  return unwrap<ApiProduct>(result, `/api/admin/products/${id}`);
}

export async function updateAdminVariant(productId: string, variantId: string, data: AdminVariantInput): Promise<ApiProductVariant> {
  const result = await browserApi.PUT('/api/admin/products/{id}/variants/{variantId}', {
    params: { path: { id: productId, variantId } },
    body: data,
  });
  return unwrap<ApiProductVariant>(result, `/api/admin/products/${productId}/variants/${variantId}`);
}

// Categories
export async function getAdminCategories(): Promise<ApiCategory[]> {
  const result = await browserApi.GET('/api/admin/categories');
  return unwrap<ApiCategory[]>(result, '/api/admin/categories');
}

export async function createAdminCategory(data: CategoryInput): Promise<ApiCategory> {
  const result = await browserApi.POST('/api/admin/categories', { body: data });
  return unwrap<ApiCategory>(result, '/api/admin/categories');
}

export async function updateAdminCategory(id: string, data: Partial<CategoryInput>): Promise<ApiCategory> {
  const result = await browserApi.PUT('/api/admin/categories/{id}', { params: { path: { id } }, body: data });
  return unwrap<ApiCategory>(result, `/api/admin/categories/${id}`);
}

export async function deleteAdminCategory(id: string): Promise<void> {
  const result = await browserApi.DELETE('/api/admin/categories/{id}', { params: { path: { id } } });
  unwrap<void>(result, `/api/admin/categories/${id}`);
}

// Orders
export async function getAdminOrders(status?: OrderStatus): Promise<AdminOrder[]> {
  const result = await browserApi.GET('/api/admin/orders', { params: { query: { status } } });
  return unwrap<AdminOrder[]>(result, '/api/admin/orders');
}

export async function updateAdminOrderStatus(id: string, status: AdminSettableOrderStatus): Promise<AdminOrder> {
  const result = await browserApi.PUT('/api/admin/orders/{id}/status', {
    params: { path: { id } },
    body: { status },
  });
  return unwrap<AdminOrder>(result, `/api/admin/orders/${id}/status`);
}
