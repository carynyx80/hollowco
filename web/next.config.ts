import type { NextConfig } from "next";
// All API traffic goes through /api on the web origin, so the session cookie is first-party (no cross-site cookies).
const API_ORIGIN = (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const nextConfig: NextConfig = {
  images: { formats: ['image/avif', 'image/webp'], minimumCacheTTL: 31536000, localPatterns: [{ pathname: '/api/assets/**' }, { pathname: '/**' }] },
  async redirects() { return [
    { source: "/marketplace", destination: "/", permanent: false },
    { source: "/classic", destination: "/", permanent: false },
    { source: "/classic/:path*", destination: "/", permanent: false },
    { source: "/shops", destination: "/", permanent: false },
    { source: "/products", destination: "/", permanent: false },
    { source: "/shop/:id", destination: "/s/:id", permanent: false },
  ]; },
  async rewrites() { return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }]; },
};
export default nextConfig;
