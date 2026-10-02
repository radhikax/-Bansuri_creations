# Storefront UI Fixes — Design Spec

**Date:** 2026-09-25
**Status:** Approved in brainstorming, pending written-spec review
**Branch:** `worktree-storefront-data-wiring` (builds on `bbbb457`, the tip of
`feature/storefront-admin-hardening`)

## Purpose

Fix the problems found in the 2026-09-24 UI test round (a Playwright walkthrough
of 22 screens at desktop 1366px and phone 390px):

1. **Oversized images.** Product and category photos are raw Unsplash
   originals, so the home page downloads about **34 MB** of images (up to
   7.5 MB each). The first load of the home page took about 24 s, and product
   thumbnails stay blank while they load.
2. **Cart shipping doesn't match the server.** `Cart.tsx` hardcodes ₹50. The
   store settings say the fee is ₹50 but shipping is free at or above ₹999, and
   the server's `computeOrderTotals` applies that rule. So a ₹1598 cart shows
   ₹1648, while the order would actually be ₹1598.
3. **Hero buttons.** "View Collections" shows white text on a near-white
   background (`variant="outline"` adds a light background). Neither
   "Shop Now" nor "View Collections" does anything when clicked.
4. **No navigation on phones.** The header nav is `hidden md:flex`, and nothing
   replaces it below 768px. The header and footer category links are also
   hardcoded, with fixed slugs and shortened labels.
5. **React ref warnings.** 46 of the 48 components in `src/app/components/ui/`
   are written in the React 19 style, where a component receives `ref` as a
   normal prop. The app runs **React 18.3.1**, which silently drops those refs.
   Radix `asChild`, `Slot` and `Presence` rely on them, which can break focus
   return and positioning. The console shows "Function components cannot be
   given refs" for `Button` and `SheetOverlay`.

## Out of scope

- **Duplicate product photos.** Seven photos are shared across products and
  categories, but the owner will supply real product photos through
  Admin → Products → Edit once the app is working. They would replace any
  placeholder fix, so there are no seed changes and no update script.
  Follow-up: once real photos are hosted somewhere other than Unsplash,
  resizing them needs its own solution (§1 only resizes Unsplash URLs).
- A free-shipping hint ("Add ₹X more for free shipping").
- Upgrading to React 19.
- The 32 `ui/` components the app doesn't use.
- The footer's "Quick Links" (About, Contact, FAQs, Shipping/Return Policy),
  which all point to `/` as placeholders.
- Checkout wiring. The "Place order" button is still a demo `alert`; that has
  its own spec.

---

## 1. Image sizing

### Helper: `src/app/lib/images.ts` (new)

```ts
export function optimizedImageUrl(url: string, width: number): string;
export function imageSrcSet(url: string, width: number): string | undefined;
```

- **`optimizedImageUrl`**
  - An `images.unsplash.com` URL gets these query parameters set or
    overwritten: `w=<width>`, `q=75`, `auto=format`, `fit=crop`. Any other
    existing parameters are kept.
  - Any other URL (another host, a relative path, a data URI, an empty string)
    is returned **unchanged**.
- **`imageSrcSet`**
  - For an Unsplash URL, returns
    `"<optimizedImageUrl(url, width)> 1x, <optimizedImageUrl(url, width * 2)> 2x"`.
  - For anything else, returns `undefined`.

### Where it's used

| Component | Width | `loading` |
|---|---|---|
| `ProductCard` (image via `ShimmerImage`) | 600 | `lazy` |
| `CategoryCard` | 600 | `lazy` |
| `ImageGallery` main image | 1200 | eager (default) |
| `ImageGallery` thumbnails | 200 | `lazy` |
| `Cart` line image | 160 | `lazy` |
| `flyToCart` animated copy | 160 | n/a |

- Each `<img>` sets `src={optimizedImageUrl(url, W)}` and
  `srcSet={imageSrcSet(url, W)}`.
- `ShimmerImage` passes `srcSet` and `loading` through to the `<img>` (it
  already spreads its props).
- The hero background already requests `w=1080&q=80`, so it's unchanged.
- The adapters keep storing raw URLs. Sizing happens only when rendering, so it
  works on existing databases and on URLs typed into the admin, with no data
  migration.

---

## 2. Cart shipping matches the server

### Server

- **New `server/src/services/shippingConfig.ts`:**
  `getShippingConfig(db): Promise<ShippingConfig>`.
  - It reads `StoreSettings` id 1 and falls back to
    `{ flatShippingFee: 50, freeShippingThreshold: 999 }`.
  - `db` is a Prisma client or transaction client, so it works inside the
    order route's `$transaction`.
- **`orders.routes.ts`:** its inline lookup-plus-defaults is replaced with
  `getShippingConfig(tx)`. Behaviour is unchanged.
- **New public route: `GET /api/settings/shipping`**
  - File: `server/src/routes/settings.routes.ts`, mounted at `/api/settings`.
  - Returns `200 { flatShippingFee: number, freeShippingThreshold: number }`
    and nothing else (no `id`, no timestamps).
  - Wrapped in `asyncHandler`. No auth.

### Frontend

- **`src/app/lib/api.ts`:**
  - `export interface ShippingSettings { flatShippingFee: number; freeShippingThreshold: number }`
  - `export function getShippingSettings(): Promise<ShippingSettings>`, using
    the existing `fetchJson`, so it gets the same 10 s timeout.
- **New `src/app/lib/shipping.ts`:**
  `calculateShipping(subtotal: number, config: ShippingSettings): number`. The
  rule matches the server's `computeOrderTotals`:
  - `subtotal <= 0` → `0`
  - `subtotal >= freeShippingThreshold` → `0`
  - otherwise → `flatShippingFee`
- **`App.tsx`:**
  - loads `useApiData(getShippingSettings)` alongside categories and products
  - passes `shippingSettings: ShippingSettings | null` to `Cart`
  - the settings' loading and error states **do not** gate the page (unlike
    categories and products)
- **`Cart.tsx`:**
  - Drop the hardcoded `50`.
  - With settings:
    - `shipping = calculateShipping(subtotal, shippingSettings)`
    - the Shipping row shows `Free` when it's `0` and the subtotal is above 0,
      otherwise `₹<shipping>`
    - `total = subtotal + shipping`
  - Without settings (still loading, or failed):
    - the Shipping row shows `Calculated at checkout`
    - Total shows the subtotal
  - The checkout dialog's review step uses the same shipping and total values.

---

## 3. Hero buttons

- **"View Collections":** keep `variant="outline"`, but override it to a
  transparent button with a white border and white text:
  `bg-transparent border-white text-white hover:bg-white/10 hover:text-white`.
- **Both buttons become anchor links**, rendered with the `Button`
  (`asChild`) wrapping an `<a>`:
  - "Shop Now" → `href="#featured"`
  - "View Collections" → `href="#categories"`
- **`HomePage.tsx`:** the "Shop by Category" section gets `id="categories"`
  and the "Featured Products" section gets `id="featured"`. Both get
  `scroll-mt-20`, so the sticky header doesn't cover the section heading.

---

## 4. Navigation from real categories, and a phone menu

- **`App.tsx`:** passes the adapted `categories` (`AdaptedCategory[]`,
  possibly empty while loading) to `Header` and `Footer`.
- **`Header.tsx`:** takes a new prop, `categories: AdaptedCategory[]`.
  - **Desktop** (`hidden md:flex`, unchanged): `Home`, then one link per
    category, showing `category.title` and linking to
    `/category/<category.slug>`, in the order the API returns them. While
    `categories` is empty, only `Home` shows.
  - **Phone** (below `md`):
    - A button with `aria-label="Open menu"` and the `Menu` icon from
      `lucide-react`, placed left of the logo, class `md:hidden`.
    - It opens a `Sheet` with `side="left"`, `SheetTitle` "Menu", and the same
      links as a vertical list.
    - Tapping a link closes the sheet (controlled `open` state) and navigates.
  - The cart button is unchanged.
- **`Footer.tsx`:** takes `categories: AdaptedCategory[]`. The "Categories"
  column renders from it instead of the 5 hardcoded links; it's empty while
  loading. Quick Links are unchanged (out of scope).
- **Labels:** labels become the full API names ("Customized Gifting",
  "Festive Decoration"), replacing the shortened ones. The user approved this
  in brainstorming.

---

## 5. React 18 ref forwarding

- **Convert these components to the React 18 `React.forwardRef` style**, the
  one the shadcn/ui React 18 templates use. That covers every exported
  sub-component that renders a DOM element or a Radix primitive:
  - The 16 `ui/` modules the app imports: `button`, `input`, `label`,
    `badge`, `table`, `dialog`, `card`, `separator`, `select`, `textarea`,
    `switch`, `skeleton`, `sheet`, `radio-group`, `alert-dialog`, `sonner`
    (`sonner` only if it renders an element that can receive a ref).
  - Any `ui/` module those 16 import from each other (for example, `sheet`
    and `dialog` use `button`).
- **For each component:**
  - forward the ref to the rendered element or primitive
  - keep the `displayName`
  - keep props, `data-slot` attributes, `className` merging and variants
    exactly as they are
- **No behaviour changes**, and the other 32 unused `ui/` files are not
  touched.
- **Guard:** `src/test/setup.ts` wraps `console.error`. Any message containing
  `cannot be given refs` throws, which fails the test that caused it. Other
  `console.error` output behaves as before.

---

## 6. Testing

### Unit tests (Vitest, frontend)

- **`images.test.ts`:**
  - an Unsplash URL without parameters
  - an Unsplash URL that already has `w`/`q`/other parameters (`w` and `q` are
    overwritten, the others kept)
  - a non-Unsplash absolute URL, a relative path, and an empty string, all
    returned unchanged
  - `imageSrcSet` for Unsplash URLs (1× and 2×) and non-Unsplash URLs
    (`undefined`)
- **`shipping.test.ts`:** an empty cart; a subtotal below, exactly at, and
  above the threshold.
- **`Cart` tests:**
  - with settings `{50, 999}`: a ₹500 cart shows ₹50 shipping and a ₹550 total
  - a ₹1598 cart shows `Free` and a ₹1598 total
  - with `shippingSettings={null}`: shows `Calculated at checkout`, and the
    total equals the subtotal
- **`Header` tests:**
  - the desktop links come from `categories` (title and slug)
  - only Home shows when `categories` is empty
  - the `Open menu` button opens a dialog named "Menu" containing the category
    links
  - clicking a link closes it
- **`Footer` test:** the Categories column comes from `categories`.
- **`Hero` test:** the buttons link to `#featured` / `#categories`.
- **Component image tests:** `ProductCard` and `CategoryCard` render a `src`
  containing `w=600`, and the `ImageGallery` thumbnails contain `w=200`, for
  Unsplash fixtures.
- **Ref guard:** the full existing suite passes with the guard in place. That
  is the proof the conversion is complete.

### Backend (Vitest + supertest)

- `GET /api/settings/shipping` returns the stored values, or the defaults
  `{50, 999}` when no `StoreSettings` row exists. The response has exactly
  the two keys.
- The existing order tests still pass, with the order route now using
  `getShippingConfig`.

### Browser tests (Playwright, added to `e2e/`)

- **Image weight:** loading `/` and one product page:
  - every request to `images.unsplash.com` has a `w=` parameter
  - total image bytes on `/` after `networkidle` are **under 5 MB**
- **Phone menu:** at a 390×844 viewport, `Open menu` opens the drawer.
  Clicking the first category from `GET /api/categories` navigates to
  `/category/<slug>` and shows its `h1`.
- **Free shipping:** add products until the subtotal is at least the
  `freeShippingThreshold` from `GET /api/settings/shipping`. The cart then
  shows `Free`, and Total equals Subtotal.
- **No ref warnings:** on the pages above, and on the admin categories page
  with the delete dialog opened, no console message contains
  `cannot be given refs`.

---

## Definition of done

- Frontend `npm test`, backend `cd server && npm test` (plus
  `npx tsc --noEmit`) and `npm run e2e` all pass, and `npm run build` is
  clean.
- Re-running the UI walkthrough shows every item in "Purpose" fixed:
  - the home page loads under 5 MB of images
  - the cart's total matches the server's rule
  - "View Collections" is readable, and both hero buttons scroll to their
    section
  - the phone header has a working menu
  - no ref warnings appear in the console
