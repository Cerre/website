import type { NextConfig } from "next";

const vpsUrl = process.env.VPS_API_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!vpsUrl) return [];
    return [
      { source: "/api/spotify/:path*", destination: `${vpsUrl}/spotify/:path*` },
      { source: "/api/auth/me", destination: `${vpsUrl}/auth/me` },
      { source: "/api/pi/:path*", destination: `${vpsUrl}/pi/:path*` },
      { source: "/api/stream/:path*", destination: `${vpsUrl}/stream/:path*` },
    ];
  },
};

export default nextConfig;
