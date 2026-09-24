import type { ApiCategory, ApiProduct, ApiProductVariant } from '../app/lib/api';
import type { Product } from '../app/types';

// The API clients default to the page's own origin (see src/app/lib/api.ts).
export const API_URL = window.location.origin;

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

export function makeStoreSettings(overrides: Partial<{ id: number; flatShippingFee: number; freeShippingThreshold: number }> = {}) {
  return { id: 1, flatShippingFee: 50, freeShippingThreshold: 999, ...overrides };
}

export interface AdminOrderItemFixture {
  id: string;
  orderId: string;
  productVariantId: string;
  productNameSnapshot: string;
  variantLabelSnapshot: string;
  unitPrice: number;
  quantity: number;
}

export interface AdminOrderFixture {
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
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  items: AdminOrderItemFixture[];
  createdAt: string;
  updatedAt: string;
}

export function makeAdminOrder(overrides: Partial<AdminOrderFixture> = {}): AdminOrderFixture {
  return {
    id: 'order-1',
    orderNumber: 'ORD-0001',
    customerName: 'Asha Rao',
    customerPhone: '9876543210',
    customerEmail: 'asha@example.com',
    addressStreet: '12 MG Road',
    addressCity: 'Pune',
    addressState: 'MH',
    addressPincode: '411001',
    subtotal: 500,
    shippingFee: 50,
    total: 550,
    status: 'PAID',
    razorpayOrderId: 'order_razorpay_1',
    razorpayPaymentId: 'pay_1',
    paidAt: '2026-01-02T00:00:00.000Z',
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productVariantId: 'var-1',
        productNameSnapshot: 'Brass Diya',
        variantLabelSnapshot: 'Default',
        unitPrice: 500,
        quantity: 1,
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}
