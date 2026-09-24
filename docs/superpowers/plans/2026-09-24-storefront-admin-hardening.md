# Storefront & Admin Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin change their password (and sign out other sessions), serve `/api` from the frontend's own origin, fix the storefront final-review minors, and add Playwright browser smoke tests.

**Architecture:**
- **Backend:** add a nullable `AdminUser.passwordChangedAt` column. The auth middleware compares it with each session's JWT `iat`, and a new `POST /api/admin/password` route changes the password.
- **Frontend:** API calls go to the page's own origin. Vite proxies `/api` in dev, and the host rewrites it in production. The admin Settings page gets an Account form.
- **Browser tests:** Playwright starts its own API server against a separate, reset-per-run `ecommerce_e2e` database.

**Tech Stack:**
- **Backend:** Express 4, Prisma 5 (Postgres), zod, bcrypt, jsonwebtoken, Vitest + supertest.
- **Frontend:** React 18 + Vite 6, TanStack Query, sonner, Vitest + Testing Library + MSW 2.
- **Browser tests:** `@playwright/test` 1.63.0.

**Spec:** `docs/superpowers/specs/2026-09-24-storefront-admin-hardening-design.md`

## Global Constraints

- **Worktree:** all work happens in `C:\Users\rj816\Downloads\Ecommerce Website for Decor (3)\.claude\worktrees\storefront-data-wiring`, branch `worktree-storefront-data-wiring`. Never touch the main checkout.
- **Postgres:** runs in Docker on **port 5433** (`cd server && docker compose up -d`). Dev DB `ecommerce_dev`; test DB `ecommerce_test` (via `server/.env.test`); e2e DB `ecommerce_e2e`.
- **Commits:** every commit message ends with a blank line followed by `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Password rules:**
  - The new password must be at least **8** characters and different from the current one.
  - Hash with bcrypt, cost **10**.
  - Error strings, exactly:
    - `Invalid payload`
    - `New password must be at least 8 characters`
    - `New password must be different from the current password`
    - `Current password is incorrect`
- **Session cookie:** stays `admin_session`, `httpOnly`, `secure` only when `NODE_ENV === 'production'`, **`sameSite: 'lax'`**, 7-day JWT/maxAge.
- **Request timeout:** storefront API requests time out after **10 000 ms**.
- **Storefront load error:** the message is exactly `Couldn't load products or categories. Please try again.`
- **Unknown category:** the page says exactly `Category not found`, with a `Back to shopping` link to `/`.
- **Out of scope:** checkout wiring, Razorpay keys, and the `useMemo` item (final-review M6).
- **Test suites before this plan:** frontend `npm test` 142 passing, backend `cd server && npm test` 129 passing. No task may leave either suite red.

### Deviations from spec wording (controller rulings, behaviour-equivalent)

- **Spec §2 — API base URL.** The spec says the default `API_BASE_URL` becomes `''` (relative). The plan uses `window.location.origin` instead.
  - In a browser, `${window.location.origin}/api/...` is the same request as `/api/...`.
  - Node's `fetch` (used under Vitest/jsdom) rejects relative URLs, so `''` would break every frontend unit test.
- **Spec §3 M4 — timeout mechanism.** The spec names `AbortSignal.timeout(10_000)`. The plan uses an `AbortController` plus `setTimeout`.
  - Behaviour is identical, and Vitest fake timers can drive `setTimeout`.
  - `AbortSignal.timeout` uses Node-internal timers that fake timers can't advance, so it couldn't be unit-tested without a real 10 s wait.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `server/prisma/schema.prisma` + new migration | 1 | `AdminUser.passwordChangedAt DateTime?` |
| `server/src/services/adminSession.ts` (new) | 1 | `setAdminSessionCookie(res, adminId)`: signs the JWT and sets the cookie |
| `server/src/middleware/adminAuth.ts` | 1 | Async: verifies the JWT, loads the admin, rejects tokens issued before `passwordChangedAt` |
| `server/src/routes/admin/auth.routes.ts` | 1 | Login uses the helper; new `POST /password` |
| `server/tests/middleware/adminAuth.test.ts` | 1 | Middleware unit tests (now DB-backed) |
| `server/tests/admin/password.test.ts` (new) | 1 | Route integration tests |
| `src/app/admin/lib/adminApi.ts` | 2, 3 | `changePassword()` (Task 2); origin default (Task 3) |
| `src/app/admin/pages/ChangePasswordForm.tsx` (new) | 2 | Account card form |
| `src/app/admin/pages/SettingsPage.tsx` | 2 | Renders `<ChangePasswordForm />` |
| `src/app/admin/pages/SettingsPage.test.tsx` | 2 | Form tests |
| `src/test/server.ts` | 2 | Default MSW handler for `/api/admin/password` |
| `src/app/lib/api.ts` | 3, 4 | Origin default (Task 3); timeout (Task 4) |
| `src/test/fixtures.ts` | 3, 4 | `API_URL` = origin (Task 3); `makeProduct` gets `categorySlug` (Task 4) |
| `vite.config.ts` | 3 | Dev proxy `/api` → `:4000` |
| `.env.example`, `server/README.md`, `README.md` | 3, 5 | Proxy docs (3); e2e docs (5) |
| `src/app/types.ts`, `src/app/lib/adapters.ts` (+test) | 4 | `categorySlug`; any-variant `inStock` |
| `src/app/pages/CategoryPage.tsx` (+test) | 4 | Slug filter; "Category not found" |
| `src/app/App.tsx`, `src/app/App.test.tsx` | 4 | Error message wording |
| `src/app/lib/useApiData.ts` | 4 | JSDoc on the once-on-mount contract |
| `src/app/lib/api.test.ts` | 4 | Timeout test |
| `.gitignore` | 4, 5 | `.env` files (4); Playwright output (5) |
| `playwright.config.ts`, `e2e/*` (new) | 5 | Browser smoke tests |
| `src/app/components/Cart.tsx` | 5 | `aria-label`s on the quantity buttons (needed by e2e) |

---

### Task 1: Backend: password change and session invalidation

**Files:**
- Modify: `server/prisma/schema.prisma` (model `AdminUser`), plus a new migration generated by Prisma
- Create: `server/src/services/adminSession.ts`
- Modify: `server/src/middleware/adminAuth.ts` (full rewrite below)
- Modify: `server/src/routes/admin/auth.routes.ts` (full rewrite below)
- Modify: `server/tests/middleware/adminAuth.test.ts` (full rewrite below)
- Create: `server/tests/admin/password.test.ts`

**Interfaces:**
- **Consumes:** `prisma` from `server/src/db`, `asyncHandler` from `server/src/middleware/asyncHandler`, and the test helpers `resetDb()` / `loginAsAdmin(agent)` from `server/tests/helpers.ts`. `loginAsAdmin` creates `admin@example.com` with password `pw` and logs in.
- **Produces:**
  - HTTP `POST /api/admin/password`, body `{ currentPassword: string, newPassword: string }` → 200 `{ success: true }` plus a fresh `admin_session` cookie, or 400/401 `{ error }` with the strings from Global Constraints.
  - Any admin route returns 401 `{ error: 'Not authenticated' }` for a session issued before the password change.
  - `requireAdminAuth` is now `async`, returning `Promise<void>`. Its export name and the `AdminRequest` type are unchanged.

- [ ] **Step 1: Add the column and generate the migration**

In `server/prisma/schema.prisma`, replace the `AdminUser` model with:

```prisma
model AdminUser {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String
  passwordChangedAt DateTime?
  createdAt         DateTime  @default(now())
}
```

Run (from `server/`, Postgres up):

```bash
npx prisma migrate dev --name add_admin_password_changed_at
DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_test" npx prisma migrate deploy
```

Expected:
- A new folder `server/prisma/migrations/<timestamp>_add_admin_password_changed_at/` containing `ALTER TABLE "AdminUser" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);`.
- The test DB reports 1 migration applied.

- [ ] **Step 2: Write the failing middleware tests**

Replace `server/tests/middleware/adminAuth.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { requireAdminAuth, type AdminRequest } from '../../src/middleware/adminAuth';
import { prisma } from '../../src/db';
import { resetDb } from '../helpers';

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function reqWithToken(token: string) {
  return { cookies: { admin_session: token } } as unknown as AdminRequest;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('requireAdminAuth', () => {
  beforeEach(async () => {
    vi.stubEnv('JWT_SECRET', 'unit-test-secret');
    await resetDb();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('responds 401 when there is no session cookie', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth({ cookies: {} } as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when cookies are not parsed at all', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth({} as AdminRequest, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for a token that is not a valid JWT', async () => {
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken('garbage'), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for a token signed with a different secret', async () => {
    const token = jwt.sign({ adminId: 'a1' }, 'some-other-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 for an expired token', async () => {
    const token = jwt.sign({ adminId: 'a1' }, 'unit-test-secret', { expiresIn: -10 });
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the admin in the token no longer exists', async () => {
    const token = jwt.sign({ adminId: 'deleted-admin' }, 'unit-test-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches adminId and calls next for a valid token of an existing admin', async () => {
    const admin = await prisma.adminUser.create({ data: { email: 'a@example.com', passwordHash: 'x' } });
    const token = jwt.sign({ adminId: admin.id }, 'unit-test-secret');
    const req = reqWithToken(token);
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(req, res as unknown as Response, next);
    expect(req.adminId).toBe(admin.id);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a token issued in an earlier second than passwordChangedAt', async () => {
    const changedAt = nowSeconds();
    const admin = await prisma.adminUser.create({
      data: { email: 'a@example.com', passwordHash: 'x', passwordChangedAt: new Date(changedAt * 1000) },
    });
    const token = jwt.sign({ adminId: admin.id, iat: changedAt - 60 }, 'unit-test-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a token issued in the same second as passwordChangedAt', async () => {
    const changedAt = nowSeconds();
    const admin = await prisma.adminUser.create({
      data: { email: 'a@example.com', passwordHash: 'x', passwordChangedAt: new Date(changedAt * 1000) },
    });
    const token = jwt.sign({ adminId: admin.id, iat: changedAt }, 'unit-test-secret');
    const res = mockRes();
    const next = vi.fn();
    await requireAdminAuth(reqWithToken(token), res as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the middleware tests to verify the new ones fail**

Run: `cd server && npx vitest run tests/middleware/adminAuth.test.ts`

Expected: FAIL on "responds 401 when the admin in the token no longer exists" and "rejects a token issued in an earlier second than passwordChangedAt". The current middleware calls `next()` for any valid JWT.

- [ ] **Step 4: Create the session-cookie helper**

Create `server/src/services/adminSession.ts`:

```ts
import type { Response } from 'express';
import jwt from 'jsonwebtoken';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Signs a fresh admin JWT and sets it as the httpOnly `admin_session` cookie. */
export function setAdminSessionCookie(res: Response, adminId: string): void {
  const token = jwt.sign({ adminId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  });
}
```

- [ ] **Step 5: Rewrite the middleware**

Replace `server/src/middleware/adminAuth.ts` with:

```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

export interface AdminRequest extends Request {
  adminId?: string;
}

interface AdminSessionPayload {
  adminId: string;
  iat?: number;
}

export async function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.admin_session;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  let payload: AdminSessionPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as AdminSessionPayload;
  } catch {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminId },
      select: { passwordChangedAt: true },
    });
    if (!admin) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }
    // iat has one-second resolution and passwordChangedAt is stored truncated to
    // the second, so the session issued alongside a password change (same second)
    // stays valid while every earlier session is rejected.
    if (admin.passwordChangedAt && (payload.iat ?? 0) < Math.floor(admin.passwordChangedAt.getTime() / 1000)) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    req.adminId = payload.adminId;
    next();
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 6: Run the middleware tests to verify they pass**

Run: `cd server && npx vitest run tests/middleware/adminAuth.test.ts`
Expected: 9 passed.

- [ ] **Step 7: Write the failing route tests**

Create `server/tests/admin/password.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { resetDb, loginAsAdmin } from '../helpers';

const NEW_PASSWORD = 'brand-new-pass';

describe('POST /api/admin/password', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects requests without a session', async () => {
    const res = await request(app).post('/api/admin/password').send({ currentPassword: 'pw', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid payload', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'pw' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid payload' });
  });

  it('rejects a new password shorter than 8 characters', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'pw', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'New password must be at least 8 characters' });
  });

  it('rejects a new password equal to the current one', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    await prisma.adminUser.update({
      where: { email: 'admin@example.com' },
      data: { passwordHash: await bcrypt.hash('same-password', 10) },
    });
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'same-password', newPassword: 'same-password' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'New password must be different from the current password' });
  });

  it('rejects a wrong current password', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const res = await agent.post('/api/admin/password').send({ currentPassword: 'wrong', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Current password is incorrect' });
  });

  it('changes the password, keeps this session, and signs out older sessions', async () => {
    const agent = request.agent(app);
    await loginAsAdmin(agent);
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email: 'admin@example.com' } });
    // A session from a minute ago, i.e. issued before the change.
    const oldToken = jwt.sign(
      { adminId: admin.id, iat: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!,
    );

    const res = await agent.post('/api/admin/password').send({ currentPassword: 'pw', newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(res.headers['set-cookie']?.[0]).toMatch(/admin_session=/);

    // This browser (agent now holds the fresh cookie) stays logged in.
    expect((await agent.get('/api/admin/settings')).status).toBe(200);

    // The older session is rejected.
    const oldRes = await request(app).get('/api/admin/settings').set('Cookie', `admin_session=${oldToken}`);
    expect(oldRes.status).toBe(401);
    expect(oldRes.body).toEqual({ error: 'Not authenticated' });

    // Old password no longer logs in; the new one does.
    const oldLogin = await request(app).post('/api/admin/login').send({ email: 'admin@example.com', password: 'pw' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/admin/login').send({ email: 'admin@example.com', password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
  });
});
```

- [ ] **Step 8: Run the route tests to verify they fail**

Run: `cd server && npx vitest run tests/admin/password.test.ts`
Expected: FAIL. Every authenticated case gets 404, because the route doesn't exist yet.

- [ ] **Step 9: Add the route and switch login to the helper**

Replace `server/src/routes/admin/auth.routes.ts` with:

```ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../db';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAdminAuth, type AdminRequest } from '../../middleware/adminAuth';
import { setAdminSessionCookie } from '../../services/adminSession';

export const adminAuthRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

adminAuthRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  setAdminSessionCookie(res, admin.id);
  res.json({ success: true });
}));

adminAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie('admin_session');
  res.json({ success: true });
});

adminAuthRouter.post('/password', requireAdminAuth, asyncHandler(async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const { currentPassword, newPassword } = parsed.data;
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must be different from the current password' });
  }

  const adminId = (req as AdminRequest).adminId!;
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Truncate to the whole second so it compares cleanly with JWT iat.
  const passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), passwordChangedAt },
  });

  setAdminSessionCookie(res, admin.id);
  res.json({ success: true });
}));
```

- [ ] **Step 10: Run the route tests, then the full backend suite**

Run: `cd server && npx vitest run tests/admin/password.test.ts`
Expected: 6 passed.

Run: `cd server && npm test`
Expected: all pass. That's 129 existing minus 6 old middleware tests, plus 9 middleware and 6 password tests, so 138 total.

Also run `cd server && npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations server/src/services/adminSession.ts server/src/middleware/adminAuth.ts server/src/routes/admin/auth.routes.ts server/tests/middleware/adminAuth.test.ts server/tests/admin/password.test.ts
git commit -m "feat(server): admin password change that signs out older sessions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do **not** stage `server/prisma/migrations/migration_lock.toml` if its only diff is line endings (it's pre-existing and unrelated). Check with `git diff --stat server/prisma/migrations/migration_lock.toml` and leave it unstaged.

---

### Task 2: Admin UI: change-password form on the Settings page

**Files:**
- Modify: `src/app/admin/lib/adminApi.ts` (add a function after `adminLogout`)
- Create: `src/app/admin/pages/ChangePasswordForm.tsx`
- Modify: `src/app/admin/pages/SettingsPage.tsx` (render the form)
- Modify: `src/test/server.ts` (add a default handler to `adminHandlers`)
- Modify: `src/app/admin/pages/SettingsPage.test.tsx` (append tests)

**Interfaces:**
- **Consumes:** HTTP `POST /api/admin/password` from Task 1, with the error strings from Global Constraints. Also `adminFetch(path, init, { unauthorizedIsError })`, `AdminApiError` (in `adminApi.ts`), `API_URL` (in `src/test/fixtures.ts`), and `renderAdminPage` (in `src/test/renderAdmin.tsx`).
- **Produces:** `changePassword(currentPassword: string, newPassword: string): Promise<void>` exported from `adminApi.ts`, and `ChangePasswordForm` exported from `ChangePasswordForm.tsx`.

- [ ] **Step 1: Add the default MSW handler**

In `src/test/server.ts`, add this entry to the `adminHandlers` array, right after the `/api/admin/logout` handler:

```ts
  http.post(`${API_URL}/api/admin/password`, () => HttpResponse.json({ success: true })),
```

- [ ] **Step 2: Write the failing tests**

Append inside the existing `describe('SettingsPage', ...)` block in `src/app/admin/pages/SettingsPage.test.tsx`:

```tsx
  describe('change password', () => {
    async function fillPasswordForm(user: ReturnType<typeof userEvent.setup>, current: string, next: string, confirm: string) {
      await screen.findByLabelText('Current password');
      if (current) await user.type(screen.getByLabelText('Current password'), current);
      if (next) await user.type(screen.getByLabelText('New password'), next);
      if (confirm) await user.type(screen.getByLabelText('Confirm new password'), confirm);
      await user.click(screen.getByRole('button', { name: 'Change password' }));
    }

    it('blocks the request when the confirmation does not match', async () => {
      let called = false;
      server.use(http.post(`${API_URL}/api/admin/password`, () => { called = true; return HttpResponse.json({ success: true }); }));
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'old-password', 'new-password-1', 'new-password-2');
      expect(await screen.findByText('New passwords do not match')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('blocks the request when the new password is shorter than 8 characters', async () => {
      let called = false;
      server.use(http.post(`${API_URL}/api/admin/password`, () => { called = true; return HttpResponse.json({ success: true }); }));
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'old-password', 'short', 'short');
      expect(await screen.findByText('New password must be at least 8 characters')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('blocks the request when a field is empty', async () => {
      let called = false;
      server.use(http.post(`${API_URL}/api/admin/password`, () => { called = true; return HttpResponse.json({ success: true }); }));
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, '', 'new-password-1', 'new-password-1');
      expect(await screen.findByText('Fill in all three password fields')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('shows the server error inline when the current password is wrong', async () => {
      server.use(
        http.post(`${API_URL}/api/admin/password`, () =>
          HttpResponse.json({ error: 'Current password is incorrect' }, { status: 401 }),
        ),
      );
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'wrong-password', 'new-password-1', 'new-password-1');
      expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    });

    it('sends both passwords and clears the form on success', async () => {
      let receivedBody: unknown;
      server.use(
        http.post(`${API_URL}/api/admin/password`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ success: true });
        }),
      );
      const user = userEvent.setup();
      renderAdminPage(<SettingsPage />);
      await fillPasswordForm(user, 'old-password', 'new-password-1', 'new-password-1');
      await waitFor(() => expect(receivedBody).toEqual({ currentPassword: 'old-password', newPassword: 'new-password-1' }));
      await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
      expect(screen.getByLabelText('New password')).toHaveValue('');
      expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
    });
  });
```

(`screen`, `waitFor`, `userEvent`, `http`, `HttpResponse`, `server`, `API_URL` and `renderAdminPage` are already imported at the top of this file.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/app/admin/pages/SettingsPage.test.tsx`
Expected: the 5 new tests FAIL, because there's no "Current password" label yet. The 2 existing tests still pass.

- [ ] **Step 4: Add `changePassword` to the API client**

In `src/app/admin/lib/adminApi.ts`, add right after `adminLogout`:

```ts
// A 401 here means "current password is wrong", not an expired session, so it
// must not trigger the central redirect-to-login handling (same as adminLogin).
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await adminFetch(
    '/api/admin/password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
    { unauthorizedIsError: true },
  );
}
```

- [ ] **Step 5: Create the form component**

Create `src/app/admin/pages/ChangePasswordForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AdminApiError, changePassword } from '../lib/adminApi';

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormError(null);
      toast.success('Password changed');
    },
    onError: (error) => {
      setFormError(error instanceof AdminApiError ? error.message : 'Could not change password');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError('Fill in all three password fields');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match');
      return;
    }
    setFormError(null);
    mutation.mutate();
  };

  return (
    <section className="mt-10">
      <h2 className="text-xl mb-4">Account</h2>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </section>
  );
}
```

- [ ] **Step 6: Render it on the Settings page**

In `src/app/admin/pages/SettingsPage.tsx`:
- Add the import `import { ChangePasswordForm } from './ChangePasswordForm';`.
- Insert `<ChangePasswordForm />` as the last child of the root `<div className="max-w-sm">`, right after the closing `</form>`:

```tsx
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
      <ChangePasswordForm />
    </div>
  );
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/app/admin/pages/SettingsPage.test.tsx`
Expected: 7 passed.

Run: `npm test`
Expected: all pass (142 + 5 = 147).

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/lib/adminApi.ts src/app/admin/pages/ChangePasswordForm.tsx src/app/admin/pages/SettingsPage.tsx src/app/admin/pages/SettingsPage.test.tsx src/test/server.ts
git commit -m "feat(admin): change-password form on the Settings page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Serve `/api` from the frontend's own origin

**Files:**
- Modify: `src/app/lib/api.ts:41` (the `API_BASE_URL` line)
- Modify: `src/app/admin/lib/adminApi.ts:84` (the `API_BASE_URL` line)
- Modify: `src/test/fixtures.ts:4` (the `API_URL` line)
- Modify: `vite.config.ts`
- Modify: `.env.example`
- Modify: `server/README.md` (the "Deployment" and "Known limitations for cross-origin frontend deployment" sections)

**Interfaces:**
- **Consumes:** nothing from earlier tasks.
- **Produces:** in the browser, storefront and admin requests go to `${window.location.origin}/api/...` unless `VITE_API_BASE_URL` is set. In dev, Vite forwards `/api` to `http://localhost:4000`. In tests, `API_URL === window.location.origin`, the jsdom origin.

- [ ] **Step 1: Change the test fixture to the page origin (tests go red)**

In `src/test/fixtures.ts`, replace

```ts
export const API_URL = 'http://localhost:4000';
```

with

```ts
// The API clients default to the page's own origin (see src/app/lib/api.ts).
export const API_URL = window.location.origin;
```

Run: `npm test`
Expected: FAIL. Many storefront and admin tests error with MSW "unhandled request" or network errors, because the clients still call `http://localhost:4000` while the handlers now listen on the jsdom origin.

- [ ] **Step 2: Default both API clients to the page origin**

In `src/app/lib/api.ts`, replace

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
```

with

```ts
// Same-origin by default: Vite proxies /api in dev and the host rewrites it in
// production, so the admin cookie stays first-party. VITE_API_BASE_URL overrides.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
```

In `src/app/admin/lib/adminApi.ts`, make the same replacement on its `API_BASE_URL` line, with the same comment.

- [ ] **Step 3: Add the dev proxy**

In `vite.config.ts`, add a `server` key to the `defineConfig({...})` object, after `resolve`:

```ts
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
```

- [ ] **Step 4: Stop `.env.example` from pinning a cross-origin URL**

Replace the contents of the root `.env.example` with:

```bash
# Optional. By default the storefront and admin call /api on their own origin
# (Vite proxies it to http://localhost:4000 in dev). Set this only to point the
# frontend at an API on a different origin; admin login will not work cross-site.
# VITE_API_BASE_URL=http://localhost:4000
```

- [ ] **Step 5: Run the frontend suite to verify it is green again**

Run: `npm test`
Expected: all pass (147).

- [ ] **Step 6: Verify the proxy in a running dev server**

With the backend running (`cd server && npm run dev`), run `npx vite --port 5174 --strictPort` in the background, then:

```bash
curl -s http://localhost:5174/api/health
```

Expected: `{"status":"ok"}`. Stop that Vite process afterwards.

- [ ] **Step 7: Update the server README**

In `server/README.md`, in the "## Deployment (free-tier target)" numbered list, add this step right after step 2:

```markdown
   - Serve the frontend and the API from **one origin**: configure the frontend
     host to forward `/api/*` to this API, so the admin session cookie stays
     first-party. Examples (replace `<api-host>`):
     - Vercel `vercel.json`:
       `{ "rewrites": [{ "source": "/api/:path*", "destination": "https://<api-host>/api/:path*" }] }`
     - Netlify `_redirects`:
       `/api/*  https://<api-host>/api/:splat  200`
     Leave `VITE_API_BASE_URL` unset in the frontend build.
```

Replace the whole "## Known limitations for cross-origin frontend deployment" section (from that heading to the end of its closing paragraph, "…follow-ups for whoever picks up the frontend-integration plan.") with:

```markdown
## Why the frontend proxies `/api` instead of calling the API cross-origin

The `admin_session` cookie is `SameSite=Lax`. Browsers don't attach `Lax`
cookies to cross-site `fetch` requests, so an admin frontend on a different
site than the API would log in successfully and then get 401 on every admin
request. Switching to `SameSite=None; Secure` would only work until the cookie
is blocked as a third-party cookie (Safari already blocks these; Chrome is
phasing them out). Serving `/api` from the frontend's own origin (the Vite
proxy in dev, a host rewrite in production — see Deployment) keeps the cookie
first-party everywhere.

Unhandled errors from async route handlers are forwarded to the terminal error
handler by `asyncHandler` (and the Razorpay webhook has its own handling), so
they return a clean 500 instead of hanging the request.
```

- [ ] **Step 8: Commit**

```bash
git add src/app/lib/api.ts src/app/admin/lib/adminApi.ts src/test/fixtures.ts vite.config.ts .env.example server/README.md
git commit -m "feat: call /api on the page's own origin via a Vite proxy and host rewrite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Storefront final-review fixes

**Files:**
- Modify: `src/app/types.ts` (`Product` interface)
- Modify: `src/app/lib/adapters.ts` (`adaptProduct`)
- Modify: `src/app/lib/adapters.test.ts` (append tests)
- Modify: `src/test/fixtures.ts` (`makeProduct`)
- Modify: `src/app/pages/CategoryPage.tsx` (full rewrite below)
- Modify: `src/app/pages/CategoryPage.test.tsx` (full rewrite below)
- Modify: `src/app/App.tsx:100` and `src/app/App.test.tsx:27,34,99` (error message)
- Modify: `src/app/lib/useApiData.ts` (JSDoc)
- Modify: `src/app/lib/api.ts` (`fetchJson` timeout) and `src/app/lib/api.test.ts` (append test)
- Modify: `.gitignore`

**Interfaces:**
- **Consumes:** `API_URL` / `makeApiProduct` / `makeApiVariant` / `makeApiCategory` / `makeProduct` from `src/test/fixtures.ts`. `ApiProduct.category` has `{ name, slug, ... }`.
- **Produces:**
  - `Product.categorySlug: string`, a required field.
  - `adaptProduct` sets `categorySlug` from `api.category.slug`, and `inStock` is true when any variant has `stock > 0`.
  - `REQUEST_TIMEOUT_MS = 10_000` exported from `src/app/lib/api.ts`. A timed-out request rejects with ``Error(`Request to ${path} timed out`)``.

- [ ] **Step 1: Write the failing adapter tests**

Append to `src/app/lib/adapters.test.ts`, inside `describe('adaptProduct', ...)`:

```ts
  it('carries the category slug through', () => {
    const product = adaptProduct(makeApiProduct());
    expect(product.categorySlug).toBe('diwali-decor');
  });

  it('is in stock when any variant has stock, even if the first does not', () => {
    const product = adaptProduct(
      makeApiProduct({
        variants: [
          makeApiVariant({ id: 'v1', stock: 0 }),
          makeApiVariant({ id: 'v2', stock: 3 }),
        ],
      }),
    );
    expect(product.inStock).toBe(true);
  });

  it('is out of stock when every variant has zero stock', () => {
    const product = adaptProduct(
      makeApiProduct({
        variants: [
          makeApiVariant({ id: 'v1', stock: 0 }),
          makeApiVariant({ id: 'v2', stock: 0 }),
        ],
      }),
    );
    expect(product.inStock).toBe(false);
  });
```

(`makeApiProduct()`'s default category is `makeApiCategory()`, whose slug is `diwali-decor`. See the existing `adaptCategory` test.)

Run: `npx vitest run src/app/lib/adapters.test.ts`
Expected: "carries the category slug through" and "is in stock when any variant has stock…" FAIL.

- [ ] **Step 2: Add `categorySlug` and fix `inStock`**

In `src/app/types.ts`, in `interface Product`, add right after `category: string;`:

```ts
  categorySlug: string;
```

In `src/app/lib/adapters.ts`, in `adaptProduct`, replace

```ts
  const inStock = defaultVariant ? defaultVariant.stock > 0 : false;
```

with

```ts
  const inStock = api.variants.some((v) => v.stock > 0);
```

and in the returned object add right after `category: api.category.name,`:

```ts
    categorySlug: api.category.slug,
```

In `src/test/fixtures.ts`, in `makeProduct`'s returned object, add right after `category: 'Diwali Decor',`:

```ts
    categorySlug: 'diwali-decor',
```

Run: `npx vitest run src/app/lib/adapters.test.ts`
Expected: all pass.

- [ ] **Step 3: Write the failing CategoryPage tests**

Replace `src/app/pages/CategoryPage.test.tsx` with:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CategoryPage } from './CategoryPage';
import { makeProduct } from '../../test/fixtures';
import type { AdaptedCategory } from '../lib/adapters';
import type { Product } from '../types';

const categories: AdaptedCategory[] = [
  { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' },
  { title: 'Kanha Dresses', description: '', image: '', icon: '', slug: 'kanha-dresses' },
];
const products = [
  makeProduct({ id: '1', slug: 'diya', name: 'Brass Diya', category: 'Diwali Decor', categorySlug: 'diwali-decor' }),
  makeProduct({ id: '2', slug: 'lantern', name: 'Paper Lantern', category: 'Diwali Decor', categorySlug: 'diwali-decor' }),
  makeProduct({ id: '3', slug: 'poshak', name: 'Kanha Poshak', category: 'Kanha Dresses', categorySlug: 'kanha-dresses' }),
];

function renderAt(path: string, pageProducts: Product[] = products, pageCategories: AdaptedCategory[] = categories) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/category/:category"
          element={<CategoryPage products={pageProducts} categories={pageCategories} onAddToCart={() => {}} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CategoryPage', () => {
  it('shows the category title and only its products', () => {
    renderAt('/category/diwali-decor');
    expect(screen.getByRole('heading', { level: 1, name: 'Diwali Decor' })).toBeInTheDocument();
    expect(screen.getByText('Browse our collection of diwali decor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paper Lantern' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kanha Poshak' })).not.toBeInTheDocument();
  });

  it('shows "Category not found" with a link home for an unknown category', () => {
    renderAt('/category/nope');
    expect(screen.getByText('Category not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to shopping' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('shows an empty message for a category with no products', () => {
    renderAt('/category/diwali-decor', []);
    expect(screen.getByText('No products found in this category.')).toBeInTheDocument();
  });

  it('filters by slug, not display name, when two categories share a name', () => {
    const sameName: AdaptedCategory[] = [
      { title: 'Gifts', description: '', image: '', icon: '', slug: 'gifts-a' },
      { title: 'Gifts', description: '', image: '', icon: '', slug: 'gifts-b' },
    ];
    const giftProducts = [
      makeProduct({ id: 'a', slug: 'a', name: 'Gift A', category: 'Gifts', categorySlug: 'gifts-a' }),
      makeProduct({ id: 'b', slug: 'b', name: 'Gift B', category: 'Gifts', categorySlug: 'gifts-b' }),
    ];
    renderAt('/category/gifts-b', giftProducts, sameName);
    expect(screen.getByRole('heading', { name: 'Gift B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gift A' })).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/app/pages/CategoryPage.test.tsx`
Expected: "shows 'Category not found'…" and "filters by slug…" FAIL.

- [ ] **Step 4: Rewrite CategoryPage**

Replace `src/app/pages/CategoryPage.tsx` with:

```tsx
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ProductCard } from '../components/ProductCard';
import { Reveal } from '../components/Reveal';
import { Product } from '../types';
import { AdaptedCategory } from '../lib/adapters';

function staggerDelay(index: number) {
  return Math.min(index, 8) * 0.05;
}

interface CategoryPageProps {
  products: Product[];
  categories: AdaptedCategory[];
  onAddToCart: (product: Product) => void;
}

export function CategoryPage({ products, categories, onAddToCart }: CategoryPageProps) {
  const { category: categorySlug } = useParams<{ category: string }>();
  const matchedCategory = categories.find((c) => c.slug === categorySlug);

  if (!matchedCategory) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-lg mb-4">Category not found</p>
        <Link to="/" className="text-primary hover:underline">
          Back to shopping
        </Link>
      </div>
    );
  }

  const filteredProducts = products.filter((p) => p.categorySlug === matchedCategory.slug);

  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto px-4">
        <Reveal>
          <h1 className="text-4xl md:text-5xl mb-4">{matchedCategory.title}</h1>
          <p className="text-muted-foreground mb-12">
            Browse our collection of {matchedCategory.title.toLowerCase()}
          </p>
        </Reveal>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                className="h-full"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: staggerDelay(index), ease: 'easeOut' }}
              >
                <ProductCard
                  product={product}
                  onAddToCart={onAddToCart}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-16">
            No products found in this category.
          </p>
        )}
      </div>
    </div>
  );
}
```

Run: `npx vitest run src/app/pages/CategoryPage.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Change the load-error message (test first)**

In `src/app/App.test.tsx`, replace all three occurrences of `"Couldn't load products, please try again later."` with `"Couldn't load products or categories. Please try again."`.

Run: `npx vitest run src/app/App.test.tsx`
Expected: the two error-state tests FAIL. The third occurrence is a `.not` assertion and still passes.

In `src/app/App.tsx`, replace

```tsx
            <p className="text-lg">Couldn't load products, please try again later.</p>
```

with

```tsx
            <p className="text-lg">Couldn't load products or categories. Please try again.</p>
```

Run: `npx vitest run src/app/App.test.tsx`
Expected: all pass.

- [ ] **Step 6: Write the failing timeout test**

Append to `src/app/lib/api.test.ts`. Extend the file's first import line to `import { afterEach, describe, expect, it, vi } from 'vitest';`, and add `REQUEST_TIMEOUT_MS` to the `./api` import:

```ts
describe('request timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects with a timeout error when the API does not answer in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // A fetch that only settles when its signal aborts, standing in for a hung backend.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const request = getCategories();
    const assertion = expect(request).rejects.toThrow('Request to /api/categories timed out');
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
  });
});
```

Run: `npx vitest run src/app/lib/api.test.ts`
Expected: FAIL. `REQUEST_TIMEOUT_MS` isn't exported yet (it's `undefined`), and the request never rejects.

- [ ] **Step 7: Add the timeout to `fetchJson`**

In `src/app/lib/api.ts`, replace the whole `fetchJson` function with:

```ts
export const REQUEST_TIMEOUT_MS = 10_000;

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Request to ${path} failed with status ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Request to ${path} timed out`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

Run: `npx vitest run src/app/lib/api.test.ts`
Expected: all pass.

- [ ] **Step 8: Document `useApiData`'s contract**

In `src/app/lib/useApiData.ts`, add directly above `export function useApiData`:

```ts
/**
 * Runs `fetcher` once, on mount, and tracks its loading/error/data state.
 *
 * Later changes to `fetcher` are deliberately ignored (the effect has no deps),
 * so pass a stable fetcher. A fetcher that closes over changing values — e.g.
 * `() => getProducts(slug)` with a route param — will keep returning the first
 * result; add a deps parameter before using it that way.
 */
```

- [ ] **Step 9: Ignore local env files**

Append to the root `.gitignore`:

```
.env
.env.local
.env.*.local
```

Run: `git check-ignore -v .env.example; echo "exit $?"`
Expected: no match and `exit 1`, meaning `.env.example` is still tracked.

- [ ] **Step 10: Full frontend suite and build**

Run: `npm test`
Expected: all pass (147 + 3 adapters + 2 CategoryPage + 1 timeout = 153).

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 11: Commit**

```bash
git add src/app/types.ts src/app/lib/adapters.ts src/app/lib/adapters.test.ts src/test/fixtures.ts src/app/pages/CategoryPage.tsx src/app/pages/CategoryPage.test.tsx src/app/App.tsx src/app/App.test.tsx src/app/lib/useApiData.ts src/app/lib/api.ts src/app/lib/api.test.ts .gitignore
git commit -m "fix(storefront): category not-found page, slug matching, any-variant stock, request timeout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Playwright browser smoke tests

**Files:**
- Modify: `package.json` / `package-lock.json` (dev dependency and script)
- Create: `playwright.config.ts`
- Create: `e2e/env.ts`, `e2e/global-setup.ts`, `e2e/storefront.spec.ts`, `e2e/admin.spec.ts`
- Modify: `src/app/components/Cart.tsx` (two `aria-label`s)
- Modify: `.gitignore`, `README.md`, `server/README.md`

**Interfaces:**
- **Consumes:**
  - Task 1: `POST /api/admin/password`, and the rule that older sessions are rejected.
  - Task 2: the Settings form's labels `Current password` / `New password` / `Confirm new password`, the button `Change password`, and the toast `Password changed`.
  - Task 3: the Vite `/api` proxy.
  - Task 4: `Category not found`, and `Couldn't load products or categories. Please try again.`
  - Existing: the login form labels `Email` / `Password` and the button `Log in`. `/admin` redirects to `/admin/login` on 401. Product cards render the name as an `h3` and have an `Add to Cart` button. The cart drawer is a Radix `Sheet` (role `dialog`) titled `Shopping Cart (N)`. Category cards are `<a href="/category/<slug>">` containing an `h3` title. The seed admin is `admin@example.com` / `changeme123`.
- **Produces:** `npm run e2e`.

- [ ] **Step 1: One-time local setup**

```bash
cd server && docker compose exec -T postgres createdb -U ecommerce ecommerce_e2e; cd ..
npm install -D -E @playwright/test@1.63.0
npx playwright install chromium
```

Expected: the database is created (or "already exists", which is fine), the package is added to `devDependencies`, and Chromium is downloaded.

In `package.json` `"scripts"`, add `"e2e": "playwright test"`.

- [ ] **Step 2: Label the cart quantity buttons**

In `src/app/components/Cart.tsx`, the quantity buttons render only `<Minus …/>` / `<Plus …/>` icons and have no accessible name.
- Add `aria-label="Decrease quantity"` to the `<Button>` whose `onClick` calls `onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))`.
- Add `aria-label="Increase quantity"` to the `<Button>` whose `onClick` calls `onUpdateQuantity(item.id, item.quantity + 1)`.

Run: `npm test`
Expected: all pass. Labels don't change behaviour.

- [ ] **Step 3: Shared e2e settings**

Create `e2e/env.ts`:

```ts
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://ecommerce:ecommerce@localhost:5433/ecommerce_e2e';

// Seed credentials, passed explicitly so a SEED_ADMIN_* value in server/.env can't change them.
export const SEED_ADMIN_EMAIL = 'admin@example.com';
export const SEED_ADMIN_PASSWORD = 'changeme123';

export const API_ORIGIN = 'http://localhost:4000';
```

- [ ] **Step 4: Global setup (reset the e2e DB)**

Create `e2e/global-setup.ts`:

```ts
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E_DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from './env';

export default function globalSetup() {
  // Guard: never reset anything but a dedicated e2e database.
  if (!/\/ecommerce_e2e(\?|$)/.test(E2E_DATABASE_URL)) {
    throw new Error(`Refusing to reset ${E2E_DATABASE_URL}: e2e tests only run against the ecommerce_e2e database.`);
  }
  // Drops, re-migrates and re-seeds, so every run starts from the seed data
  // (the seed's admin upsert never resets an existing password).
  execSync('npx prisma migrate reset --force', {
    cwd: fileURLToPath(new URL('../server', import.meta.url)),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      SEED_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD,
    },
  });
}
```

- [ ] **Step 5: Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL } from './e2e/env';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Never reuse: a dev API already on :4000 would be pointed at ecommerce_dev,
      // and the admin test would change the dev admin's password. Playwright fails
      // fast on a busy port instead.
      command: 'npm run dev',
      cwd: 'server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: false,
      env: { DATABASE_URL: E2E_DATABASE_URL },
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
```

(`server/src/index.ts` loads `dotenv/config`, which doesn't override variables that are already set, so the `DATABASE_URL` passed here wins over `server/.env`.)

- [ ] **Step 6: Storefront specs**

Create `e2e/storefront.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { API_ORIGIN } from './env';

interface ApiVariant { price: number | null }
interface ApiProduct { name: string; slug: string; basePrice: number; variants: ApiVariant[] }
interface ApiCategory { name: string; slug: string }

function cardFor(page: Page, productName: string) {
  // Deepest element that holds both the product's heading and an Add to Cart button.
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { level: 3, name: productName, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Add to Cart' }) })
    .last();
}

test('home page shows the real categories and products', async ({ page, request }) => {
  const categories = (await (await request.get(`${API_ORIGIN}/api/categories`)).json()) as ApiCategory[];
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  expect(categories.length).toBeGreaterThan(0);

  await page.goto('/');
  for (const category of categories) {
    await expect(
      page.locator(`a[href="/category/${category.slug}"]`).getByRole('heading', { name: category.name, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 3, name: products[0].name, exact: true })).toBeVisible();
});

test('add to cart and change the quantity', async ({ page, request }) => {
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  const product = products[0];
  const price = product.variants[0]?.price ?? product.basePrice;

  await page.goto('/');
  await cardFor(page, product.name).getByRole('button', { name: 'Add to Cart' }).click();

  const cart = page.getByRole('dialog', { name: /Shopping Cart/ });
  await expect(cart).toBeVisible();
  await expect(cart.getByText(product.name, { exact: true })).toBeVisible();
  await expect(cart.getByText(`₹${price}`, { exact: true }).first()).toBeVisible();

  await cart.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(cart.getByText(`₹${price * 2}`, { exact: true }).first()).toBeVisible();
});

test('a category card shows only that category, and Back returns home', async ({ page, request }) => {
  const categories = (await (await request.get(`${API_ORIGIN}/api/categories`)).json()) as ApiCategory[];
  const category = categories[0];
  const expected = (await (await request.get(`${API_ORIGIN}/api/products?category=${category.slug}`)).json()) as ApiProduct[];

  await page.goto('/');
  await page.locator(`a[href="/category/${category.slug}"]`).filter({ hasText: category.name }).first().click();

  await expect(page).toHaveURL(`/category/${category.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: category.name })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 3 })).toHaveCount(expected.length);
  for (const product of expected) {
    await expect(main.getByRole('heading', { level: 3, name: product.name, exact: true })).toBeVisible();
  }

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator(`a[href="/category/${category.slug}"]`).first()).toBeVisible();
});

test('an unknown category shows "Category not found"', async ({ page }) => {
  await page.goto('/category/does-not-exist');
  await expect(page.getByText('Category not found')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to shopping' })).toBeVisible();
});

test('the storefront shows an error, not a blank page, when the API is down', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText("Couldn't load products or categories. Please try again.")).toBeVisible();
});
```

- [ ] **Step 7: Admin spec**

Create `e2e/admin.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } from './env';

const NEW_PASSWORD = 'e2e-new-password-1';

async function logIn(page: Page, password: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(SEED_ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('changing the password keeps this session and signs out the others', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // B logs in first, then we wait past the second boundary so its session is
  // strictly older than the password change (sessions are compared by second).
  await logIn(pageB, SEED_ADMIN_PASSWORD);
  await expect(pageB).toHaveURL('/admin');
  await pageB.waitForTimeout(1100);

  await logIn(pageA, SEED_ADMIN_PASSWORD);
  await expect(pageA).toHaveURL('/admin');
  await pageA.goto('/admin/settings');
  await pageA.getByLabel('Current password').fill(SEED_ADMIN_PASSWORD);
  await pageA.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await pageA.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await pageA.getByRole('button', { name: 'Change password' }).click();
  await expect(pageA.getByText('Password changed')).toBeVisible();

  // A stays logged in.
  await pageA.reload();
  await expect(pageA).toHaveURL('/admin/settings');
  await expect(pageA.getByLabel('Current password')).toBeVisible();

  // B's older session is rejected and bounced to login.
  await pageB.goto('/admin');
  await expect(pageB).toHaveURL('/admin/login');

  // Old password fails; new password works.
  const pageC = await (await browser.newContext()).newPage();
  await logIn(pageC, SEED_ADMIN_PASSWORD);
  await expect(pageC.getByText(/invalid credentials/i)).toBeVisible();
  await logIn(pageC, NEW_PASSWORD);
  await expect(pageC).toHaveURL('/admin');

  await contextA.close();
  await contextB.close();
});
```

(`LoginPage.tsx` renders the server's error message for a failed login, and the API returns `Invalid credentials`.)

- [ ] **Step 8: Ignore Playwright output**

Append to the root `.gitignore`:

```
test-results/
playwright-report/
```

- [ ] **Step 9: Run the e2e suite**

Make sure nothing is listening on port 4000 first. In PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

Then run `npm run e2e`.

Expected: 6 passed. If a test fails, open `test-results/` for its screenshot and trace, then fix the **test's selector** if the UI is correct, or report the UI defect. Never loosen an assertion to hide a real UI bug.

- [ ] **Step 10: Document e2e in both READMEs**

Append to the root `README.md`:

```markdown
  ## Browser smoke tests (Playwright)

  One-time setup (Postgres running via `cd server && docker compose up -d`):

  - `cd server && docker compose exec postgres createdb -U ecommerce ecommerce_e2e`
  - `npx playwright install chromium`

  Run `npm run e2e`. It resets and re-seeds the separate `ecommerce_e2e`
  database, starts its own API on port 4000 (stop your dev API first — the run
  fails fast if the port is busy, so it can never touch `ecommerce_dev`), and
  starts or reuses the Vite dev server on port 5173. Failure screenshots and
  traces land in `test-results/`.
```

In `server/README.md`, under "## Testing", append:

```markdown
Browser smoke tests live at the repo root (`npm run e2e`) and use their own
`ecommerce_e2e` database; see the root README for the one-time setup.
```

- [ ] **Step 11: Final full check**

Run all of these. Expected: all green, with the e2e run needing port 4000 free first.

```bash
npm test
npm run build
cd server && npm test && npx tsc --noEmit && cd ..
npm run e2e
```

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e src/app/components/Cart.tsx .gitignore README.md server/README.md
git commit -m "test: add Playwright browser smoke tests for the storefront and admin password change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Definition of done

- `npm test` (frontend), `cd server && npm test` (backend), and `npm run e2e` all pass. `npm run build` and `cd server && npx tsc --noEmit` are clean.
- Spec §1 (password change + session invalidation + Account form) → Tasks 1–2.
- Spec §2 (same-origin `/api` + README) → Task 3.
- Spec §3 (M1–M5, I2 residual, name-match minor) → Task 4.
- Spec §4 (Playwright) → Task 5.
