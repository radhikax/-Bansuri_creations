import { Button } from './ui/button';
import { Reveal } from './Reveal';

export function Hero() {
  return (
    <section className="relative w-full h-[500px] md:h-[600px] overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(124, 29, 49, 0.55), rgba(124, 29, 49, 0.55)), url('https://images.unsplash.com/photo-1759397576098-c1f33b34088f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZXN0aXZhbCUyMGRlY29yYXRpb25zJTIwY29sb3JmdWx8ZW58MXx8fHwxNzY4MDIxODQ4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`
        }}
      />
      
      <div className="relative container mx-auto px-4 h-full flex items-center">
        <Reveal className="max-w-2xl text-white">
          <h2 className="text-4xl md:text-6xl mb-4">
            Handcrafted Decor for Every Celebration
          </h2>
          <p className="text-lg md:text-xl mb-8 text-white/90">
            Discover unique, handmade items for Indian weddings, festivals, and special occasions. From wedding packing to Kanha dresses, birthday gifts to festive decorations - each piece crafted with love.
          </p>
          <div className="flex gap-4">
            <Button size="lg" className="bg-accent-gold text-accent-gold-foreground hover:bg-accent-gold/90">
              Shop Now
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              View Collections
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}