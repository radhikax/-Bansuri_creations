import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProductDetailPage } from './ProductDetailPage';
import { CartProvider, useCart } from '../components/cart/CartProvider';
import { server } from '../test/server';
import { API_URL, makeApiCategory, makeApiProduct, makeApiVariant, makeProduct, sizeVariants } from '../test/fixtures';
import type { ApiProduct } from '../lib/api';
import type { Product } from '../types';

function CartProbe() {
  const { items } = useCart();
  return <div data-testid="cart-items">{JSON.stringify(items)}</div>;
}

// useLiveStock fetches GET /api/products/:slug on mount; mirror the rendered
// product's own data back so the "live" refresh is a no-op and assertions
// stay meaningful regardless of whether that fetch has resolved yet.
function apiProductFor(product: Product): ApiProduct {
  return makeApiProduct({
    slug: product.slug,
    name: product.name,
    basePrice: product.price,
    originalPrice: product.originalPrice ?? null,
    imageUrl: product.image,
    images: product.images,
    rating: product.rating,
    category: makeApiCategory({ name: product.category, slug: product.categorySlug }),
    variants: (product.variants ?? []).map((v) => makeApiVariant({ id: v.id, label: v.label, price: v.price, stock: v.stock })),
  });
}

function renderDetail(product: Product) {
  server.use(http.get(`${API_URL}/api/products/:slug`, () => HttpResponse.json(apiProductFor(product))));
  render(
    <CartProvider>
      <ProductDetailPage product={product} />
      <CartProbe />
    </CartProvider>,
  );
}

describe('ProductDetailPage', () => {
  it('renders product details', () => {
    renderDetail(makeProduct({ price: 500, originalPrice: 625 }));
    expect(screen.getByRole('heading', { level: 1, name: 'Brass Diya' })).toBeInTheDocument();
    expect(screen.getByText('Diwali Decor')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('₹625')).toBeInTheDocument();
    expect(screen.getByText('20% OFF')).toBeInTheDocument();
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });

  it('shows a thumbnail per image when there are several, and none for one', () => {
    renderDetail(makeProduct({ images: ['a.jpg', 'b.jpg', 'c.jpg'] }));
    expect(screen.getAllByAltText(/Brass Diya thumbnail/)).toHaveLength(3);
  });

  it('shows no thumbnails for a single image', () => {
    renderDetail(makeProduct());
    expect(screen.queryByAltText(/thumbnail/)).not.toBeInTheDocument();
  });

  it('adds to cart and shows confirmation', async () => {
    const user = userEvent.setup();
    renderDetail(makeProduct());
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(screen.getByTestId('cart-items')).toHaveTextContent('"id":"prod-1"');
    expect(await screen.findByText('Added!')).toBeInTheDocument();
  });

  it('shows out-of-stock and disables the button', () => {
    renderDetail(makeProduct({ inStock: false }));
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.queryByText('In stock')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeDisabled();
  });

  it('lets the shopper pick a variant, updating price and the cart item', async () => {
    const user = userEvent.setup();
    renderDetail(makeProduct({ variants: sizeVariants }));
    expect(screen.getByText('₹400')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'XL' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Large' }));
    expect(await screen.findByText('₹700')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    const cartText = screen.getByTestId('cart-items').textContent ?? '';
    expect(cartText).toContain('"id":"prod-1::v-l"');
    expect(cartText).toContain('"name":"Brass Diya (Large)"');
    expect(cartText).toContain('"price":700');
  });
});
