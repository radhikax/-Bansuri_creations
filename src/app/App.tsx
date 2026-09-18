import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Cart, type CartItem } from './components/Cart';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { Product } from './types';
import { getCategories, getProducts } from './lib/api';
import { useApiData } from './lib/useApiData';
import { adaptCategory, adaptProduct } from './lib/adapters';

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
                  <div key={i} className="h-80 rounded bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          ) : loadError ? (
            <div className="container mx-auto px-4 py-16 text-center">
              <p className="text-lg">Couldn't load products, please try again later.</p>
            </div>
          ) : (
            <Routes>
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
            </Routes>
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
