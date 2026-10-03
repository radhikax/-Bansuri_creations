import Link from 'next/link';
import Image from 'next/image';
import { isOptimizableImage } from '../lib/images';
import { Card } from './ui/card';

const CARD_IMAGE_SIZES = '(min-width:1024px) 25vw, (min-width:768px) 50vw, 100vw';

interface CategoryCardProps {
  title: string;
  description: string;
  image: string;
  icon: string;
  slug: string;
}

export function CategoryCard({ title, description, image, icon, slug }: CategoryCardProps) {
  return (
    <Link href={`/category/${slug}`}>
      <Card className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
        <div className="relative h-64 overflow-hidden">
          <Image
            src={image}
            unoptimized={!isOptimizableImage(image)}
            alt={title}
            fill
            sizes={CARD_IMAGE_SIZES}
            className="object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-beige-50">
            <div className="text-3xl mb-2">{icon}</div>
            <h3 className="text-2xl mb-2">{title}</h3>
            <p className="text-sm text-beige-50/90">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
