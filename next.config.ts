
import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true, // Re-enabling with a basic config
  skipWaiting: true,
  // disable: process.env.NODE_ENV === 'development', // Example of a more robust setup
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals.push('firebase-admin');
    }
    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  async headers() {
      return [
          {
              source: '/:path*',
              headers: [
                  {
                      key: 'Permissions-Policy',
                      value: 'payment=*',
                  },
                  {
                      key: 'Cross-Origin-Opener-Policy',
                      value: 'same-origin-allow-popups',
                  }
              ],
          },
      ];
  },
  async redirects() {
    return [
      {
        source: '/coach',
        destination: '/coach/dashboard',
        permanent: true,
      },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  serverExternalPackages: ['@opentelemetry/instrumentation', '@genkit-ai/core', '@genkit-ai/flow'],
};

export default withPWA(nextConfig);
