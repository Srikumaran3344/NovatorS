import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    config.watchOptions = {
      ignored: ['**/supabase/**'],
    }
    return config
  },
};

export default nextConfig;
