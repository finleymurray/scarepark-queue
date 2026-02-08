import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // basePath: "/scarepark-queue",  <-- DELETE THIS LINE (or comment it out like this)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
