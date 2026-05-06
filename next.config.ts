import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'standalone',
  // Prevent 308 redirects that strip trailing slashes — Django requires them
  skipTrailingSlashRedirect: true,
  // Server action configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: ['tsf.ci', '*.tsf.ci', 'developos.shop', '*.developos.shop', 'localhost:3000'],
    },
  },

  // Performance optimizations
  compress: true,

  // For better compatibility with shared hosting
  poweredByHeader: false,

  // Fast build: Ignore type errors in production build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // URL hygiene — `/inventory/purchases/...` is a wrong nesting (Purchases is
  // a sibling module to Inventory, not a child). Bounce stale bookmarks /
  // typos to the real path before the App Router runs, so we don't fight
  // the RSC pipeline with a server-component `redirect()` (Next 16 + Turbopack
  // currently surfaces those as "unexpected response from server").
  async redirects() {
    return [
      {
        source: '/inventory/purchases',
        destination: '/purchases',
        permanent: false,
      },
      {
        source: '/inventory/purchases/:rest*',
        destination: '/purchases/:rest*',
        permanent: false,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.tsf.ci https://tsf.ci https://*.developos.shop https://developos.shop wss://*.developos.shop wss://*.tsf.ci https://cloudflareinsights.com",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
