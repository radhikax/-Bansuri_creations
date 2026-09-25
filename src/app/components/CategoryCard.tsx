import { Card } from './ui/card';
import { Link } from 'react-router-dom';
import { imageSrcSet, optimizedImageUrl } from '../lib/images';

interface CategoryCardProps {
  title: string;
  description: string;
  image: string;
  icon: string;
  slug: string;
}

export function CategoryCard({ title, description, image, icon, slug }: CategoryCardProps) {
  return (
    <Link to={`/category/${slug}`}>
      <Card className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
        <div className="relative h-64 overflow-hidden">
          <img
            src={optimizedImageUrl(image, 600)}
            srcSet={imageSrcSet(image, 600)}
            loading="lazy"
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div className="text-3xl mb-2">{icon}</div>
            <h3 className="text-2xl mb-2">{title}</h3>
            <p className="text-sm text-white/90">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
