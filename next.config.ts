import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  // FIX: Change this to false to enable and test notifications in dev mode
  disable: false, 
  register: true,
  skipWaiting: true,
  // This ensures your custom sw.js logic (if you have one) doesn't get overwritten
  sw: 'sw.js', 
  runtimeCaching: [
    {
      urlPattern: /^\/api\/.*$/,
      handler: 'NetworkOnly',
    },
  ],
});

const nextConfig: NextConfig = {
  serverExternalPackages: ['@opentelemetry/sdk-node', '@opentelemetry/api'],

  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
      allowedOrigins: [
        '3000-firebase-103125-1761919991969.cluster-zsqzu5kebnaemxbyqrvoim2lxo.cloudworkstations.dev',
        'localhost:3000',
      ],
    },
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        { module: /node_modules\/@opentelemetry\/instrumentation/ },
        { message: /Critical dependency: the request of a dependency is an expression/ },
      ];
    }
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Permissions-Policy', value: 'payment=*, push=*, notifications=*' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/coach', destination: '/coach/dashboard', permanent: true },
    ];
  },
};

export default withPWA(nextConfig);