import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

// Without this, Next prerenders robots.txt once at build time with whatever
// SITE_URL (or its fallback) was set then — the same build-time-baking bug
// as metadataBase. Force it dynamic so the sitemap URL is read per request,
// as app/sitemap.ts already does.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/admin' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
