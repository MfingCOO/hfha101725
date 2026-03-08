import type { NextConfig } from 'next';
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ['3000-firebase-103125-1761919991969.cluster-zsqzu5kebnaemxbyqrvoim2lxo.cloudworkstations.dev'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'storage.googleapis.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', port: '', pathname: '/**' }
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Permissions-Policy', value: 'payment=*' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/coach', destination: '/coach/dashboard', permanent: true },
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
      allowedOrigins: [
        '3000-firebase-103125-1761919991969.cluster-zsqzu5kebnaemxbyqrvoim2lxo.cloudworkstations.dev',
        'localhost:3000'
      ]
    },
  },
  serverExternalPackages: ['@opentelemetry/instrumentation', '@genkit-ai/core', '@genkit-ai/flow'],
};

export default withPWA(nextConfig);
