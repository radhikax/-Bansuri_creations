export const CART_ICON_ATTR = 'data-cart-icon-target';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animates a small ghost copy of `imageSrc` flying from `sourceEl` toward
 * the element marked with data-cart-icon-target, shrinking and fading out.
 * No-ops if the target isn't found or the user prefers reduced motion.
 */
export function flyToCart(sourceEl: HTMLElement, imageSrc: string): void {
  const targetEl = document.querySelector<HTMLElement>(`[${CART_ICON_ATTR}]`);
  if (!targetEl || prefersReducedMotion()) return;

  const startRect = sourceEl.getBoundingClientRect();
  const endRect = targetEl.getBoundingClientRect();

  const size = 56;
  const ghost = document.createElement('img');
  ghost.src = imageSrc;
  ghost.style.position = 'fixed';
  ghost.style.left = `${startRect.left + startRect.width / 2 - size / 2}px`;
  ghost.style.top = `${startRect.top + startRect.height / 2 - size / 2}px`;
  ghost.style.width = `${size}px`;
  ghost.style.height = `${size}px`;
  ghost.style.borderRadius = '8px';
  ghost.style.objectFit = 'cover';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '9999';
  ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  document.body.appendChild(ghost);

  const deltaX = endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
  const deltaY = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);

  const animation = ghost.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      { transform: `translate(${deltaX * 0.55}px, ${deltaY * 0.55 - 50}px) scale(0.55)`, opacity: 0.9, offset: 0.6 },
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.1)`, opacity: 0 },
    ],
    { duration: 500, easing: 'ease-in-out' },
  );

  animation.onfinish = () => ghost.remove();
  animation.oncancel = () => ghost.remove();
}
