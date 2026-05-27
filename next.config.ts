import type { NextConfig } from "next";

const vpsUrl = process.env.VPS_API_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!vpsUrl) return [];
    return [
      { source: "/api/spotify/:path*", destination: `${vpsUrl}/spotify/:path*` },
      { source: "/api/auth/me", destination: `${vpsUrl}/auth/me` },
    ];
  },
};

export default nextConfig;
