import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module = config.module ?? {};
    config.module.unknownContextCritical = false;
    return config;
  },
};

export default nextConfig;
