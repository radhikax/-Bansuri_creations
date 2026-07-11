---
name: testing-backend-api
description: Run and test the Bansuri Creations Express backend API and Vite frontend locally. Use when verifying backend endpoints or full-stack changes.
---

# Testing Bansuri Creations

## Running locally
- Frontend: `npm install && npm run dev` (Vite, repo root). No lint/test scripts exist; `npm run build` is the main check.
- Backend: `cd backend && npm install && npm run dev` (Express on http://localhost:3001, override with `PORT`). No database — products/categories are in-memory in `backend/src/data/products.js`; carts/orders reset on restart.

## Testing the backend
- Endpoints: `/api/health`, `/api/products` (filters: `category`, `search`, `inStock`), `/api/products/:id`, `/api/categories`, `/api/categories/:title/products`, `/api/cart/:cartId` (+ items subroutes), `/api/orders`. See `backend/README.md` for payloads.
- Test via curl from the shell; verify server-computed totals (e.g. cart `total`/`totalItems`) rather than just status codes — bad math is the likely failure mode.
- Useful known values: 16 products, 5 categories, product 14 is out of stock (good for error-path tests).
- The frontend currently uses its own mock data in `src/app/App.tsx` and may not be wired to the API; if testing frontend/backend integration, first check whether the frontend actually fetches from `localhost:3001`.

## Devin Secrets Needed
- None — everything runs locally without credentials.
