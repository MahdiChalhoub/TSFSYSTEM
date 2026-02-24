import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server action configuration for Hostinger
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: ['tsf.ci', '*.tsf.ci', 'localhost:3000'],
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.tsf.ci https://tsf.ci https://cloudflareinsights.com https://static.cloudflareinsights.com https://api.stripe.com",
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
