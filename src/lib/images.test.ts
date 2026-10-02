import { describe, expect, it } from 'vitest';
import { isOptimizableImage } from './images';

describe('isOptimizableImage', () => {
  it('optimizes https images from an allowed host', () => {
    expect(isOptimizableImage('https://images.unsplash.com/photo-1?w=400')).toBe(true);
  });

  it('serves images from any other host unoptimized', () => {
    expect(isOptimizableImage('https://res.cloudinary.com/demo/image/upload/diya.jpg')).toBe(false);
    expect(isOptimizableImage('http://images.unsplash.com/photo-1')).toBe(false);
  });

  it('treats relative paths and garbage as not optimizable instead of throwing', () => {
    expect(isOptimizableImage('/uploads/diya.jpg')).toBe(false);
    expect(isOptimizableImage('')).toBe(false);
  });
});
