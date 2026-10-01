import { z } from 'zod';

// Response (and a couple of request) shapes for the OpenAPI document. These mirror what
// server/src/routes actually sends today (Prisma model fields as JSON, dates as strings) —
// they are documentation schemas, not runtime validators.

export const ErrorSchema = z.object({ error: z.string(), details: z.unknown().optional() });

export const SuccessResponseSchema = z.object({ success: z.boolean() });

export const HealthResponseSchema = z.object({ status: z.literal('ok') });

export const WebhookResponseSchema = z.object({ received: z.boolean() });

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  imageUrl: z.string(),
  icon: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProductVariantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  label: z.string(),
  price: z.number().nullable(),
  stock: z.number(),
  sku: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// The flat Product model, as returned by PUT /api/admin/products/{id} (no relations included).
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  categoryId: z.string(),
  basePrice: z.number(),
  originalPrice: z.number().nullable(),
  imageUrl: z.string(),
  images: z.array(z.string()),
  rating: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// POST /api/admin/products includes variants but not category.
export const ProductWithVariantsSchema = ProductSchema.extend({
  variants: z.array(ProductVariantSchema),
});

// GET /api/products, GET /api/products/{slug} and GET /api/admin/products include both.
export const ProductWithVariantsAndCategorySchema = ProductWithVariantsSchema.extend({
  category: CategorySchema,
});

export const OrderStatusSchema = z.enum(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

export const OrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productVariantId: z.string(),
  productNameSnapshot: z.string(),
  variantLabelSnapshot: z.string(),
  unitPrice: z.number(),
  quantity: z.number(),
});

export const OrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  customerEmail: z.string(),
  addressStreet: z.string(),
  addressCity: z.string(),
  addressState: z.string(),
  addressPincode: z.string(),
  subtotal: z.number(),
  shippingFee: z.number(),
  total: z.number(),
  status: OrderStatusSchema,
  razorpayOrderId: z.string().nullable(),
  razorpayPaymentId: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(OrderItemSchema),
});

// POST /api/orders doesn't return the Order row itself, just enough to drive checkout.
export const CheckoutResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  razorpayOrderId: z.string(),
  razorpayKeyId: z.string().optional(),
  amount: z.number(),
});

// Public GET /api/settings/shipping: the computed config, not the StoreSettings row.
export const ShippingConfigSchema = z.object({
  flatShippingFee: z.number(),
  freeShippingThreshold: z.number(),
});

// Admin GET/PUT /api/admin/settings: the StoreSettings row itself.
export const StoreSettingsSchema = z.object({
  id: z.number(),
  flatShippingFee: z.number(),
  freeShippingThreshold: z.number(),
});

// POST /api/admin/login has no zod schema on the route (it does a manual field check),
// so this request shape exists only here for documentation purposes.
export const AdminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
