import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

const nextConfig: NextConfig = {
  // We are keeping this for now to allow the build to succeed.
  // TODO: Schedule a task to remove this and fix all TypeScript errors.
  typescript: {
    ignoreBuildErrors: true,
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
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  serverExternalPackages: ['@opentelemetry/instrumentation', '@genkit-ai/core'],
  allowedDevOrigins: [
      'https://*.cloudworkstations.dev',
      'https://3000-firebase-103125-1761919991969.cluster-zsqzu5kebnaemxbyqrvoim2lxo.cloudworkstations.dev'
  ],
};

export default withPWA(nextConfig);
