import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse does dynamic requires / touches fs; zipcodes ships a large data blob —
  // keep both out of the bundle (server-only usage).
  serverExternalPackages: ['pdf-parse', 'zipcodes'],
};

export default nextConfig;
