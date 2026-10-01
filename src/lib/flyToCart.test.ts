import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CART_ICON_ATTR, flyToCart } from './flyToCart';

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) => ({ matches: reduced, media: query })) as typeof window.matchMedia;
}

describe('flyToCart', () => {
  let animation: { onfinish: null | (() => void); oncancel: null | (() => void) };
  let animateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    animation = { onfinish: null, oncancel: null };
    animateSpy = vi.fn(() => animation);
    HTMLElement.prototype.animate = animateSpy as unknown as typeof HTMLElement.prototype.animate;
    mockMatchMedia(false);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountSourceAndTarget() {
    const source = document.createElement('div');
    const target = document.createElement('button');
    target.setAttribute(CART_ICON_ATTR, 'true');
    document.body.append(source, target);
    return source;
  }

  it('does nothing when the cart target is missing', () => {
    const source = document.createElement('div');
    document.body.append(source);
    flyToCart(source, 'x.jpg');
    expect(document.querySelector('img')).toBeNull();
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('does nothing under prefers-reduced-motion', () => {
    mockMatchMedia(true);
    flyToCart(mountSourceAndTarget(), 'x.jpg');
    expect(document.querySelector('img')).toBeNull();
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it('adds a ghost image and animates it', () => {
    flyToCart(mountSourceAndTarget(), 'x.jpg');
    const ghost = document.querySelector('img');
    expect(ghost).not.toBeNull();
    expect(ghost!.getAttribute('src')).toBe('x.jpg');
    expect(ghost!.style.position).toBe('fixed');
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  it('removes the ghost when the animation finishes', () => {
    flyToCart(mountSourceAndTarget(), 'x.jpg');
    animation.onfinish?.();
    expect(document.querySelector('img')).toBeNull();
  });

  it('removes the ghost when the animation is cancelled', () => {
    flyToCart(mountSourceAndTarget(), 'x.jpg');
    animation.oncancel?.();
    expect(document.querySelector('img')).toBeNull();
  });
});
