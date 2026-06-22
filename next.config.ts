import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships a native binary; let Next load it from node_modules at runtime
  // instead of trying to bundle it (which fails with "Could not load sharp" on Vercel).
  serverExternalPackages: ['sharp'],
};

export default nextConfig;
