import { useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types';
import { AdaptedCategory } from '../lib/adapters';

interface CategoryPageProps {
  products: Product[];
  categories: AdaptedCategory[];
  onAddToCart: (product: Product) => void;
}

export function CategoryPage({ products, categories, onAddToCart }: CategoryPageProps) {
  const { category: categorySlug } = useParams<{ category: string }>();

  const matchedCategory = categories.find((c) => c.slug === categorySlug);
  const categoryName = matchedCategory?.title ?? '';
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
          <p className="text-center text-muted-foreground py-16">
            No products found in this category.
          </p>
        )}
      </div>
    </div>
  );
}
