import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse does dynamic requires / touches fs — keep it out of the bundle.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
