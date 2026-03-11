
import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';

// Correct configuration to prevent PWA from caching API routes
const runtimeCaching = [
  {
    urlPattern: /^\/api\/.*$/,
    handler: 'NetworkOnly' as const,
  },
];

const withPWA = withPWAInit({
  dest: 'public',
  runtimeCaching,
  // The default precaching will handle the app shell. We don't need a NetworkFirst fallback for everything.
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
          { key: 'Permissions-Policy', value: 'payment=*, push=*, notifications=*' },
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
};

export default withPWA(nextConfig);