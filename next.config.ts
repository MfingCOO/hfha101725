
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    if (!isServer) {
      config.externals = [...(config.externals || []), 'async_hooks', 'child_process', 'diagnostics_channel', 'fs'];
    }

    if (isServer) {
        config.externals = [...(config.externals || []), 'net', 'tls'];
    }

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    return config;
  },
  allowedDevOrigins: [
      'https://*.cloudworkstations.dev',
      'https://3000-firebase-103125-1761919991969.cluster-zsqzu5kebnaemxbyqrvoim2lxo.cloudworkstations.dev'
  ],
};

export default nextConfig;
