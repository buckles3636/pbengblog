import type { NextConfig } from "next";
import path from "node:path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });
const config: NextConfig = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  turbopack: { root: path.resolve(process.cwd(), "../..") },
};
export default config;
