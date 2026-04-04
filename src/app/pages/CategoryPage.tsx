import { useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types';

interface CategoryPageProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export function CategoryPage({ products, onAddToCart }: CategoryPageProps) {
  const { category } = useParams<{ category: string }>();
  
  // Convert URL parameter to display name
  const categoryMap: Record<string, string> = {
    'wedding-packing': 'Wedding Packing',
    'festive-decoration': 'Festive Decoration',
    'diwali-decor': 'Diwali Decor',
    'kanha-dresses': 'Kanha Dresses',
    'customized-gifting': 'Customized Gifting',
  };

  const categoryName = category ? categoryMap[category] || '' : '';
  const filteredProducts = products.filter((p) => p.category === categoryName);

  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-5xl mb-4">{categoryName}</h1>
        <p className="text-muted-foreground mb-12">
          Browse our collection of {categoryName.toLowerCase()}
        </p>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No products found in this category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}