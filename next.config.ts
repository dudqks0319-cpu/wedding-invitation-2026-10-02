import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  turbopack: {root:process.cwd()},
  // 개발 서버를 127.0.0.1 주소로 열어도 동작하도록 허용
  allowedDevOrigins: ["127.0.0.1"],
  webpack(config, { dev }) {
    // Reusing the filesystem cache crashes WasmHash on this Node 26 toolchain.
    // Keep development caching; production builds compile without that cache.
    if (!dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
