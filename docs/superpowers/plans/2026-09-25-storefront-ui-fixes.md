# Storefront UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the problems found in the 2026-09-24 UI test round:
- 34 MB of full-size images
- the cart's hardcoded ₹50 shipping
- dead and unreadable hero buttons
- no navigation on phones, and hardcoded category links
- React ref warnings

**Architecture:**
- **Shared UI components:** the ones the app uses get React 18 `forwardRef`, and a test-setup guard fails on any ref warning.
- **Images:** resized when rendering, using Unsplash URL parameters.
- **Shipping:** a public `GET /api/settings/shipping` feeds a `calculateShipping()` rule in the cart that mirrors the server's rule.
- **Navigation:** the header (plus a new phone drawer) and the footer render categories from the API.

**Tech Stack:**
- **Frontend:** React 18.3.1, Vite 6, Radix UI (shadcn components), Tailwind 4, Vitest + Testing Library + MSW 2.
- **Backend:** Express 4, Prisma 5, Vitest + supertest.
- **Browser tests:** Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-09-25-storefront-ui-fixes-design.md`

## Global Constraints

- **Worktree and git:**
  - Work only in `C:\Users\rj816\Downloads\Ecommerce Website for Decor (3)\.claude\worktrees\storefront-data-wiring`, branch `worktree-storefront-data-wiring`.
  - Never push, and never touch the main checkout.
  - Every commit message ends with a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never stage `server/prisma/migrations/migration_lock.toml` (it has a line-ending-only diff), `test-results/` or `playwright-report/`.
- **Database:** Postgres runs in Docker on port **5433**: dev `ecommerce_dev`, tests `ecommerce_test`, e2e `ecommerce_e2e`.
- **Test suites before this plan:** frontend `npm test` **154**, backend `cd server && npm test` **139**, e2e `npm run e2e` **6**. No task may leave a suite red.
- **Image sizing:**
  - Only for `images.unsplash.com` URLs. They get `w=<width>`, `q=75`, `auto=format`, `fit=crop`; other existing parameters are kept.
  - Every other URL is returned unchanged.
  - Widths: ProductCard **600**, CategoryCard **600**, gallery main **1200**, gallery thumbnails **200**, cart line **160**, flyToCart **160**.
- **Shipping rule (same as server `computeOrderTotals`):** subtotal ≤ 0 → 0; subtotal ≥ `freeShippingThreshold` → 0; otherwise `flatShippingFee`. Server defaults when no settings row exists: `{ flatShippingFee: 50, freeShippingThreshold: 999 }`.
- **Exact UI strings:**
  - Shipping row: `Free` / `₹<n>` / `Calculated at checkout`
  - Phone menu: button `aria-label="Open menu"`, drawer title `Menu`
  - Hero link targets: `#featured` ("Shop Now"), `#categories` ("View Collections")
- **Out of scope:**
  - duplicate product photos (the owner will add real photos via the admin)
  - a free-shipping hint
  - upgrading to React 19
  - the 32 unused `ui/` components
  - the footer's Quick Links
  - checkout wiring

### Deviations from spec wording (controller rulings)

- **Spec §5 lists 16 `ui/` modules.** Only **13** need converting:
  - `dialog.tsx` and `radio-group.tsx` already use `React.forwardRef`.
  - `sonner.tsx`'s `Toaster` wraps the `sonner` library component and never receives a ref.
- **Spec §6 (e2e) includes the admin categories delete dialog.** The browser test for ref warnings covers **storefront pages only**:
  - `e2e/admin.spec.ts` changes the seeded admin password earlier in the same run, so a later test can't reliably log in.
  - The admin `AlertDialog` path is still covered: `src/app/admin/pages/CategoriesPage.test.tsx` already opens the delete dialog, and Task 1's guard fails that test on any ref warning.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `src/test/setup.ts` | 1 | Fails any test that logs a "cannot be given refs" warning |
| `src/app/components/ui/{button,input,label,badge,table,card,separator,select,textarea,switch,skeleton,sheet,alert-dialog}.tsx` | 1 | React 18 `forwardRef` |
| `src/app/components/ui/refs.test.tsx` (new) | 1 | Refs reach the DOM for the non-portal components |
| `src/app/lib/images.ts` (+ `.test.ts`, new) | 2 | `optimizedImageUrl`, `imageSrcSet` |
| `ProductCard.tsx`, `CategoryCard.tsx`, `ImageGallery.tsx`, `Cart.tsx`, `pages/ProductDetailPage.tsx` | 2 | Use sized image URLs |
| `server/src/services/shippingConfig.ts` (new) | 3 | `getShippingConfig(db)` |
| `server/src/routes/settings.routes.ts` (new), `server/src/app.ts`, `server/src/routes/orders.routes.ts` | 3 | Public `GET /api/settings/shipping`; order route uses the shared config |
| `server/tests/settings.test.ts` (new) | 3 | Route tests |
| `src/app/lib/api.ts`, `src/app/lib/shipping.ts` (+ test, new) | 4 | `getShippingSettings()`, `calculateShipping()` |
| `src/app/App.tsx`, `src/app/components/Cart.tsx` (+ test), `src/test/server.ts` | 4 | Cart uses the settings |
| `src/app/components/Hero.tsx`, `Hero.test.tsx` (new), `src/app/pages/HomePage.tsx` | 5 | Readable, working hero buttons; section anchors |
| `src/app/components/Header.tsx` (+ test), `Footer.tsx`, `Footer.test.tsx` (new), `src/app/App.tsx` | 6 | Nav from categories; phone drawer |
| `e2e/ui-fixes.spec.ts` (new) | 7 | Browser checks for all of the above |

---

### Task 1: React 18 ref forwarding for the UI components in use

**Files:**
- Modify: `src/test/setup.ts` (append the guard)
- Modify (convert): `src/app/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `table.tsx`, `card.tsx`, `separator.tsx`, `select.tsx`, `textarea.tsx`, `switch.tsx`, `skeleton.tsx`, `sheet.tsx`, `alert-dialog.tsx`
- Create: `src/app/components/ui/refs.test.tsx`

**Interfaces:**
- **Consumes:** nothing.
- **Produces:**
  - Every export listed in the conversion table below accepts a `ref`, which reaches the DOM element or Radix primitive.
  - Export names, props, `data-slot` attributes and class names are unchanged.
  - Later tasks rely on `Button asChild` (Task 5) and on `SheetTrigger`/`SheetClose asChild` wrapping `Button` (Task 6).

- [ ] **Step 1: Add the ref-warning guard (the suite goes red)**

Append to `src/test/setup.ts`:

```ts
// React 18 drops refs passed to plain function components. Radix (asChild, Slot,
// Presence) relies on them, so treat React's warning as a test failure.
const refWarnings: string[] = [];
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const message = args.map((a) => String(a)).join(' ');
  if (message.includes('cannot be given refs')) {
    refWarnings.push(message.slice(0, 300));
  }
  originalConsoleError(...args);
};
afterEach(() => {
  if (refWarnings.length > 0) {
    const found = refWarnings.splice(0);
    throw new Error(`React ref warning(s) — a component needs React.forwardRef:\n${found.join('\n')}`);
  }
});
```

(`afterEach` is already imported from `vitest` at the top of this file. If it isn't, add it to that import.)

Run: `npm test`
Expected: FAIL. At least the `Cart` tests (they open the `Sheet`) and `CategoriesPage` (it opens the `AlertDialog`) fail with "React ref warning(s)". Record which files fail.

- [ ] **Step 2: Write the ref test for the non-portal components**

Create `src/app/components/ui/refs.test.tsx`:

```tsx
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Badge } from './badge';
import { Textarea } from './textarea';
import { Skeleton } from './skeleton';
import { Separator } from './separator';
import { Switch } from './switch';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Table, TableBody, TableCell, TableRow } from './table';

describe('ui components forward refs (React 18)', () => {
  it.each([
    ['Button', (ref: React.RefObject<HTMLElement>) => <Button ref={ref as React.RefObject<HTMLButtonElement>}>x</Button>, 'BUTTON'],
    ['Input', (ref: React.RefObject<HTMLElement>) => <Input ref={ref as React.RefObject<HTMLInputElement>} />, 'INPUT'],
    ['Label', (ref: React.RefObject<HTMLElement>) => <Label ref={ref as React.RefObject<HTMLLabelElement>}>x</Label>, 'LABEL'],
    ['Badge', (ref: React.RefObject<HTMLElement>) => <Badge ref={ref as React.RefObject<HTMLSpanElement>}>x</Badge>, 'SPAN'],
    ['Textarea', (ref: React.RefObject<HTMLElement>) => <Textarea ref={ref as React.RefObject<HTMLTextAreaElement>} />, 'TEXTAREA'],
    ['Skeleton', (ref: React.RefObject<HTMLElement>) => <Skeleton ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['Separator', (ref: React.RefObject<HTMLElement>) => <Separator ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['Switch', (ref: React.RefObject<HTMLElement>) => <Switch ref={ref as React.RefObject<HTMLButtonElement>} />, 'BUTTON'],
    ['Card', (ref: React.RefObject<HTMLElement>) => <Card ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['CardHeader', (ref: React.RefObject<HTMLElement>) => <CardHeader ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['CardTitle', (ref: React.RefObject<HTMLElement>) => <CardTitle ref={ref as React.RefObject<HTMLDivElement>}>t</CardTitle>, undefined],
    ['CardContent', (ref: React.RefObject<HTMLElement>) => <CardContent ref={ref as React.RefObject<HTMLDivElement>} />, 'DIV'],
    ['Table', (ref: React.RefObject<HTMLElement>) => <Table ref={ref as React.RefObject<HTMLTableElement>} />, 'TABLE'],
    ['TableRow/Cell', (ref: React.RefObject<HTMLElement>) => (
      <table><TableBody><TableRow><TableCell ref={ref as React.RefObject<HTMLTableCellElement>}>c</TableCell></TableRow></TableBody></table>
    ), 'TD'],
  ])('%s', (_name, renderWithRef, expectedTag) => {
    const ref = createRef<HTMLElement>();
    render(renderWithRef(ref));
    expect(ref.current).not.toBeNull();
    if (expectedTag) expect(ref.current!.tagName).toBe(expectedTag);
  });
});
```

(`CardTitle`'s tag depends on the current implementation, so only a non-null ref is asserted.)

Run: `npx vitest run src/app/components/ui/refs.test.tsx`
Expected: FAIL. Every component that isn't converted yet leaves `ref.current` as `null` (and trips the guard).

- [ ] **Step 3: Convert `button.tsx` (worked example)**

Replace the `Button` function in `src/app/components/ui/button.tsx` with the following. Everything else in the file stays, including `buttonVariants` and the export line.

```tsx
type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
```

- [ ] **Step 4: Convert `sheet.tsx` (worked example with Radix primitives)**

In `src/app/components/ui/sheet.tsx`, leave `Sheet` (Root) and `SheetPortal` (Portal) as plain functions: they render no element of their own and never receive refs. Replace every other function as follows. The class strings are copied unchanged from the current file.

```tsx
const SheetTrigger = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Trigger>
>((props, ref) => <SheetPrimitive.Trigger ref={ref} data-slot="sheet-trigger" {...props} />);
SheetTrigger.displayName = "SheetTrigger";

const SheetClose = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Close>
>((props, ref) => <SheetPrimitive.Close ref={ref} data-slot="sheet-close" {...props} />);
SheetClose.displayName = "SheetClose";

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    data-slot="sheet-overlay"
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    side?: "top" | "right" | "bottom" | "left";
  }
>(({ className, children, side = "right", ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      data-slot="sheet-content"
      className={cn(
        "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        side === "right" &&
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
        side === "left" &&
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        side === "top" &&
          "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
        side === "bottom" &&
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
        <XIcon className="size-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

const SheetHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />
  ),
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
  ),
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    data-slot="sheet-title"
    className={cn("text-foreground font-semibold", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    data-slot="sheet-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";
```

The export block is unchanged.

- [ ] **Step 5: Convert the remaining 11 modules with the same recipe**

The recipe, for each function listed below:
- `function X({ className, ...props }: React.ComponentProps<typeof P.Y>) { return <P.Y … {...props} /> }` becomes
  `const X = React.forwardRef<React.ElementRef<typeof P.Y>, React.ComponentPropsWithoutRef<typeof P.Y>>(({ className, ...props }, ref) => <P.Y ref={ref} … {...props} />); X.displayName = "X";`
- A function over a DOM element (`React.ComponentProps<"div">`, and so on) becomes
  `React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>` with `ref` on that element. Use the matching element type:
  - `HTMLInputElement`, `HTMLTextAreaElement`, `HTMLLabelElement`, `HTMLSpanElement`
  - `HTMLTableElement`, `HTMLTableSectionElement`, `HTMLTableRowElement`, `HTMLTableCellElement`, `HTMLTableCaptionElement`
- Extra props (`variant`, `size`, `asChild`, `inset`, `position`, and so on) and their defaults are kept exactly as they are.
- `data-slot` values, `cn(...)` class strings, children and export blocks don't change.
- If a function renders a wrapper `<div>` around a primitive (for example `Table` wraps `<table>` in a container `div`), put the ref on the element the function is named after (the `<table>`).

| Module | Convert | Leave as plain function (no element, no ref) |
|---|---|---|
| `input.tsx` | `Input` | |
| `label.tsx` | `Label` | |
| `badge.tsx` | `Badge` (keep `asChild` / `Slot` handling, as in `Button`) | |
| `textarea.tsx` | `Textarea` | |
| `skeleton.tsx` | `Skeleton` | |
| `separator.tsx` | `Separator` | |
| `switch.tsx` | `Switch` | |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | |
| `table.tsx` | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` | |
| `select.tsx` | `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` | `Select` (Root) |
| `alert-dialog.tsx` | `AlertDialogTrigger`, `AlertDialogOverlay`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel` | `AlertDialog` (Root), `AlertDialogPortal` (Portal) |

Don't touch `dialog.tsx`, `radio-group.tsx` or `sonner.tsx`, or any other `ui/` file.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/ui/refs.test.tsx`
Expected: 14 passed.

Run: `npm test`
Expected: all pass. That's 154 existing plus 14 new = **168**, with no "React ref warning" failures.

Run: `npm run build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/test/setup.ts src/app/components/ui/button.tsx src/app/components/ui/input.tsx src/app/components/ui/label.tsx src/app/components/ui/badge.tsx src/app/components/ui/table.tsx src/app/components/ui/card.tsx src/app/components/ui/separator.tsx src/app/components/ui/select.tsx src/app/components/ui/textarea.tsx src/app/components/ui/switch.tsx src/app/components/ui/skeleton.tsx src/app/components/ui/sheet.tsx src/app/components/ui/alert-dialog.tsx src/app/components/ui/refs.test.tsx
git commit -m "fix(ui): forward refs in the shared UI components for React 18

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Resize images when rendering

**Files:**
- Create: `src/app/lib/images.ts`, `src/app/lib/images.test.ts`
- Modify: `src/app/components/ProductCard.tsx` (image and `flyToCart` call), `src/app/components/CategoryCard.tsx` (`<img>`), `src/app/components/ImageGallery.tsx` (main `motion.img` and thumbnail `ShimmerImage`), `src/app/components/Cart.tsx` (line `<img>`), `src/app/pages/ProductDetailPage.tsx` (`flyToCart` call)
- Test: add cases to `src/app/components/ProductCard.test.tsx` and `ImageGallery.test.tsx`; create `src/app/components/CategoryCard.test.tsx`

**Interfaces:**
- **Consumes:** nothing.
- **Produces:**
  - `optimizedImageUrl(url: string, width: number): string`
  - `imageSrcSet(url: string, width: number): string | undefined`
  - Both come from `src/app/lib/images.ts`.

- [ ] **Step 1: Write the failing helper tests**

Create `src/app/lib/images.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { imageSrcSet, optimizedImageUrl } from './images';

const RAW = 'https://images.unsplash.com/photo-123';

describe('optimizedImageUrl', () => {
  it('adds sizing params to a bare Unsplash URL', () => {
    const url = new URL(optimizedImageUrl(RAW, 600));
    expect(url.origin + url.pathname).toBe(RAW);
    expect(url.searchParams.get('w')).toBe('600');
    expect(url.searchParams.get('q')).toBe('75');
    expect(url.searchParams.get('auto')).toBe('format');
    expect(url.searchParams.get('fit')).toBe('crop');
  });

  it('overrides w and q but keeps other existing params', () => {
    const url = new URL(optimizedImageUrl(`${RAW}?w=1080&q=80&ixid=abc`, 200));
    expect(url.searchParams.get('w')).toBe('200');
    expect(url.searchParams.get('q')).toBe('75');
    expect(url.searchParams.get('ixid')).toBe('abc');
  });

  it.each([
    'https://img.test/diya.jpg',
    '/assets/logo.png',
    'data:image/png;base64,AAAA',
    '',
  ])('returns %j unchanged', (input) => {
    expect(optimizedImageUrl(input, 600)).toBe(input);
  });
});

describe('imageSrcSet', () => {
  it('gives 1x and 2x candidates for Unsplash URLs', () => {
    expect(imageSrcSet(RAW, 600)).toBe(`${optimizedImageUrl(RAW, 600)} 1x, ${optimizedImageUrl(RAW, 1200)} 2x`);
  });

  it('is undefined for other URLs', () => {
    expect(imageSrcSet('https://img.test/diya.jpg', 600)).toBeUndefined();
  });
});
```

Run: `npx vitest run src/app/lib/images.test.ts`
Expected: FAIL, because `./images` doesn't exist yet.

- [ ] **Step 2: Implement the helper**

Create `src/app/lib/images.ts`:

```ts
const UNSPLASH_HOST = 'images.unsplash.com';

function parseUnsplash(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname === UNSPLASH_HOST ? parsed : null;
  } catch {
    return null; // relative paths, data URIs, empty strings
  }
}

/**
 * Asks Unsplash for a resized, re-encoded image. Any other URL (self-hosted
 * product photos, relative paths) is returned unchanged.
 */
export function optimizedImageUrl(url: string, width: number): string {
  const parsed = parseUnsplash(url);
  if (!parsed) return url;
  parsed.searchParams.set('w', String(width));
  parsed.searchParams.set('q', '75');
  parsed.searchParams.set('auto', 'format');
  parsed.searchParams.set('fit', 'crop');
  return parsed.toString();
}

/** 1x/2x candidates for high-density screens; undefined when the URL can't be resized. */
export function imageSrcSet(url: string, width: number): string | undefined {
  if (!parseUnsplash(url)) return undefined;
  return `${optimizedImageUrl(url, width)} 1x, ${optimizedImageUrl(url, width * 2)} 2x`;
}
```

Run: `npx vitest run src/app/lib/images.test.ts`
Expected: all pass.

- [ ] **Step 3: Write the failing component tests**

Append to `src/app/components/ProductCard.test.tsx`, inside its top-level `describe`. Reuse that file's existing render helper; if it renders with a `product` prop, pass `makeProduct({ image: 'https://images.unsplash.com/photo-card' })`.

```tsx
  it('requests a 600px Unsplash image with a 2x candidate, lazily', () => {
    renderCard(makeProduct({ image: 'https://images.unsplash.com/photo-card' }));
    const img = screen.getByRole('img', { name: 'Brass Diya' });
    expect(img.getAttribute('src')).toContain('w=600');
    expect(img.getAttribute('srcset')).toContain('w=1200');
    expect(img).toHaveAttribute('loading', 'lazy');
  });
```

(If the existing helper has a different name than `renderCard`, use it. The image's alt text is the product name.)

Create `src/app/components/CategoryCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CategoryCard } from './CategoryCard';

describe('CategoryCard', () => {
  it('requests a 600px Unsplash image, lazily', () => {
    render(
      <MemoryRouter>
        <CategoryCard title="Diwali Decor" description="d" image="https://images.unsplash.com/photo-cat" icon="🪔" slug="diwali-decor" />
      </MemoryRouter>,
    );
    const img = screen.getByRole('img', { name: 'Diwali Decor' });
    expect(img.getAttribute('src')).toContain('w=600');
    expect(img).toHaveAttribute('loading', 'lazy');
  });
});
```

Append to `src/app/components/ImageGallery.test.tsx`, inside its top-level `describe`, following its existing render pattern (`ImageGallery` takes `images` and `alt`):

```tsx
  it('requests 1200px for the main image and 200px lazy thumbnails', () => {
    const images = ['https://images.unsplash.com/photo-a', 'https://images.unsplash.com/photo-b'];
    render(<ImageGallery images={images} alt="Diya" />);
    expect(screen.getByRole('img', { name: 'Diya' }).getAttribute('src')).toContain('w=1200');
    const thumb = screen.getByRole('img', { name: 'Diya thumbnail 2' });
    expect(thumb.getAttribute('src')).toContain('w=200');
    expect(thumb).toHaveAttribute('loading', 'lazy');
  });
```

Run: `npx vitest run src/app/components/ProductCard.test.tsx src/app/components/CategoryCard.test.tsx src/app/components/ImageGallery.test.tsx`
Expected: the 3 new tests FAIL (raw URLs, no `loading`). Existing tests pass, because their fixtures use `https://img.test/...` URLs, which the helper leaves unchanged.

- [ ] **Step 4: Use the helper in the components**

In `ProductCard.tsx`:
- add `import { imageSrcSet, optimizedImageUrl } from '../lib/images';`
- change the `ShimmerImage` to:

```tsx
        <ShimmerImage
          src={optimizedImageUrl(product.image, 600)}
          srcSet={imageSrcSet(product.image, 600)}
          loading="lazy"
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-500 ease-out motion-reduce:group-hover:scale-100"
        />
```

- and change the fly call to `flyToCart(addButtonRef.current, optimizedImageUrl(product.image, 160));`

In `CategoryCard.tsx`:
- add the same import
- change the `<img>` to:

```tsx
          <img
            src={optimizedImageUrl(image, 600)}
            srcSet={imageSrcSet(image, 600)}
            loading="lazy"
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
```

In `ImageGallery.tsx`:
- add the same import (path `../lib/images`)
- main image (`motion.img`):
  - `src={optimizedImageUrl(images[selectedIndex], 1200)}`
  - add `srcSet={imageSrcSet(images[selectedIndex], 1200)}`
- thumbnail:

```tsx
                <ShimmerImage
                  src={optimizedImageUrl(img, 200)}
                  srcSet={imageSrcSet(img, 200)}
                  loading="lazy"
                  alt={`${alt} thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
```

In `Cart.tsx`:
- add `import { imageSrcSet, optimizedImageUrl } from '../lib/images';`
- on the line-item `<img>`:
  - `src={optimizedImageUrl(item.image, 160)}`
  - add `srcSet={imageSrcSet(item.image, 160)}` and `loading="lazy"`
  - keep its `alt` and `className`

In `pages/ProductDetailPage.tsx`:
- add `import { optimizedImageUrl } from '../lib/images';`
- change the fly call to `flyToCart(addButtonRef.current, optimizedImageUrl(product.image, 160));`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/lib/images.test.ts src/app/components/ProductCard.test.tsx src/app/components/CategoryCard.test.tsx src/app/components/ImageGallery.test.tsx`
Expected: all pass.

Run: `npm test`
Expected: all pass. That's 168 + 8 helper tests (2 + 4 `it.each` cases for `optimizedImageUrl`, 2 for `imageSrcSet`) + 3 component tests = **179**.

Run: `npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/lib/images.ts src/app/lib/images.test.ts src/app/components/ProductCard.tsx src/app/components/ProductCard.test.tsx src/app/components/CategoryCard.tsx src/app/components/CategoryCard.test.tsx src/app/components/ImageGallery.tsx src/app/components/ImageGallery.test.tsx src/app/components/Cart.tsx src/app/pages/ProductDetailPage.tsx
git commit -m "perf(storefront): request resized Unsplash images instead of full-size originals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Backend: public shipping settings

**Files:**
- Create: `server/src/services/shippingConfig.ts`, `server/src/routes/settings.routes.ts`, `server/tests/settings.test.ts`
- Modify: `server/src/app.ts` (mount the router), `server/src/routes/orders.routes.ts:38-41` (use the shared config)

**Interfaces:**
- **Consumes:**
  - `ShippingConfig` from `server/src/services/pricing.ts`: `{ flatShippingFee: number; freeShippingThreshold: number }`
  - `prisma` from `server/src/db`
  - `asyncHandler`
  - test helper `resetDb()` from `server/tests/helpers.ts`
- **Produces:**
  - `DEFAULT_SHIPPING_CONFIG: ShippingConfig`
  - `getShippingConfig(db: Pick<PrismaClient, 'storeSettings'> | Prisma.TransactionClient): Promise<ShippingConfig>`
  - HTTP `GET /api/settings/shipping` → `200 { flatShippingFee, freeShippingThreshold }`, exactly those two keys

- [ ] **Step 1: Write the failing route tests**

Create `server/tests/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/db';
import { resetDb } from './helpers';

describe('GET /api/settings/shipping', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the defaults when no settings row exists', async () => {
    const res = await request(app).get('/api/settings/shipping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ flatShippingFee: 50, freeShippingThreshold: 999 });
  });

  it('returns only the two shipping values from the stored settings', async () => {
    await prisma.storeSettings.create({ data: { id: 1, flatShippingFee: 75, freeShippingThreshold: 1500 } });
    const res = await request(app).get('/api/settings/shipping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ flatShippingFee: 75, freeShippingThreshold: 1500 });
  });

  it('needs no admin session', async () => {
    const res = await request(app).get('/api/settings/shipping');
    expect(res.status).not.toBe(401);
  });
});
```

Run: `cd server && npx vitest run tests/settings.test.ts`
Expected: FAIL with 404s, because the route doesn't exist yet.

- [ ] **Step 2: Add the shared config service**

Create `server/src/services/shippingConfig.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ShippingConfig } from './pricing';

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = { flatShippingFee: 50, freeShippingThreshold: 999 };

/** Store shipping settings (row id 1), or the defaults when none have been saved. Works inside a transaction. */
export async function getShippingConfig(
  db: Pick<PrismaClient, 'storeSettings'> | Prisma.TransactionClient,
): Promise<ShippingConfig> {
  const settings = await db.storeSettings.findUnique({ where: { id: 1 } });
  if (!settings) return DEFAULT_SHIPPING_CONFIG;
  return { flatShippingFee: settings.flatShippingFee, freeShippingThreshold: settings.freeShippingThreshold };
}
```

- [ ] **Step 3: Add the route and mount it**

Create `server/src/routes/settings.routes.ts`:

```ts
import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { getShippingConfig } from '../services/shippingConfig';

export const settingsRouter = Router();

// Public and read-only: the storefront cart shows the same shipping the order route will charge.
settingsRouter.get('/shipping', asyncHandler(async (_req, res) => {
  res.json(await getShippingConfig(prisma));
}));
```

In `server/src/app.ts`:
- add `import { settingsRouter } from './routes/settings.routes';` next to the other route imports
- add `app.use('/api/settings', settingsRouter);` right after `app.use('/api/orders', ordersRouter);`

- [ ] **Step 4: Point the order route at the shared config**

In `server/src/routes/orders.routes.ts`:
- add `import { getShippingConfig } from '../services/shippingConfig';`
- replace

```ts
      const settings = (await tx.storeSettings.findUnique({ where: { id: 1 } })) ?? {
        flatShippingFee: 50,
        freeShippingThreshold: 999,
      };
```

with

```ts
      const settings = await getShippingConfig(tx);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && npx vitest run tests/settings.test.ts tests/orders.test.ts`
Expected: all pass.

Run: `cd server && npm test`
Expected: all pass (139 + 3 = **142**).

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/shippingConfig.ts server/src/routes/settings.routes.ts server/src/app.ts server/src/routes/orders.routes.ts server/tests/settings.test.ts
git commit -m "feat(server): public GET /api/settings/shipping sharing the order route's shipping config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The cart uses the store's shipping rule

**Files:**
- Modify: `src/app/lib/api.ts` (add type and function), `src/app/App.tsx` (load and pass settings), `src/app/components/Cart.tsx:42-60` and the two shipping rows, `src/app/components/Cart.test.tsx`, `src/test/server.ts` (default handler)
- Create: `src/app/lib/shipping.ts`, `src/app/lib/shipping.test.ts`

**Interfaces:**
- **Consumes:** HTTP `GET /api/settings/shipping` (Task 3), and `fetchJson` in `api.ts` (with its existing 10 s timeout).
- **Produces:**
  - `export interface ShippingSettings { flatShippingFee: number; freeShippingThreshold: number }` and `export function getShippingSettings(): Promise<ShippingSettings>` (both in `api.ts`)
  - `export function calculateShipping(subtotal: number, config: ShippingSettings): number` (in `shipping.ts`)
  - `Cart` has a new **required** prop, `shippingSettings: ShippingSettings | null`

- [ ] **Step 1: Write the failing rule tests**

Create `src/app/lib/shipping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateShipping } from './shipping';

const config = { flatShippingFee: 50, freeShippingThreshold: 999 };

describe('calculateShipping (mirrors the server rule)', () => {
  it.each([
    [0, 0],
    [500, 50],
    [998, 50],
    [999, 0],
    [1598, 0],
  ])('subtotal %i → shipping %i', (subtotal, expected) => {
    expect(calculateShipping(subtotal, config)).toBe(expected);
  });
});
```

Run: `npx vitest run src/app/lib/shipping.test.ts`
Expected: FAIL, because the module doesn't exist yet.

- [ ] **Step 2: Implement the rule and the API call**

Create `src/app/lib/shipping.ts`:

```ts
import type { ShippingSettings } from './api';

/** Same rule as the server's computeOrderTotals: free for an empty cart or at/above the threshold. */
export function calculateShipping(subtotal: number, config: ShippingSettings): number {
  if (subtotal <= 0) return 0;
  return subtotal >= config.freeShippingThreshold ? 0 : config.flatShippingFee;
}
```

Append to `src/app/lib/api.ts`:

```ts
export interface ShippingSettings {
  flatShippingFee: number;
  freeShippingThreshold: number;
}

export function getShippingSettings(): Promise<ShippingSettings> {
  return fetchJson<ShippingSettings>('/api/settings/shipping');
}
```

In `src/test/server.ts`, add to the `handlers` array, right after the `/api/categories` handler:

```ts
  http.get(`${API_URL}/api/settings/shipping`, () => HttpResponse.json({ flatShippingFee: 50, freeShippingThreshold: 999 })),
```

Run: `npx vitest run src/app/lib/shipping.test.ts`
Expected: all pass.

- [ ] **Step 3: Write the failing Cart tests**

In `src/app/components/Cart.test.tsx`:
- Add `import type { ShippingSettings } from '../lib/api';`.
- Add, after the fixtures:

```tsx
// A high threshold keeps the existing ₹50-shipping assertions meaningful.
const testShipping: ShippingSettings = { flatShippingFee: 50, freeShippingThreshold: 5000 };
```

- In `renderCart`'s `props` object, add `shippingSettings: testShipping,` before `...overrides`.
- In `Harness`, pass `shippingSettings={testShipping}` to `<Cart … />`.
- Append these tests inside the top-level `describe`:

```tsx
  it('shows free shipping at or above the store threshold', () => {
    renderCart([diya, poshak], { shippingSettings: { flatShippingFee: 50, freeShippingThreshold: 999 } }); // 1800
    const summary = screen.getByText('Subtotal').closest('div')!.parentElement!;
    expect(within(summary).getByText('Free')).toBeInTheDocument();
    expect(within(summary).getAllByText('₹1800')).toHaveLength(2); // subtotal and total
  });

  it('charges the flat fee below the store threshold', () => {
    renderCart([{ ...diya, quantity: 1 }], { shippingSettings: { flatShippingFee: 75, freeShippingThreshold: 999 } }); // 500
    expect(screen.getByText('₹75')).toBeInTheDocument();
    expect(screen.getByText('₹575')).toBeInTheDocument();
  });

  it('says "Calculated at checkout" and totals the subtotal when settings are unavailable', () => {
    renderCart([diya, poshak], { shippingSettings: null }); // 1800
    expect(screen.getByText('Calculated at checkout')).toBeInTheDocument();
    expect(screen.getAllByText('₹1800')).toHaveLength(2);
  });
```

(If `screen.getByText('Subtotal').closest('div')!.parentElement!` doesn't select the summary block in this markup, reuse the `summary` locator from the existing test "computes subtotal, ₹50 shipping and total".)

Run: `npx vitest run src/app/components/Cart.test.tsx`
Expected: the 3 new tests FAIL. The existing tests pass unchanged, because the high threshold keeps ₹50 shipping.

- [ ] **Step 4: Update Cart and App**

In `src/app/components/Cart.tsx`:
- add `import type { ShippingSettings } from '../lib/api';` and `import { calculateShipping } from '../lib/shipping';`
- add `shippingSettings: ShippingSettings | null;` to `CartProps`, and destructure `shippingSettings` in the function signature
- replace

```ts
  const shipping = subtotal > 0 ? 50 : 0;
  const total = subtotal + shipping;
```

with

```ts
  // null while the store's shipping settings are loading or unavailable.
  const shipping = shippingSettings ? calculateShipping(subtotal, shippingSettings) : null;
  const total = subtotal + (shipping ?? 0);
  const shippingLabel = shipping === null ? 'Calculated at checkout' : shipping === 0 ? 'Free' : `₹${shipping}`;
```

- replace both occurrences of ``{shipping === 0 ? 'Free' : `₹${shipping}`}`` (the drawer summary and the checkout review step) with `{shippingLabel}`

In `src/app/App.tsx`:
- add `getShippingSettings` to the `./lib/api` import
- next to the other `useApiData` calls, add

```ts
  // Not part of `loading`/`loadError`: the store stays usable without it.
  const shippingState = useApiData(getShippingSettings);
```

- pass `shippingSettings={shippingState.data}` to `<Cart … />`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/lib/shipping.test.ts src/app/components/Cart.test.tsx src/app/App.test.tsx`
Expected: all pass.

Run: `npm test`
Expected: all pass — 179 + 5 `calculateShipping` cases + 3 Cart tests = **187**.

Run: `npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/lib/api.ts src/app/lib/shipping.ts src/app/lib/shipping.test.ts src/app/components/Cart.tsx src/app/components/Cart.test.tsx src/app/App.tsx src/test/server.ts
git commit -m "fix(storefront): cart shipping follows the store's free-shipping threshold

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Hero buttons: readable, and they scroll to their section

**Files:**
- Modify: `src/app/components/Hero.tsx:22-29`, `src/app/pages/HomePage.tsx:27` and `:49`
- Create: `src/app/components/Hero.test.tsx`

**Interfaces:**
- **Consumes:** `Button` with a working `asChild` (Task 1).
- **Produces:** `#categories` and `#featured` anchors on the home page.

- [ ] **Step 1: Write the failing test**

Create `src/app/components/Hero.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';

describe('Hero', () => {
  it('links "Shop Now" to the featured products and "View Collections" to the categories', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: 'Shop Now' })).toHaveAttribute('href', '#featured');
    expect(screen.getByRole('link', { name: 'View Collections' })).toHaveAttribute('href', '#categories');
  });

  it('renders "View Collections" as a transparent button with white text', () => {
    render(<Hero />);
    const link = screen.getByRole('link', { name: 'View Collections' });
    expect(link.className).toContain('bg-transparent');
    expect(link.className).toContain('text-white');
  });
});
```

(If `Hero` is a default export, or takes props, adjust the import or render to match `Hero.tsx`.)

Run: `npx vitest run src/app/components/Hero.test.tsx`
Expected: FAIL, because there are no links yet (the buttons are plain `<button>`s).

- [ ] **Step 2: Implement**

In `src/app/components/Hero.tsx`, replace the two buttons with:

```tsx
            <Button asChild size="lg" className="bg-accent-gold text-accent-gold-foreground hover:bg-accent-gold/90">
              <a href="#featured">Shop Now</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-white text-white hover:bg-white/10 hover:text-white"
            >
              <a href="#categories">View Collections</a>
            </Button>
```

In `src/app/pages/HomePage.tsx`:
- the "Shop by Category" section (line 27) becomes `<section id="categories" className="container mx-auto px-4 py-16 scroll-mt-20">`
- the "Featured Products" section (line 49) becomes `<section id="featured" className="container mx-auto px-4 py-16 scroll-mt-20">`

- [ ] **Step 3: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/Hero.test.tsx src/app/pages/HomePage.test.tsx`
Expected: all pass.

Run: `npm test`
Expected: all pass — 187 + 2 = **189**.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/Hero.tsx src/app/components/Hero.test.tsx src/app/pages/HomePage.tsx
git commit -m "fix(storefront): hero buttons are readable and scroll to their sections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Navigation from real categories, plus a phone menu

**Files:**
- Modify: `src/app/components/Header.tsx`, `src/app/components/Header.test.tsx`, `src/app/components/Footer.tsx`, `src/app/App.tsx`
- Create: `src/app/components/Footer.test.tsx`

**Interfaces:**
- **Consumes:**
  - `AdaptedCategory` from `src/app/lib/adapters.ts`: `{ title, description, image, icon, slug }`
  - `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetClose` from `./ui/sheet` (with refs, from Task 1)
  - `Menu` icon from `lucide-react`
- **Produces:**
  - `Header` props: `{ cartItemsCount: number; onCartClick: () => void; categories: AdaptedCategory[] }`
  - `Footer` props: `{ categories: AdaptedCategory[] }`

- [ ] **Step 1: Write the failing tests**

In `src/app/components/Header.test.tsx`:
- Add, after the imports:

```tsx
import type { AdaptedCategory } from '../lib/adapters';

const categories: AdaptedCategory[] = [
  { title: 'Diwali Decor', description: '', image: '', icon: '', slug: 'diwali-decor' },
  { title: 'Customized Gifting', description: '', image: '', icon: '', slug: 'customized-gifting' },
];
```

- Change `renderHeader` so it takes an optional third parameter, `cats: AdaptedCategory[] = categories`, and renders `<Header cartItemsCount={count} onCartClick={onCartClick} categories={cats} />`.
- Replace the test 'links the brand to home and lists category links' with:

```tsx
  it('links the brand to home and lists the categories it is given', () => {
    renderHeader(0);
    expect(screen.getByRole('link', { name: /bansuri creations/i })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('link', { name: 'Diwali Decor' })[0]).toHaveAttribute('href', '/category/diwali-decor');
    expect(screen.getAllByRole('link', { name: 'Customized Gifting' })[0]).toHaveAttribute('href', '/category/customized-gifting');
    expect(screen.queryByRole('link', { name: 'Kanha Dresses' })).not.toBeInTheDocument();
  });

  it('shows only Home while categories are loading', () => {
    renderHeader(0, vi.fn(), []);
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Diwali Decor' })).not.toBeInTheDocument();
  });

  it('opens a phone menu with the category links and closes it after a tap', async () => {
    const user = userEvent.setup();
    renderHeader(0);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('dialog', { name: 'Menu' });
    const link = within(menu).getByRole('link', { name: 'Customized Gifting' });
    expect(link).toHaveAttribute('href', '/category/customized-gifting');
    await user.click(link);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument());
  });
```

- Extend the `@testing-library/react` import to `import { render, screen, waitFor, within } from '@testing-library/react';`.

Create `src/app/components/Footer.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

describe('Footer', () => {
  it('lists the categories it is given', () => {
    render(
      <MemoryRouter>
        <Footer categories={[{ title: 'Kanha Dresses', description: '', image: '', icon: '', slug: 'kanha-dresses' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Kanha Dresses' })).toHaveAttribute('href', '/category/kanha-dresses');
    expect(screen.queryByRole('link', { name: 'Wedding Packing' })).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/app/components/Header.test.tsx src/app/components/Footer.test.tsx`
Expected: FAIL. The links are hardcoded, there's no `Open menu` button, and "Wedding Packing" is always present.

- [ ] **Step 2: Implement Header**

Replace `src/app/components/Header.tsx` with:

```tsx
import { useState } from 'react';
import { Menu, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Link } from 'react-router-dom';
import logo from '../../assets/933b21dd0e7f43328405b2f83783e6907d3d0236.png';
import { CART_ICON_ATTR } from '../lib/flyToCart';
import type { AdaptedCategory } from '../lib/adapters';

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
  categories: AdaptedCategory[];
}

export function Header({ cartItemsCount, onCartClick, categories }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { to: '/', label: 'Home' },
    ...categories.map((c) => ({ to: `/category/${c.slug}`, label: c.title })),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Phone menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  {navLinks.map((link) => (
                    <SheetClose asChild key={link.to}>
                      <Link to={link.to} className="rounded-md px-2 py-2 text-base hover:bg-accent hover:text-primary transition-colors">
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img src={logo} alt="Bansuri Creations" className="h-12 w-12 object-contain" />
              <span className="text-xl">Bansuri Creations</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="text-sm hover:text-primary transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Cart Button */}
          <Button variant="outline" className="relative" onClick={onCartClick} {...{ [CART_ICON_ATTR]: true }}>
            <ShoppingCart className="h-5 w-5" />
            {cartItemsCount > 0 && (
              <motion.div
                key={cartItemsCount}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                className="absolute -top-2 -right-2"
              >
                <Badge className="h-5 w-5 flex items-center justify-center p-0 bg-primary">
                  {cartItemsCount}
                </Badge>
              </motion.div>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
```

(The cart button block is the existing one, unchanged. Before replacing the file, check lines 26–45 of the current `Header.tsx` for anything else inside `<nav>` besides the six links. If there is anything, keep it.)

- [ ] **Step 3: Implement Footer and wire up App**

In `src/app/components/Footer.tsx`:
- add `import type { AdaptedCategory } from '../lib/adapters';`
- change the signature to `export function Footer({ categories }: { categories: AdaptedCategory[] }) {`
- replace the 5 hardcoded `<li>` lines in the "Categories" `<ul>` with:

```tsx
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link to={`/category/${category.slug}`} className="hover:text-primary transition-colors">
                    {category.title}
                  </Link>
                </li>
              ))}
```

In `src/app/App.tsx`:
- pass `categories={categories}` to `<Header … />`
- change `<Footer />` to `<Footer categories={categories} />`

(`categories` is the existing `categoriesState.data?.map(adaptCategory) ?? []`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/components/Header.test.tsx src/app/components/Footer.test.tsx src/app/App.test.tsx`
Expected: all pass, with no ref warnings (the Task 1 guard is active).

Run: `npm test`
Expected: all pass — 189 − 1 replaced Header test + 3 Header tests + 1 Footer test = **192**.

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/Header.tsx src/app/components/Header.test.tsx src/app/components/Footer.tsx src/app/components/Footer.test.tsx src/app/App.tsx
git commit -m "feat(storefront): category nav from the API and a phone menu drawer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Browser tests for the UI fixes

**Files:**
- Create: `e2e/ui-fixes.spec.ts`

**Interfaces:**
- **Consumes:**
  - `API_ORIGIN` from `e2e/env.ts`
  - HTTP `/api/categories`, `/api/products` and `/api/settings/shipping` (Task 3)
  - UI strings from Tasks 4 and 6: `Open menu`, `Menu`, `Free`, `Subtotal`, `Total`, `Increase quantity`, `Add to Cart`
- **Produces:** 4 new e2e tests (6 → **10**).

- [ ] **Step 1: Write the spec**

Create `e2e/ui-fixes.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { API_ORIGIN } from './env';

interface ApiVariant { price: number | null }
interface ApiProduct { name: string; slug: string; basePrice: number; variants: ApiVariant[] }
interface ApiCategory { name: string; slug: string }

/** Collects every console message mentioning React's ref warning. */
function watchRefWarnings(page: Page): string[] {
  const found: string[] = [];
  page.on('console', (m) => {
    if (m.text().includes('cannot be given refs')) found.push(m.text().slice(0, 200));
  });
  return found;
}

test('images are resized and the home page stays under 5 MB of images', async ({ page, request }) => {
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  const unsizedUnsplash: string[] = [];
  let homeImageBytes = 0;
  page.on('request', (r) => {
    if (r.url().includes('images.unsplash.com') && !new URL(r.url()).searchParams.has('w')) unsizedUnsplash.push(r.url());
  });
  const countBytes = async (r: import('@playwright/test').Request) => {
    if (r.resourceType() === 'image') {
      try { homeImageBytes += (await r.sizes()).responseBodySize; } catch { /* aborted */ }
    }
  };
  page.on('requestfinished', countBytes);

  await page.goto('/');
  // Scroll through the page so lazy images below the fold load too.
  for (let y = 0; y < 6000; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);
  }
  await page.waitForLoadState('networkidle');
  page.off('requestfinished', countBytes);
  expect(homeImageBytes).toBeLessThan(5 * 1024 * 1024);

  await page.goto(`/product/${products[0].slug}`);
  await page.waitForLoadState('networkidle');
  expect(unsizedUnsplash).toEqual([]);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu drawer navigates to a category', async ({ page, request }) => {
    const refWarnings = watchRefWarnings(page);
    const categories = (await (await request.get(`${API_ORIGIN}/api/categories`)).json()) as ApiCategory[];
    const target = categories[0];

    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: target.name, exact: true }).click();

    await expect(page).toHaveURL(`/category/${target.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: target.name })).toBeVisible();
    await expect(menu).toBeHidden();
    expect(refWarnings).toEqual([]);
  });
});

test('the cart ships free at the store threshold and the total equals the subtotal', async ({ page, request }) => {
  const refWarnings = watchRefWarnings(page);
  const { freeShippingThreshold } = (await (await request.get(`${API_ORIGIN}/api/settings/shipping`)).json()) as {
    freeShippingThreshold: number;
  };
  const products = (await (await request.get(`${API_ORIGIN}/api/products`)).json()) as ApiProduct[];
  const product = products[0];
  const price = product.variants[0]?.price ?? product.basePrice;
  const quantity = Math.max(1, Math.ceil(freeShippingThreshold / price));

  await page.goto(`/product/${product.slug}`);
  await page.getByRole('button', { name: /add to cart/i }).first().click();
  const cart = page.getByRole('dialog', { name: /Shopping Cart/ });
  await expect(cart).toBeVisible();
  for (let i = 1; i < quantity; i++) {
    await cart.getByRole('button', { name: 'Increase quantity' }).first().click();
  }

  const subtotal = price * quantity;
  const subtotalRow = cart.locator('div').filter({ has: page.getByText('Subtotal', { exact: true }) }).last();
  const totalRow = cart.locator('div').filter({ has: page.getByText('Total', { exact: true }) }).last();
  await expect(subtotalRow.getByText(`₹${subtotal}`, { exact: true })).toBeVisible();
  await expect(cart.getByText('Free', { exact: true })).toBeVisible();
  await expect(totalRow.getByText(`₹${subtotal}`, { exact: true })).toBeVisible();
  expect(refWarnings).toEqual([]);
});

test('the hero buttons scroll to their sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'View Collections' }).click();
  await expect(page).toHaveURL(/#categories$/);
  await expect(page.getByRole('heading', { name: 'Shop by Category' })).toBeInViewport();
  await page.getByRole('link', { name: 'Shop Now' }).scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: 'Shop Now' }).click();
  await expect(page).toHaveURL(/#featured$/);
  await expect(page.getByRole('heading', { name: 'Featured Products' })).toBeInViewport();
});
```

- [ ] **Step 2: Run the e2e suite**

Make sure nothing is listening on port 4000 (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

Run: `npm run e2e`
Expected: **10 passed** (6 existing + 4 new).

If a new test fails, open its screenshot and trace in `test-results/`:
- If the UI is correct, fix the test's selector.
- If the UI is wrong, report it as DONE_WITH_CONCERNS with the screenshot path.
- Never loosen an assertion to hide a real defect. The 5 MB image limit is from the spec and must not be raised.

Memory note: this machine has little free RAM, and Docker must stay up. Close nothing of the user's. If the browser can't launch because of memory, report BLOCKED with the error.

- [ ] **Step 3: Full final check**

```bash
npm test
npm run build
cd server && npm test && npx tsc --noEmit && cd ..
npm run e2e
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add e2e/ui-fixes.spec.ts
git commit -m "test(e2e): browser checks for image sizing, phone menu, free shipping and hero links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Definition of done

- Frontend `npm test`, backend `cd server && npm test` (plus `npx tsc --noEmit`) and `npm run e2e` (**10**) all pass, and `npm run build` is clean.
- Spec §1 (image sizing) → Task 2
- Spec §2 (cart shipping): backend → Task 3, frontend → Task 4
- Spec §3 (hero) → Task 5
- Spec §4 (navigation and phone menu) → Task 6
- Spec §5 (refs) → Task 1
- Spec §6 (testing) → the tests inside Tasks 1–6, plus Task 7
