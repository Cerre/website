import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://136.115.53.103/:path*",
      },
    ];
  },
};

export default nextConfig;
