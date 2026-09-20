import { useState, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Header } from './components/Header';
import { Cart, type CartItem } from './components/Cart';
import { Footer } from './components/Footer';
import { ProductCardSkeleton } from './components/ProductCardSkeleton';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { Product } from './types';
import { getCategories, getProducts } from './lib/api';
import { useApiData } from './lib/useApiData';
import { adaptCategory, adaptProduct } from './lib/adapters';

function AnimatedRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <Routes location={location}>{children}</Routes>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } }}
        exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.16, ease: 'easeIn' } }}
      >
        <Routes location={location}>{children}</Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const categoriesState = useApiData(getCategories);
  const productsState = useApiData(() => getProducts());

  const categories = categoriesState.data?.map(adaptCategory) ?? [];
  const products = productsState.data?.map(adaptProduct) ?? [];

  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const loading = categoriesState.loading || productsState.loading;
  const loadError = categoriesState.error ?? productsState.error;

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header
          cartItemsCount={totalItems}
          onCartClick={() => setIsCartOpen(true)}
        />

        <main className="flex-1">
          {loading ? (
            <div className="container mx-auto px-4 py-16">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="container mx-auto px-4 py-16 text-center">
              <p className="text-lg">Couldn't load products, please try again later.</p>
            </div>
          ) : (
            <AnimatedRoutes>
              <Route
                path="/"
                element={
                  <HomePage
                    products={products}
                    categories={categories}
                    onAddToCart={handleAddToCart}
                  />
                }
              />
              <Route
                path="/category/:category"
                element={
                  <CategoryPage
                    products={products}
                    categories={categories}
                    onAddToCart={handleAddToCart}
                  />
                }
              />
              <Route
                path="/product/:slug"
                element={
                  <ProductDetailPage
                    products={products}
                    onAddToCart={handleAddToCart}
                  />
                }
              />
            </AnimatedRoutes>
          )}
        </main>

        <Footer />

        <Cart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />
      </div>
    </Router>
  );
}
