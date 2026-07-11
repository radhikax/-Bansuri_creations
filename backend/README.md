# Bansuri Creations Backend

Basic Express API for the Bansuri Creations e-commerce frontend. Data is stored in memory (products/categories mirror the frontend mock data), so no database is required to run it.

## Running

```bash
cd backend
npm install
npm run dev   # starts on http://localhost:3001 (or PORT env var)
```

## API Endpoints

### Health
- `GET /api/health` — service status

### Products
- `GET /api/products` — list products; filters: `?category=Diwali Decor`, `?search=diya`, `?inStock=true`
- `GET /api/products/:id` — get a single product

### Categories
- `GET /api/categories` — list categories
- `GET /api/categories/:title/products` — products in a category

### Cart
Carts are keyed by a client-chosen `cartId` (e.g. a UUID stored in localStorage).
- `GET /api/cart/:cartId` — get cart with totals
- `POST /api/cart/:cartId/items` — add item: `{ "productId": 1, "quantity": 2 }`
- `PATCH /api/cart/:cartId/items/:productId` — update quantity: `{ "quantity": 3 }`
- `DELETE /api/cart/:cartId/items/:productId` — remove item
- `DELETE /api/cart/:cartId` — clear cart

### Orders
- `POST /api/orders` — place an order:
  ```json
  {
    "items": [{ "productId": 1, "quantity": 2 }],
    "customer": { "name": "Radhika", "email": "r@example.com", "address": "Jaipur", "phone": "9999999999" }
  }
  ```
- `GET /api/orders/:id` — get an order

## Notes

- Cart and order data live in memory and reset on restart — swap in a database (e.g. SQLite/Postgres) for persistence.
- CORS is enabled so the Vite dev server (`npm run dev` in the repo root) can call the API directly.
