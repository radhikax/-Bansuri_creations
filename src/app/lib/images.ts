const UNSPLASH_HOST = 'images.unsplash.com';

function parseUnsplash(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname === UNSPLASH_HOST ? parsed : null;
  } catch {
    return null; // relative paths, data URIs, empty strings
  }
}

/**
 * Asks Unsplash for a resized, re-encoded image. Any other URL (self-hosted
 * product photos, relative paths) is returned unchanged.
 */
export function optimizedImageUrl(url: string, width: number): string {
  const parsed = parseUnsplash(url);
  if (!parsed) return url;
  parsed.searchParams.set('w', String(width));
  parsed.searchParams.set('q', '75');
  parsed.searchParams.set('auto', 'format');
  parsed.searchParams.set('fit', 'crop');
  return parsed.toString();
}

/** 1x/2x candidates for high-density screens; undefined when the URL can't be resized. */
export function imageSrcSet(url: string, width: number): string | undefined {
  if (!parseUnsplash(url)) return undefined;
  return `${optimizedImageUrl(url, width)} 1x, ${optimizedImageUrl(url, width * 2)} 2x`;
}
