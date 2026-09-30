import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 서버를 127.0.0.1 주소로 열어도 동작하도록 허용
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
