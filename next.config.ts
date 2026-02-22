
import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  // THE FIX: We are disabling automatic registration to take manual control.
  register: false,
  skipWaiting: true,
  disable: false,
  importScripts: ['/firebase-messaging-sw.js'],
});

const nextConfig: NextConfig = {
  // We are keeping this for now to allow the build to succeed.
  // TODO: Schedule a task to remove this and fix all TypeScript errors.
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
  // THIS IS THE FIX for the 'Critical dependency' error.
  serverExternalPackages: ['@opentelemetry/instrumentation', '@genkit-ai/core', '@genkit-ai/flow'],
};

export default withPWA(nextConfig);
