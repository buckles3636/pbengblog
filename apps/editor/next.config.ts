import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  turbopack: { root: path.resolve(process.cwd(), "../..") },
  outputFileTracingExcludes: { "/*": ["../../.env", "../../.local/**"] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};
export default config;
