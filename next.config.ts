import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/scarepark-queue",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
