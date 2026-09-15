# E-Commerce Backend Design

Date: 2026-09-15
Status: Approved for planning

## Context

This project is a React + Vite storefront for a small Indian home-decor and
gifting business (wedding favors, festive decor, Kanha Ji dresses, customized
gifting). It was designed in Figma and the frontend UI already exists
(`Header`, `Footer`, `Hero`, `Cart`, `ProductCard`, `CategoryCard`,
`HomePage`, `CategoryPage`), but there is no backend: products are hardcoded
in `App.tsx`, the cart lives only in React state, and there is no checkout,
payment, order storage, or admin capability.

The goal is a working store: real product data, a checkout flow with real
payment collection, order persistence, and a way for the store owner
(non-technical) to manage products and fulfill orders — while keeping
hosting costs near zero for a low/moderate-traffic small business.

## Decisions

- **Payments**: Razorpay (UPI/cards/netbanking/wallets, standard for Indian
  small businesses).
- **Product management**: a simple custom admin panel, password-protected,
  for the store owner to manage products/stock and view/update orders.
- **Customer accounts**: guest checkout only. No login/signup, no saved
  order history beyond looking up an order by its order number.
- **Hosting/budget**: free-tier-first (Render/Railway for the API, Neon or
  Supabase free-tier for Postgres).
- **Order fulfillment**: manual — the owner updates order status in the
  admin panel; no courier/shipping API integration. New orders trigger an
  email notification to the store.
- **Product variants**: supported. A product (e.g. "Kanha Ji Dress") can
  have multiple variants (e.g. Small/Medium/Large), each with its own price
  and stock, instead of modeling each size as a separate product.
- **Shipping cost**: flat fee with a free-shipping threshold, both
  configurable by the owner in admin settings.
- **Architecture**: a REST API (not microservices — unnecessary operational
  complexity for a single small store with low traffic), kept as a separate
  backend service. The existing frontend is not restructured or migrated;
  it gains new pages and calls the new API over REST.

## Architecture

```
┌─────────────────────┐        REST/JSON        ┌──────────────────────┐
│  React/Vite frontend │ ───────────────────────▶│  Express + TS API    │
│  (existing app +     │◀─────────────────────── │  (server/)           │
│  Checkout/Admin      │                          │                      │
│  pages)              │                          │  - Prisma ORM        │
└──────────┬───────────┘                          │  - Razorpay SDK      │
           │                                       │  - Resend/Brevo SDK │
           │ Razorpay Checkout widget              └───────────┬──────────┘
           ▼                                                   │
   ┌───────────────┐        webhook (signed)                   ▼
   │   Razorpay     │ ─────────────────────────────▶  POST /api/orders/
   │   (hosted)     │                                  razorpay-webhook
   └───────────────┘                                           │
                                                                ▼
                                                      ┌───────────────────┐
                                                      │ PostgreSQL         │
                                                      │ (Neon/Supabase free│
                                                      │  tier)             │
                                                      └───────────────────┘
```

- **Frontend**: existing Vite + React + react-router app, structurally
  unchanged. New pages: `CheckoutPage`, `OrderConfirmationPage`, and an
  `/admin` section (`AdminLogin`, `AdminDashboard`, `AdminProducts`,
  `AdminOrders`, `AdminSettings`).
- **Backend**: new Node.js + TypeScript + Express REST API in a `server/`
  directory, deployed independently from the frontend.
- **Database**: PostgreSQL accessed via Prisma ORM.
- **Payments**: Razorpay, with the API creating orders server-side and a
  signed webhook as the sole source of truth for payment confirmation.
- **Email**: Resend or Brevo (free tier) for order-confirmation and
  new-order-alert transactional emails.
- **Auth**: no customer accounts. Admin auth is a single-admin
  email+password login issuing a JWT session cookie — no multi-role user
  system, since there is one store owner.

## Data Model

```
Category
  id, name, slug, description, imageUrl, icon

Product
  id, name, slug, description, categoryId (→ Category)
  basePrice, originalPrice, imageUrl, rating, isActive

ProductVariant
  id, productId (→ Product), label            -- "Small" / "Default" / etc.
  price (overrides basePrice if set), stock, sku

Order
  id, orderNumber                              -- human-friendly, e.g. ORD-1024
  customerName, customerPhone, customerEmail
  shippingAddress (street, city, state, pincode)
  subtotal, shippingFee, total
  status                                        -- PENDING | PAID | PROCESSING
                                                 -- | SHIPPED | DELIVERED | CANCELLED
  razorpayOrderId, razorpayPaymentId, paidAt, createdAt

OrderItem
  id, orderId (→ Order), productVariantId (→ ProductVariant)
  productNameSnapshot, variantLabelSnapshot, unitPrice, quantity

AdminUser
  id, email, passwordHash

StoreSettings (single row)
  flatShippingFee, freeShippingThreshold
```

Every product always has at least one `ProductVariant` (a "Default" variant
for items without real size/color options), so cart and order logic only
ever deals with variants, never bare products — one code path instead of
two. `OrderItem` snapshots product name/variant label/price at purchase
time so historical orders remain accurate even if a product is later
renamed, repriced, or deleted.

## API Endpoints

**Public (storefront):**
- `GET /api/categories`
- `GET /api/products` (filterable by category/slug, includes variants)
- `GET /api/products/:slug`
- `POST /api/orders` — creates an order from cart contents + shipping
  details; server re-validates stock/prices from the database, computes
  the total, creates a matching Razorpay order, returns
  `{ orderId, razorpayOrderId, razorpayKeyId }`
- `POST /api/orders/razorpay-webhook` — Razorpay's server-to-server
  payment confirmation
- `GET /api/orders/:orderNumber` — status lookup for the confirmation page

**Admin (require admin JWT cookie):**
- `POST /api/admin/login`
- `GET/POST/PUT/DELETE /api/admin/products`
- `GET/POST/PUT/DELETE /api/admin/categories`
- `GET/POST/PUT/DELETE /api/admin/variants`
- `GET /api/admin/orders`, `PUT /api/admin/orders/:id/status`
- `GET/PUT /api/admin/settings`

## Payment Flow

1. Customer fills the checkout form; frontend calls `POST /api/orders`.
2. Server recalculates prices and checks stock from the database inside a
   transaction (never trusts client-supplied prices), creates an `Order`
   row with status `PENDING`, and creates a matching Razorpay order.
3. Frontend opens the Razorpay Checkout widget using the returned
   `razorpayOrderId`.
4. Razorpay calls our webhook server-to-server after payment completes.
   The webhook signature is verified against the Razorpay webhook secret;
   only on a valid signature do we mark the order `PAID`, decrement each
   `ProductVariant.stock`, and send the confirmation/alert emails. The
   client-side "success" callback from the widget is never treated as
   authoritative — only the verified webhook is.
5. The `OrderConfirmationPage` looks up `GET /api/orders/:orderNumber` to
   display final status once the webhook has landed (normally near-instant).

## Admin Panel

Routes under `/admin` in the same frontend app, behind the admin login:
- **Dashboard**: recent orders, low-stock variants.
- **Products**: add/edit/delete products and variants (price, stock, image
  URL), toggle active/inactive.
- **Orders**: list with status filters, detail view, status updates
  (Processing/Shipped/Delivered/Cancelled); cancelling an order restocks
  its variants.
- **Settings**: flat shipping fee and free-shipping threshold.

## Notifications

On webhook-confirmed payment, the API sends two transactional emails via
Resend/Brevo: an order confirmation to the customer and a new-order alert
to the store's email address. No marketing email system is needed.

## Error Handling

- Stock/price races are handled by re-checking stock inside a DB
  transaction at order-creation time; insufficient stock returns a clear
  error before payment starts.
- Webhook requests with an invalid signature are rejected (400) and
  logged, never silently accepted.
- Orders left `PENDING` (abandoned/failed payment) are auto-cancelled by an
  hourly cron job after 24 hours, so stock isn't held indefinitely against
  no-shows.
- The frontend surfaces clear, specific errors during checkout (out of
  stock, payment failed, network error) instead of failing silently.

## Testing Plan

- Backend: unit tests for pricing/stock/order-total logic; integration
  tests for order-creation and webhook endpoints against a test database.
- Manual end-to-end testing using Razorpay's test mode (test
  card/UPI credentials) before going live.
- Admin panel CRUD flows tested manually; no heavy automated UI test suite
  needed at this scale.

## Out of Scope (for this spec)

- Customer accounts/login/order history beyond order-number lookup.
- Courier/shipping-rate API integrations.
- SMS/WhatsApp notifications (email only for v1).
- SEO-oriented server-side rendering (frontend stays a client-rendered SPA).
- Discount/coupon codes.
- Multi-admin roles/permissions.
