import { config } from "dotenv";
import path from "node:path";
export const root = path.resolve(
  /* turbopackIgnore: true */
  process.cwd(),
  process.cwd().endsWith("/apps/editor") || process.cwd().endsWith("/apps/web")
    ? "../.."
    : ".",
);
config({ path: path.join(root, ".env"), quiet: true });
export const dataDir = path.resolve(
  /* turbopackIgnore: true */ root,
  process.env.DATA_DIR || ".local",
);
