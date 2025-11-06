import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set Turbopack root to the app directory to avoid
  // incorrect workspace root inference when multiple lockfiles exist.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
