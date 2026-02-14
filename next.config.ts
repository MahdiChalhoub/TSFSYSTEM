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
};

export default nextConfig;
