import { Product, Category } from '../types';
import type { CartItem } from '../components/Cart';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface CartResponse {
  cartId: string;
  items: CartItem[];
  totalItems: number;
  total: number;
}

export interface OrderPayload {
  items: Array<{ productId: number; quantity: number }>;
  customer: { name: string; email: string; address: string; phone?: string };
}

export interface Order {
  id: string;
  items: Array<{ productId: number; name: string; price: number; quantity: number }>;
  customer: OrderPayload['customer'];
  total: number;
  status: string;
  createdAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function getCartId(): string {
  let cartId = localStorage.getItem('cartId');
  if (!cartId) {
    cartId = crypto.randomUUID();
    localStorage.setItem('cartId', cartId);
  }
  return cartId;
}

export const api = {
  getProducts: () => request<Product[]>('/products'),
  getCategories: () => request<Category[]>('/categories'),
  getCart: (cartId: string) => request<CartResponse>(`/cart/${cartId}`),
  addCartItem: (cartId: string, productId: number, quantity = 1) =>
    request<CartResponse>(`/cart/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),
  updateCartItem: (cartId: string, productId: number, quantity: number) =>
    request<CartResponse>(`/cart/${cartId}/items/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  removeCartItem: (cartId: string, productId: number) =>
    request<CartResponse>(`/cart/${cartId}/items/${productId}`, {
      method: 'DELETE',
    }),
  clearCart: (cartId: string) =>
    request<CartResponse>(`/cart/${cartId}`, { method: 'DELETE' }),
  createOrder: (payload: OrderPayload) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
};
