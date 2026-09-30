import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  turbopack: { root: path.resolve(process.cwd(), "../..") },
};
export default config;
