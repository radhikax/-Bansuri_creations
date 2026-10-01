import Image from 'next/image';
import { Button } from './ui/button';
import { Reveal } from './Reveal';

const HERO_IMAGE_URL =
  'https://images.unsplash.com/photo-1759397576098-c1f33b34088f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZXN0aXZhbCUyMGRlY29yYXRpb25zJTIwY29sb3JmdWx8ZW58MXx8fHwxNzY4MDIxODQ4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';

export function Hero() {
  return (
    <section className="relative w-full h-[500px] md:h-[600px] overflow-hidden">
      <Image src={HERO_IMAGE_URL} alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-maroon-900/55" />

      <div className="relative container mx-auto px-4 h-full flex items-center">
        <Reveal className="max-w-2xl text-beige-50">
          <h2 className="text-4xl md:text-6xl mb-4">
            Handcrafted Decor for Every Celebration
          </h2>
          <p className="text-lg md:text-xl mb-8 text-beige-50/90">
            Discover unique, handmade items for Indian weddings, festivals, and special occasions. From wedding packing to Kanha dresses, birthday gifts to festive decorations - each piece crafted with love.
          </p>
          <div className="flex gap-4">
            <Button asChild size="lg" className="bg-beige-50 text-maroon-900 hover:bg-beige-100">
              <a href="#featured">Shop Now</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-beige-50 text-beige-50 hover:bg-beige-50/10"
            >
              <a href="#categories">View Collections</a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
