import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Cart, type CartItem } from './components/Cart';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { Product, Category } from './types';
import { api, getCartId, type Order } from './lib/api';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cartId = getCartId();

  useEffect(() => {
    Promise.all([api.getProducts(), api.getCategories(), api.getCart(cartId)])
      .then(([productsData, categoriesData, cartData]) => {
        setProducts(productsData);
        setCategories(categoriesData);
        setCartItems(cartData.items);
      })
      .catch((err: Error) => {
        setLoadError(
          `Could not reach the API (${err.message}). Is the backend running? Start it with: cd backend && npm run dev`
        );
      });
  }, [cartId]);

  const handleAddToCart = async (product: Product) => {
    try {
      const cart = await api.addCartItem(cartId, product.id);
      setCartItems(cart.items);
      setIsCartOpen(true);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
  };

  const handleUpdateQuantity = async (productId: number, quantity: number) => {
    try {
      const cart = await api.updateCartItem(cartId, productId, quantity);
      setCartItems(cart.items);
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const handleRemoveItem = async (productId: number) => {
    try {
      const cart = await api.removeCartItem(cartId, productId);
      setCartItems(cart.items);
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const handlePlaceOrder = async (customer: {
    name: string;
    email: string;
    address: string;
    phone?: string;
  }): Promise<Order> => {
    const order = await api.createOrder({
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      customer,
    });
    await api.clearCart(cartId);
    setCartItems([]);
    return order;
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header 
          cartItemsCount={totalItems}
          onCartClick={() => setIsCartOpen(true)}
        />
        
        <main className="flex-1">
          {loadError && (
            <div className="container mx-auto px-4 pt-8">
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                {loadError}
              </div>
            </div>
          )}
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
                  onAddToCart={handleAddToCart} 
                />
              } 
            />
          </Routes>
        </main>

        <Footer />

        <Cart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onPlaceOrder={handlePlaceOrder}
        />
      </div>
    </Router>
  );
}
