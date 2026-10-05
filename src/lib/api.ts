import type { operations } from './api/schema';

// Every API type is derived from the generated OpenAPI contract
// (src/lib/api/schema.d.ts), never hand-written: a backend field change
// regenerates the schema and then fails typecheck wherever the frontend
// still reads the old shape. Requests go through serverApi/browserApi in
// ./api/client.

type JsonContent<T> = T extends { content: { 'application/json': infer J } } ? J : never;

/** The JSON body of an operation's response for `status` (200 by default). */
export type ResponseOf<
  Op extends keyof operations,
  Status extends keyof operations[Op]['responses'] = 200 & keyof operations[Op]['responses'],
> = JsonContent<operations[Op]['responses'][Status]>;

/** The JSON request body an operation accepts. */
export type RequestBodyOf<Op extends keyof operations> = JsonContent<NonNullable<operations[Op]['requestBody']>>;

export type ApiCategory = ResponseOf<'listCategories'>[number];
export type ApiProduct = ResponseOf<'getProduct'>;
export type ApiProductVariant = ApiProduct['variants'][number];
export type ShippingSettings = ResponseOf<'getShippingSettings'>;
