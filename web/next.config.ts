import type { NextConfig } from "next";
// All API traffic goes through /api on the web origin, so the session cookie is first-party (no cross-site cookies).
const API_ORIGIN = (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() { return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }]; },
};
export default nextConfig;
