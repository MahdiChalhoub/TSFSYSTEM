import type { NextConfig } from "next";

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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.tsf.ci https://tsf.ci https://*.developos.shop https://developos.shop wss://*.developos.shop wss://*.tsf.ci",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
