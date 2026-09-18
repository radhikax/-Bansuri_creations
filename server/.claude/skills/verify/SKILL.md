---
name: verify
description: Build/launch/drive recipe for verifying the Decor e-commerce backend API (server/) at runtime.
---

# Verifying the backend API

## Prerequisites (once per machine)

- Docker Desktop running.
- `server/.env` and `server/.env.test` exist (gitignored — copy from `.env.example` and fill in values; DB port is **5433**, not the Postgres default 5432 — see `docker-compose.yml`).

## Bring the app up

```bash
cd server
docker compose up -d                      # Postgres container, port 5433
export DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_dev"
npx prisma migrate deploy                 # idempotent, safe to rerun
npx tsx prisma/seed.ts                    # idempotent (upserts), safe to rerun
npm run dev                                # starts on :4000, run in background
```

Health check: `curl http://localhost:4000/api/health` → `{"status":"ok"}`.

## Driving it (curl, real HTTP surface — not import-and-call)

- Public: `GET /api/categories`, `GET /api/products`, `GET /api/products?category=<slug>`, `GET /api/products/:slug`, `GET /api/orders/:orderNumber`.
- Checkout: `POST /api/orders` with a real `variantId` (fetch one from `GET /api/products` first). **Note:** with placeholder Razorpay keys in `.env` (`rzp_test_placeholder`), the Razorpay API call inside this route legitimately fails with a live 401 from Razorpay — this is expected without real test credentials, not a bug. The order still commits as `PENDING` with the correct total before that external call runs; verify via `docker exec server-postgres-1 psql -U ecommerce -d ecommerce_dev -c "SELECT ... FROM \"Order\" ..."`.
- Webhook: `POST /api/orders/razorpay-webhook` needs `x-razorpay-signature` computed as `HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)` — can't be exercised end-to-end without a real captured payment; the signature-rejection path (missing/wrong signature → 400) is directly testable and worth hitting.
- Admin: `POST /api/admin/login` (seed defaults to `admin@example.com` / `changeme123` unless `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` were set) with `-c cookies.txt`, then hit `/api/admin/*` routes with `-b cookies.txt`.

## Cleanup

```powershell
Get-NetTCPConnection -LocalPort 4000 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```
(`pkill` isn't available in this Git Bash environment — use PowerShell to kill the port-4000 process instead.)
