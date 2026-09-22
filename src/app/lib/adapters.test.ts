import { describe, expect, it } from 'vitest';
import { adaptCategory, adaptProduct } from './adapters';
import { makeApiCategory, makeApiProduct, makeApiVariant } from '../../test/fixtures';

describe('adaptCategory', () => {
  it('maps API fields to storefront fields', () => {
    expect(adaptCategory(makeApiCategory())).toEqual({
      title: 'Diwali Decor',
      description: 'Lights and lanterns',
      image: 'https://img.test/cat.jpg',
      icon: '🪔',
      slug: 'diwali-decor',
    });
  });
});

describe('adaptProduct', () => {
  it('uses the default variant price when set, and the category name', () => {
    const product = adaptProduct(
      makeApiProduct({ variants: [makeApiVariant({ price: 450, stock: 2 })] }),
    );
    expect(product.price).toBe(450);
    expect(product.category).toBe('Diwali Decor');
    expect(product.inStock).toBe(true);
  });

  it('falls back to basePrice when the variant has no price of its own', () => {
    const product = adaptProduct(makeApiProduct({ basePrice: 500 }));
    expect(product.price).toBe(500);
    expect(product.variants?.[0].price).toBe(500);
  });

  it('falls back to basePrice and out-of-stock when there are no variants', () => {
    const product = adaptProduct(makeApiProduct({ variants: [], basePrice: 300 }));
    expect(product.price).toBe(300);
    expect(product.inStock).toBe(false);
    expect(product.variants).toEqual([]);
  });

  it('marks out of stock when the default variant has zero stock', () => {
    const product = adaptProduct(makeApiProduct({ variants: [makeApiVariant({ stock: 0 })] }));
    expect(product.inStock).toBe(false);
  });

  it('turns a null originalPrice into undefined', () => {
    expect(adaptProduct(makeApiProduct({ originalPrice: null })).originalPrice).toBeUndefined();
    expect(adaptProduct(makeApiProduct({ originalPrice: 900 })).originalPrice).toBe(900);
  });

  it('uses the images array when present, otherwise wraps the main image', () => {
    const many = adaptProduct(makeApiProduct({ images: ['a.jpg', 'b.jpg'] }));
    expect(many.images).toEqual(['a.jpg', 'b.jpg']);

    const none = adaptProduct(makeApiProduct({ images: [], imageUrl: 'main.jpg' }));
    expect(none.images).toEqual(['main.jpg']);
    expect(none.image).toBe('main.jpg');
  });

  it('maps every variant, resolving null prices to basePrice', () => {
    const product = adaptProduct(
      makeApiProduct({
        basePrice: 500,
        variants: [
          makeApiVariant({ id: 'a', label: 'S', price: 400, stock: 1 }),
          makeApiVariant({ id: 'b', label: 'L', price: null, stock: 0 }),
        ],
      }),
    );
    expect(product.variants).toEqual([
      { id: 'a', label: 'S', price: 400, stock: 1 },
      { id: 'b', label: 'L', price: 500, stock: 0 },
    ]);
  });
});
