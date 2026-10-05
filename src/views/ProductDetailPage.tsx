'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingCart, Check, ChevronLeft } from 'lucide-react';
import { ImageGallery } from '../components/ImageGallery';
import { Reveal } from '../components/Reveal';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Product } from '../types';
import { flyToCart } from '../lib/flyToCart';
import { useVariantSelection } from '../lib/useVariantSelection';
import { useLiveStock } from '../lib/useLiveStock';
import { useCart } from '../components/cart/CartProvider';

interface ProductDetailPageProps {
  product: Product;
}

export function ProductDetailPage({ product }: ProductDetailPageProps) {
  const { add } = useCart();
  const liveVariants = useLiveStock(product.slug, product.variants ?? []);
  const liveProduct: Product = { ...product, variants: liveVariants };

  const {
    variants,
    hasMultipleVariants,
    selectedIndex,
    setSelectedIndex,
    price,
    inStock,
    showDiscount,
    discount,
    buildCartItem,
  } = useVariantSelection(liveProduct);

  const addButtonRef = useRef<HTMLDivElement>(null);
  const [justAdded, setJustAdded] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleAddToCart = () => {
    if (addButtonRef.current) {
      flyToCart(addButtonRef.current, product.image);
    }
    add(buildCartItem());

    setJustAdded(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to shopping
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <Reveal>
            <ImageGallery images={product.images} alt={product.name} />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="text-sm text-muted-foreground mb-2">{product.category}</div>
            <h1 className="text-3xl md:text-4xl mb-3">{product.name}</h1>

            <div className="flex items-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i < Math.floor(product.rating) ? 'text-maroon-800' : 'text-maroon-200'}>
                  {i < Math.floor(product.rating) ? '★' : '☆'}
                </span>
              ))}
              <span className="text-sm text-muted-foreground ml-1">({product.rating})</span>
            </div>

            {hasMultipleVariants && (
              <div className="flex flex-wrap gap-2 mb-4">
                {variants.map((variant, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      disabled={variant.stock <= 0}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-primary text-primary scale-105 bg-primary/5'
                          : 'border-border text-muted-foreground scale-100 hover:border-primary/50'
                      }`}
                    >
                      {variant.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3 mb-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={price}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="text-3xl inline-block"
                >
                  ₹{price}
                </motion.span>
              </AnimatePresence>
              {showDiscount && (
                <span className="text-lg text-muted-foreground line-through">
                  ₹{product.originalPrice}
                </span>
              )}
              {showDiscount && (
                <Badge className="bg-maroon-200 text-maroon-900 border-none">
                  {discount}% OFF
                </Badge>
              )}
            </div>

            {inStock ? (
              <div className="flex items-center gap-1.5 text-sm mb-6 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                In stock
              </div>
            ) : (
              <div className="mb-6">
                <Badge variant="secondary">Out of Stock</Badge>
              </div>
            )}

            <div ref={addButtonRef} className="max-w-xs">
              <Button
                className="w-full overflow-hidden"
                size="lg"
                onClick={handleAddToCart}
                disabled={!inStock || justAdded}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {justAdded ? (
                    <motion.span
                      key="added"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex items-center"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Added!
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex items-center"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add to Cart
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
