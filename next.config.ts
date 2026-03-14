import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: creates a minimal production bundle
  // Reduces Docker image from ~900MB to ~100MB
  output: 'standalone',

  // Performance optimizations
  compress: true,

  // Throttle build concurrency to prevent 1600% CPU spikes
  // on high-core machines during static page generation.
  // Also disable ESLint and type checking during build as they are
  // redundant with CI and very CPU-intensive.

  experimental: {
    cpus: 4, // Limit to 4 cores for build workers
    // workerThreads: true — DISABLED: causes DataCloneError during static page
    // generation. Worker threads use structured clone which cannot serialize
    // functions like ()=>null in component defaults. Child processes (default) work fine.
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: ['tsf.ci', '*.tsf.ci', 'developos.shop', '*.developos.shop', 'localhost:3000', 'localhost:3001'],
    },
  },

  // For better compatibility with shared hosting
  poweredByHeader: false,

  // Fast build: Ignore type errors in production build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: false, // Reduced logging in prod
    },
  },

  // Security headers
  async headers() {
    return [
      {
        // Cache static assets aggressively — filenames are content-hashed
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // CRITICAL: HTML pages must never be cached by browsers or CDNs.
        // Next.js embeds Server Action IDs in the page shell — these change on
        // every deployment. If the browser/Cloudflare serves a cached HTML page
        // with old action IDs, every Server Action call crashes with
        // "Failed to find Server Action". This is a silent killer post-deploy.
        //
        // Note: /_next/static/ is excluded (immutable cache above) because those
        // files use content-hashed filenames and are safe to cache forever.
        source: '/((?!_next/static|fonts).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // Cache fonts (30 days)
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
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
            value: 'camera=(), microphone=(), geolocation=(), unload=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://*.cloudflareinsights.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: https://*.unsplash.com",
              "connect-src 'self' https://*.tsf.ci https://tsf.ci https://*.developos.shop https://developos.shop https://cloudflareinsights.com https://*.cloudflareinsights.com https://static.cloudflareinsights.com https://api.stripe.com https://*.unsplash.com",
              "frame-src 'self' https://js.stripe.com",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
