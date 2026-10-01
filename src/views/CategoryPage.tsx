'use client';

import { motion } from 'motion/react';
import { ProductCard } from '../components/ProductCard';
import { Reveal } from '../components/Reveal';
import { Product } from '../types';
import { AdaptedCategory } from '../lib/adapters';

function staggerDelay(index: number) {
  return Math.min(index, 8) * 0.05;
}

interface CategoryPageProps {
  category: AdaptedCategory;
  products: Product[];
}

export function CategoryPage({ category, products }: CategoryPageProps) {
  return (
    <div className="min-h-screen py-16">
      <div className="container mx-auto px-4">
        <Reveal>
          <h1 className="text-4xl md:text-5xl mb-4">{category.title}</h1>
          <p className="text-muted-foreground mb-12">
            Browse our collection of {category.title.toLowerCase()}
          </p>
        </Reveal>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                className="h-full"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: staggerDelay(index), ease: 'easeOut' }}
              >
                <ProductCard product={product} />
              </motion.div>
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
