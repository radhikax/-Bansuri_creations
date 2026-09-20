import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingCart, Heart, Check } from 'lucide-react';
import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ShimmerImage } from './ShimmerImage';
import { Product } from '../types';
import { flyToCart } from '../lib/flyToCart';
import { useVariantSelection } from '../lib/useVariantSelection';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
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
  } = useVariantSelection(product);

  const addButtonRef = useRef<HTMLButtonElement>(null);
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
    onAddToCart(buildCartItem());

    setJustAdded(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <Card className="overflow-hidden group h-full flex flex-colhover:scale-[1.03] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-[transform,box-shadow] duration-200 ease-out motion-reduce:hover:scale-100 motion-reduce:transition-shadow">
      <Link to={`/product/${product.slug}`} className="relative h-64 shrink-0 overflow-hidden block">
        <ShimmerImage
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-500 ease-out motion-reduce:group-hover:scale-100"
        />
        {showDiscount && (
          <Badge className="absolute top-3 left-3 bg-accent-rose text-accent-rose-foreground border-none">
            {discount}% OFF
          </Badge>
        )}
        <Button
          size="icon"
          variant="secondary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Heart className="h-4 w-4" />
        </Button>
        {!inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary">Out of Stock</Badge>
          </div>
        )}
      </Link>

      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="text-sm text-muted-foreground mb-1">{product.category}</div>
        <Link to={`/product/${product.slug}`}>
          <h3 className="mb-2 line-clamp-2 min-h-[3rem] hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        <div
          className={`flex items-center gap-1.5 text-xs mb-2 h-4 ${inStock ? '' : 'invisible'}`}
          style={{ color: '#5c6b4f' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-sage" />
          In stock
        </div>
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="text-yellow-400">
              {i < Math.floor(product.rating) ? '★' : '☆'}
            </span>
          ))}
          <span className="text-sm text-muted-foreground ml-1">
            ({product.rating})
          </span>
        </div>

        <div className="flex flex-wrap content-start gap-2 mb-3 min-h-[1.75rem]">
          {hasMultipleVariants &&
            variants.map((variant, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  disabled={variant.stock <= 0}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed ${
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

        <div className="flex items-center gap-2 mt-auto">
          <AnimatePresence mode="wait">
            <motion.span
              key={price}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="text-xl inline-block"
            >
              ₹{price}
            </motion.span>
          </AnimatePresence>
          {showDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              ₹{product.originalPrice}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <div ref={addButtonRef} className="w-full">
          <Button
            className="w-full overflow-hidden"
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
      </CardFooter>
    </Card>
  );
}
