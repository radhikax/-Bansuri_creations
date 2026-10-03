// Hosts that next/image's optimizer may fetch from (next.config.ts builds
// images.remotePatterns from this list). Keep it short: every host here lets
// /_next/image proxy and resize arbitrary images from it.
export const OPTIMIZED_IMAGE_HOSTS = ['images.unsplash.com'];

/**
 * Admins can set a product or category image to any URL, but next/image
 * rejects a remote host missing from remotePatterns (a broken image in
 * production, a thrown error in dev). Images from other hosts — and local
 * paths or anything unparsable — are served as-is via `unoptimized` instead.
 */
export function isOptimizableImage(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && OPTIMIZED_IMAGE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}
