import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { buildOpenApiDocument } from '../src/openapi/registry';

const EXPECTED: Array<[string, string]> = [
  ['get', '/api/health'], ['get', '/api/categories'], ['get', '/api/products'], ['get', '/api/products/{slug}'],
  ['get', '/api/settings/shipping'], ['post', '/api/orders'], ['get', '/api/orders/{orderNumber}'],
  ['post', '/api/orders/razorpay-webhook'], ['post', '/api/admin/login'], ['post', '/api/admin/logout'],
  ['post', '/api/admin/password'], ['get', '/api/admin/settings'], ['put', '/api/admin/settings'],
  ['get', '/api/admin/products'], ['post', '/api/admin/products'], ['put', '/api/admin/products/{id}'],
  ['put', '/api/admin/products/{id}/variants/{variantId}'], ['get', '/api/admin/categories'],
  ['post', '/api/admin/categories'], ['put', '/api/admin/categories/{id}'], ['delete', '/api/admin/categories/{id}'],
  ['get', '/api/admin/orders'], ['put', '/api/admin/orders/{id}/status'],
];

describe('OpenAPI document', () => {
  it('is OpenAPI 3.1 and documents every route', () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    for (const [method, path] of EXPECTED) {
      expect(doc.paths?.[path], `${method.toUpperCase()} ${path}`).toHaveProperty(method);
    }
  });

  it('marks admin routes as requiring the admin_session cookie', () => {
    const doc = buildOpenApiDocument();
    expect(doc.paths?.['/api/admin/products']?.get?.security).toEqual([{ adminSession: [] }]);
    expect(doc.components?.securitySchemes?.adminSession).toMatchObject({ type: 'apiKey', in: 'cookie', name: 'admin_session' });
  });

  it('is served at GET /api/openapi.json', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
  });

  it('committed server/openapi.json matches the generated document', async () => {
    const committed = (await import('../openapi.json', { with: { type: 'json' } })).default;
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildOpenApiDocument())));
  });
});
