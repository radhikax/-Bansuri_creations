import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Cart, type CartItem } from './components/Cart';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { Product } from './types';

// Mock product data
const products: Product[] = [
  {
    id: 1,
    name: 'Indian Wedding Gift Boxes (Set of 10)',
    price: 799,
    originalPrice: 999,
    image: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwcGFja2FnaW5nJTIwd2VkZGluZ3xlbnwxfHx8fDE3NjgwMjE4NTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Wedding Packing',
    rating: 4.5,
    inStock: true,
  },
  {
    id: 2,
    name: 'Shaadi Favor Pouches (Set of 25)',
    price: 899,
    originalPrice: 1199,
    image: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwcGFja2FnaW5nJTIwd2VkZGluZ3xlbnwxfHx8fDE3NjgwMjE4NTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Wedding Packing',
    rating: 5,
    inStock: true,
  },
  {
    id: 3,
    name: 'Handmade Bandhanwar Door Hanging',
    price: 599,
    originalPrice: 799,
    image: 'https://images.unsplash.com/photo-1752578856345-b947695803bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0b3JhbiUyMGJhbmRoYW53YXIlMjBkb29yJTIwaGFuZ2luZ3xlbnwxfHx8fDE3NjgxMTE2MjZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Festive Decoration',
    rating: 4.5,
    inStock: true,
  },
  {
    id: 4,
    name: 'Traditional Wall Hanging Set',
    price: 899,
    originalPrice: 1199,
    image: 'https://images.unsplash.com/photo-1762173886363-de541417e48e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjB3YWxsJTIwaGFuZ2luZyUyMGRlY29yfGVufDF8fHx8MTc2ODExMDk3OXww&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Festive Decoration',
    rating: 5,
    inStock: true,
  },
  {
    id: 5,
    name: 'Diwali Special Diyas Set (12 pieces)',
    price: 499,
    originalPrice: 699,
    image: 'https://images.unsplash.com/photo-1510658018161-abde712032db?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWNvcmF0aXZlJTIwbGlnaHRzJTIwZmVzdGl2ZXxlbnwxfHx8fDE3NjgwMjE4NTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Diwali Decor',
    rating: 5,
    inStock: true,
  },
  {
    id: 6,
    name: 'Diwali Decorative Lights & Lanterns',
    price: 799,
    originalPrice: 999,
    image: 'https://images.unsplash.com/photo-1666244453401-43a8c15b5640?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXdhbGklMjBkZWNvcmF0aW9uJTIwbGlnaHRzfGVufDF8fHx8MTc2ODExMTYyN3ww&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Diwali Decor',
    rating: 4.5,
    inStock: true,
  },
  {
    id: 7,
    name: 'Diwali Rangoli Stencils & Colors Set',
    price: 399,
    originalPrice: 549,
    image: 'https://images.unsplash.com/photo-1635192592106-77a5aacbe1a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXdhbGklMjByYW5nb2xpJTIwZGVjb3JhdGl2ZXxlbnwxfHx8fDE3NjgxMTE2Mjd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Diwali Decor',
    rating: 4,
    inStock: true,
  },
  {
    id: 8,
    name: 'Kanha Ji Dress - Small Size',
    price: 599,
    originalPrice: 799,
    image: 'https://images.unsplash.com/photo-1653794354513-4b6d139408f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrcmlzaG5hJTIwZHJlc3MlMjB0cmFkaXRpb25hbHxlbnwxfHx8fDE3NjgwMjIzNDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Kanha Dresses',
    rating: 5,
    inStock: true,
  },
  {
    id: 9,
    name: 'Kanha Ji Dress - Medium Size',
    price: 799,
    originalPrice: 999,
    image: 'https://images.unsplash.com/photo-1767385576341-70b3861486a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjBnb2QlMjBpZG9sJTIwZGVjb3JhdGlvbnxlbnwxfHx8fDE3NjgwMjIzNDF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Kanha Dresses',
    rating: 5,
    inStock: true,
  },
  {
    id: 10,
    name: 'Birthday Gift Hamper with Personalization',
    price: 1299,
    originalPrice: 1599,
    image: 'https://images.unsplash.com/photo-1674620213535-9b2a2553ef40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b21pemVkJTIwZ2lmdCUyMGhhbXBlcnxlbnwxfHx8fDE3NjgwMjIzNDF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Customized Gifting',
    rating: 4.5,
    inStock: true,
  },
  {
    id: 11,
    name: 'Custom Name Gift Box',
    price: 899,
    image: 'https://images.unsplash.com/photo-1759887243702-903dc6661a90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb25hbGl6ZWQlMjBnaWZ0JTIwYm94fGVufDF8fHx8MTc2ODAwMzk3N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Customized Gifting',
    rating: 4,
    inStock: true,
  },
  {
    id: 12,
    name: 'Festive Toran (Door Decoration)',
    price: 449,
    originalPrice: 599,
    image: 'https://images.unsplash.com/photo-1752578856345-b947695803bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0b3JhbiUyMGJhbmRoYW53YXIlMjBkb29yJTIwaGFuZ2luZ3xlbnwxfHx8fDE3NjgxMTE2MjZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Festive Decoration',
    rating: 4.5,
    inStock: true,
  },
  {
    id: 13,
    name: 'Kanha Ji Dress - Large Size',
    price: 999,
    originalPrice: 1299,
    image: 'https://images.unsplash.com/photo-1653794354513-4b6d139408f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrcmlzaG5hJTIwZHJlc3MlMjB0cmFkaXRpb25hbHxlbnwxfHx8fDE3NjgwMjIzNDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Kanha Dresses',
    rating: 5,
    inStock: true,
  },
  {
    id: 14,
    name: 'Mehndi Ceremony Return Gifts (Set of 50)',
    price: 1499,
    originalPrice: 1999,
    image: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwcGFja2FnaW5nJTIwd2VkZGluZ3xlbnwxfHx8fDE3NjgwMjE4NTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Wedding Packing',
    rating: 4.5,
    inStock: false,
  },
  {
    id: 15,
    name: 'Anniversary Gift Set with Custom Message',
    price: 1599,
    image: 'https://images.unsplash.com/photo-1759887243702-903dc6661a90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb25hbGl6ZWQlMjBnaWZ0JTIwYm94fGVufDF8fHx8MTc2ODAwMzk3N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Customized Gifting',
    rating: 5,
    inStock: true,
  },
  {
    id: 16,
    name: 'Diwali Decor Combo Pack',
    price: 1199,
    originalPrice: 1599,
    image: 'https://images.unsplash.com/photo-1759397576098-c1f33b34088f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZXN0aXZhbCUyMGRlY29yYXRpb25zJTIwY29sb3JmdWx8ZW58MXx8fHwxNzY4MDIxODQ4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    category: 'Diwali Decor',
    rating: 5,
    inStock: true,
  },
];

const categories = [
  {
    title: 'Wedding Packing',
    description: 'Elegant packaging for Indian wedding favors and return gifts',
    image: 'https://images.unsplash.com/photo-1610377507996-dcd4f0cfc125?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaWZ0JTIwcGFja2FnaW5nJTIwd2VkZGluZ3xlbnwxfHx8fDE3NjgwMjE4NTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    icon: '🎁',
  },
  {
    title: 'Festive Decoration',
    description: 'Wall hangings, bandhanwar, and traditional festive decor',
    image: 'https://images.unsplash.com/photo-1762173886363-de541417e48e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjB3YWxsJTIwaGFuZ2luZyUyMGRlY29yfGVufDF8fHx8MTc2ODExMDk3OXww&ixlib=rb-4.1.0&q=80&w=1080',
    icon: '🪔',
  },
  {
    title: 'Diwali Decor',
    description: 'Special Diwali collection - diyas, lights, rangoli & more',
    image: 'https://images.unsplash.com/photo-1666244453401-43a8c15b5640?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXdhbGklMjBkZWNvcmF0aW9uJTIwbGlnaHRzfGVufDF8fHx8MTc2ODExMTYyN3ww&ixlib=rb-4.1.0&q=80&w=1080',
    icon: '✨',
  },
  {
    title: 'Kanha Dresses',
    description: 'Traditional dresses for Kanha Ji in all sizes',
    image: 'https://images.unsplash.com/photo-1653794354513-4b6d139408f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrcmlzaG5hJTIwZHJlc3MlMjB0cmFkaXRpb25hbHxlbnwxfHx8fDE3NjgwMjIzNDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    icon: '🪈',
  },
  {
    title: 'Customized Gifting',
    description: 'Personalized gifts for birthdays, anniversaries & all occasions',
    image: 'https://images.unsplash.com/photo-1674620213535-9b2a2553ef40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b21pemVkJTIwZ2lmdCUyMGhhbXBlcnxlbnwxfHx8fDE3NjgwMjIzNDF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    icon: '💝',
  },
];

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (productId: number) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
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
        />
      </div>
    </Router>
  );
}