import type { NextConfig } from 'next';
import { OPTIMIZED_IMAGE_HOSTS } from './src/lib/images';

const apiInternal = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Images from any other host render unoptimized (see src/lib/images.ts), so
  // an admin-entered URL on a new host still displays.
  images: { remotePatterns: OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({ protocol: 'https' as const, hostname })) },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiInternal}/api/:path*` }];
  },
  // nginx previously set these security headers; keep them now that Next.js serves
  // the app directly. compress: true (the default) still provides gzip, and
  // /_next/static/* is already served immutable by Next.js.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    }];
  },
};

export default config;
