import { Hero } from '../components/Hero';
import { CategoryCard } from '../components/CategoryCard';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types';
import { AdaptedCategory } from '../lib/adapters';

interface HomePageProps {
  products: Product[];
  categories: AdaptedCategory[];
  onAddToCart: (product: Product) => void;
}

export function HomePage({ products, categories, onAddToCart }: HomePageProps) {
  const featuredProducts = products.slice(0, 8);

  return (
    <div>
      <Hero />

      {/* Categories Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl text-center mb-12">
          Shop by Category
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {categories.map((category) => (
            <CategoryCard
              key={category.slug}
              title={category.title}
              description={category.description}
              image={category.image}
              icon={category.icon}
              slug={category.slug}
            />
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl text-center mb-12">
          Featured Products
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </section>
    </div>
  );
}