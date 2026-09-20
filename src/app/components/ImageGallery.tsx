import { useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { ShimmerImage } from './ShimmerImage';

interface ImageGalleryProps {
  images: string[];
  alt: string;
}

const ZOOM_SCALE = 1.8;

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 20, mass: 0.3 });
  const springY = useSpring(y, { stiffness: 150, damping: 20, mass: 0.3 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(-relX * rect.width * 0.5);
    y.set(-relY * rect.height * 0.5);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    x.set(0);
    y.set(0);
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full aspect-square overflow-hidden rounded-lg bg-muted cursor-zoom-in"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div className="shimmer absolute inset-0" aria-hidden="true" />
        <AnimatePresence mode="wait">
          <motion.img
            key={selectedIndex}
            src={images[selectedIndex]}
            alt={alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: isHovering ? ZOOM_SCALE : 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.25, ease: 'easeInOut' },
              scale: { duration: 0.3, ease: 'easeOut' },
            }}
            style={{ x: springX, y: springY }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 mt-4">
          {images.map((img, index) => (
            <button
              key={img}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`w-16 h-16 rounded-md overflow-hidden border-2 transition-all duration-200 ease-out ${
                index === selectedIndex
                  ? 'border-primary scale-105'
                  : 'border-border opacity-70 hover:opacity-100'
              }`}
            >
              <span className="relative block w-full h-full">
                <ShimmerImage src={img} alt={`${alt} thumbnail ${index + 1}`} className="w-full h-full object-cover" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
