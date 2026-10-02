import type { NextConfig } from "next";

// Import env early so build fails on invalid configuration (unless SKIP_ENV_VALIDATION).
import "./src/env";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
