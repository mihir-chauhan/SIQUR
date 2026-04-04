import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cesium assets are served from public/cesium/ (copied from node_modules/cesium/Build/Cesium/)
  // The CESIUM_BASE_URL is set at runtime in the GlobeView component to "/cesium"

  // Turbopack resolve aliases (Cesium static assets handled by scripts/copy-cesium.js)
  turbopack: {
    resolveAlias: {},
  },

  // Silence large page data warnings from Cesium
  experimental: {
    largePageDataBytes: 512 * 1000,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Cesium uses some Node.js modules that need to be ignored in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        url: false,
        http: false,
        https: false,
        zlib: false,
      };
    }

    // Suppress Cesium's dynamic require warnings
    config.module = config.module ?? {};
    config.module.unknownContextCritical = false;

    return config;
  },

  // Transpile cesium for proper ESM handling
  transpilePackages: ["cesium"],
};

export default nextConfig;
