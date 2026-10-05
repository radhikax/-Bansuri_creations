import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';

import { checkoutSchema } from '../routes/orders.routes';
import { changePasswordSchema } from '../routes/admin/auth.routes';
import { createProductSchema, updateProductSchema, upsertVariantSchema } from '../routes/admin/products.routes';
import { categorySchema } from '../routes/admin/categories.routes';
import { statusUpdateSchema } from '../routes/admin/orders.routes';
import { settingsSchema } from '../routes/admin/settings.routes';

import {
  ErrorSchema,
  SuccessResponseSchema,
  HealthResponseSchema,
  WebhookResponseSchema,
  CategorySchema,
  ProductSchema,
  ProductWithVariantsSchema,
  ProductWithVariantsAndCategorySchema,
  ProductVariantSchema,
  OrderSchema,
  CheckoutResponseSchema,
  ShippingConfigSchema,
  StoreSettingsSchema,
  AdminLoginRequestSchema,
} from './schemas';

extendZodWithOpenApi(z);

/** Builds the OpenAPI 3.1 document from the server's zod schemas. Pure — no I/O. */
export function buildOpenApiDocument(): OpenAPIObject {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'adminSession', {
    type: 'apiKey',
    in: 'cookie',
    name: 'admin_session',
  });

  const adminSecurity = [{ adminSession: [] }];
  const jsonError = (description: string) => ({
    description,
    content: { 'application/json': { schema: ErrorSchema } },
  });
  const unauthorized = jsonError('Not authenticated');
  const badRequest = jsonError('Invalid payload');

  // --- Public: categories ---------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/categories',
    operationId: 'listCategories',
    tags: ['Categories'],
    responses: {
      200: {
        description: 'List of categories',
        content: { 'application/json': { schema: z.array(CategorySchema) } },
      },
    },
  });

  // --- Public: products --------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/products',
    operationId: 'listProducts',
    tags: ['Products'],
    request: {
      query: z.object({ category: z.string().optional() }),
    },
    responses: {
      200: {
        description: 'List of active products',
        content: { 'application/json': { schema: z.array(ProductWithVariantsAndCategorySchema) } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/products/{slug}',
    operationId: 'getProduct',
    tags: ['Products'],
    request: {
      params: z.object({ slug: z.string() }),
    },
    responses: {
      200: {
        description: 'Product detail',
        content: { 'application/json': { schema: ProductWithVariantsAndCategorySchema } },
      },
      404: jsonError('Product not found'),
    },
  });

  // --- Public: settings ----------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/settings/shipping',
    operationId: 'getShippingSettings',
    tags: ['Settings'],
    responses: {
      200: {
        description: 'Current shipping configuration',
        content: { 'application/json': { schema: ShippingConfigSchema } },
      },
    },
  });

  // --- Public: orders --------------------------------------------------------
  registry.registerPath({
    method: 'post',
    path: '/api/orders',
    operationId: 'createOrder',
    tags: ['Orders'],
    request: {
      body: { content: { 'application/json': { schema: checkoutSchema } } },
    },
    responses: {
      201: {
        description: 'Order created and a Razorpay order opened for payment',
        content: { 'application/json': { schema: CheckoutResponseSchema } },
      },
      400: jsonError('Invalid order payload'),
      409: jsonError('Stock validation failed'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/orders/{orderNumber}',
    operationId: 'getOrder',
    tags: ['Orders'],
    request: {
      params: z.object({ orderNumber: z.string() }),
    },
    responses: {
      200: {
        description: 'Order detail',
        content: { 'application/json': { schema: OrderSchema } },
      },
      404: jsonError('Order not found'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/orders/razorpay-webhook',
    operationId: 'razorpayWebhook',
    tags: ['Orders'],
    request: {
      headers: z.object({ 'x-razorpay-signature': z.string() }),
      body: {
        description: 'Raw Razorpay webhook payload (signature-verified JSON)',
        content: { 'application/json': { schema: z.unknown() } },
      },
    },
    responses: {
      200: {
        description: 'Webhook acknowledged',
        content: { 'application/json': { schema: WebhookResponseSchema } },
      },
      400: jsonError('Invalid signature'),
      500: jsonError('Webhook processing failed'),
    },
  });

  // --- Admin: auth -------------------------------------------------------
  registry.registerPath({
    method: 'post',
    path: '/api/admin/login',
    operationId: 'adminLogin',
    tags: ['Admin Auth'],
    request: {
      body: { content: { 'application/json': { schema: AdminLoginRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Logged in; sets the admin_session cookie',
        content: { 'application/json': { schema: SuccessResponseSchema } },
      },
      400: jsonError('Email and password required'),
      401: jsonError('Invalid credentials'),
      429: jsonError('Too many failed login attempts for this account; try again in 15 minutes'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/logout',
    operationId: 'adminLogout',
    tags: ['Admin Auth'],
    responses: {
      200: {
        description: 'Logged out; clears the admin_session cookie',
        content: { 'application/json': { schema: SuccessResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/password',
    operationId: 'adminChangePassword',
    tags: ['Admin Auth'],
    security: adminSecurity,
    request: {
      body: { content: { 'application/json': { schema: changePasswordSchema } } },
    },
    responses: {
      200: {
        description: 'Password changed; reissues the admin_session cookie',
        content: { 'application/json': { schema: SuccessResponseSchema } },
      },
      400: jsonError('Invalid payload, or new password too weak / unchanged'),
      401: jsonError('Current password is incorrect, or not authenticated'),
      429: jsonError('Too many failed password attempts; try again in 15 minutes'),
    },
  });

  // --- Admin: settings -----------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/admin/settings',
    operationId: 'adminGetSettings',
    tags: ['Admin Settings'],
    security: adminSecurity,
    responses: {
      200: {
        description: 'Store settings',
        content: { 'application/json': { schema: StoreSettingsSchema } },
      },
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/admin/settings',
    operationId: 'adminUpdateSettings',
    tags: ['Admin Settings'],
    security: adminSecurity,
    request: {
      body: { content: { 'application/json': { schema: settingsSchema } } },
    },
    responses: {
      200: {
        description: 'Store settings updated',
        content: { 'application/json': { schema: StoreSettingsSchema } },
      },
      400: badRequest,
      401: unauthorized,
    },
  });

  // --- Admin: products -----------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/admin/products',
    operationId: 'adminListProducts',
    tags: ['Admin Products'],
    security: adminSecurity,
    responses: {
      200: {
        description: 'All products (active and inactive), with variants and category',
        content: { 'application/json': { schema: z.array(ProductWithVariantsAndCategorySchema) } },
      },
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/products',
    operationId: 'adminCreateProduct',
    tags: ['Admin Products'],
    security: adminSecurity,
    request: {
      body: { content: { 'application/json': { schema: createProductSchema } } },
    },
    responses: {
      201: {
        description: 'Product created',
        content: { 'application/json': { schema: ProductWithVariantsSchema } },
      },
      400: badRequest,
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/admin/products/{id}',
    operationId: 'adminUpdateProduct',
    tags: ['Admin Products'],
    security: adminSecurity,
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { 'application/json': { schema: updateProductSchema } } },
    },
    responses: {
      200: {
        description: 'Product updated',
        content: { 'application/json': { schema: ProductSchema } },
      },
      400: badRequest,
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/admin/products/{id}/variants/{variantId}',
    operationId: 'adminUpdateVariant',
    tags: ['Admin Products'],
    security: adminSecurity,
    request: {
      params: z.object({ id: z.string(), variantId: z.string() }),
      body: { content: { 'application/json': { schema: upsertVariantSchema } } },
    },
    responses: {
      200: {
        description: 'Variant updated',
        content: { 'application/json': { schema: ProductVariantSchema } },
      },
      400: badRequest,
      401: unauthorized,
    },
  });

  // --- Admin: categories -----------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/admin/categories',
    operationId: 'adminListCategories',
    tags: ['Admin Categories'],
    security: adminSecurity,
    responses: {
      200: {
        description: 'All categories',
        content: { 'application/json': { schema: z.array(CategorySchema) } },
      },
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/admin/categories',
    operationId: 'adminCreateCategory',
    tags: ['Admin Categories'],
    security: adminSecurity,
    request: {
      body: { content: { 'application/json': { schema: categorySchema } } },
    },
    responses: {
      201: {
        description: 'Category created',
        content: { 'application/json': { schema: CategorySchema } },
      },
      400: badRequest,
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/admin/categories/{id}',
    operationId: 'adminUpdateCategory',
    tags: ['Admin Categories'],
    security: adminSecurity,
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { 'application/json': { schema: categorySchema.partial() } } },
    },
    responses: {
      200: {
        description: 'Category updated',
        content: { 'application/json': { schema: CategorySchema } },
      },
      400: badRequest,
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/admin/categories/{id}',
    operationId: 'adminDeleteCategory',
    tags: ['Admin Categories'],
    security: adminSecurity,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      204: { description: 'Category deleted' },
      401: unauthorized,
    },
  });

  // --- Admin: orders -----------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/admin/orders',
    operationId: 'adminListOrders',
    tags: ['Admin Orders'],
    security: adminSecurity,
    request: {
      query: z.object({ status: z.string().optional() }),
    },
    responses: {
      200: {
        description: 'Orders, optionally filtered by status',
        content: { 'application/json': { schema: z.array(OrderSchema) } },
      },
      401: unauthorized,
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/admin/orders/{id}/status',
    operationId: 'adminUpdateOrderStatus',
    tags: ['Admin Orders'],
    security: adminSecurity,
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { 'application/json': { schema: statusUpdateSchema } } },
    },
    responses: {
      200: {
        description: 'Order status updated',
        content: { 'application/json': { schema: OrderSchema } },
      },
      400: badRequest,
      401: unauthorized,
      404: jsonError('Order not found'),
      409: jsonError('Status change not allowed (a CANCELLED order is final; an unpaid PENDING order can only be cancelled)'),
    },
  });

  // --- Health ----------------------------------------------------------------
  registry.registerPath({
    method: 'get',
    path: '/api/health',
    operationId: 'getHealth',
    tags: ['Health'],
    responses: {
      200: {
        description: 'Service is healthy',
        content: { 'application/json': { schema: HealthResponseSchema } },
      },
    },
  });

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'Bansuri Creations API', version: '1.0.0' },
    servers: [{ url: '/' }],
  });
}
