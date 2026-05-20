import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  serverExternalPackages: ['@azure/cosmos', 'mermaid'],

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, net: false, tls: false, crypto: false,
        path: false, os: false, stream: false, buffer: false,
      };
    }
    return config;
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react', 'recharts', 'framer-motion', 'motion',
      'date-fns', '@azure/msal-browser', '@azure/msal-react', 'zustand',
    ],
  },
};

export default nextConfig;
