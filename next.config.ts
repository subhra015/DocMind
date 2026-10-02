import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add these lines to ignore lint and TS errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;