import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
webpack:(config, { dev }) => {
  if (!dev) {
    // Disable minification so we get readable error messages
    config.optimization.minimize = false;
  }
  return config;
 },
 productionbrowserSourceMaps: true,
};

export default nextConfig;
