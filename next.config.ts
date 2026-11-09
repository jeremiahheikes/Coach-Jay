import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep recently visited pages in the client cache for 30 s so hopping between tabs is instant;
    // pages with live data refresh themselves (AutoRefresh) and server actions revalidate on write.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
