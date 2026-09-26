import { motion } from 'motion/react';
import { Hero } from '../components/Hero';
import { CategoryCard } from '../components/CategoryCard';
import { ProductCard } from '../components/ProductCard';
import { Reveal } from '../components/Reveal';
import { Product } from '../types';
import { AdaptedCategory } from '../lib/adapters';

function staggerDelay(index: number) {
  return Math.min(index, 8) * 0.05;
}

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
      <section id="categories" className="container mx-auto px-4 py-16 scroll-mt-20">
        <Reveal>
          <h2 className="text-3xl md:text-4xl text-center mb-12">
            Shop by Category
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {categories.map((category, index) => (
            <Reveal key={category.slug} delay={staggerDelay(index)}>
              <CategoryCard
                title={category.title}
                description={category.description}
                image={category.image}
                icon={category.icon}
                slug={category.slug}
              />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section id="featured" className="container mx-auto px-4 py-16 scroll-mt-20">
        <Reveal>
          <h2 className="text-3xl md:text-4xl text-center mb-12">
            Featured Products
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              className="h-full"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: staggerDelay(index), ease: 'easeOut' }}
            >
              <ProductCard
                product={product}
                onAddToCart={onAddToCart}
              />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}