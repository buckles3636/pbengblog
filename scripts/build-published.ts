import { readFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { root, dataDir } from "../lib/env";
const { id } = JSON.parse(
  await readFile(
    path.join(
      dataDir,
      process.argv.includes("--preview")
        ? "releases/preview-current.json"
        : "releases/current.json",
    ),
    "utf8",
  ),
);
if (typeof id !== "string" || !/^[a-zA-Z0-9-]+$/.test(id))
  throw new Error("Invalid release ID");
const dir = path.join(dataDir, "releases", id);
await readFile(path.join(dir, "manifest.json"));
// This generated directory belongs exclusively to the snapshot builder.
const media = path.join(root, "apps/web/public/media");
await rm(media, { recursive: true, force: true });
await mkdir(media, { recursive: true });
await cp(path.join(dir, "media"), media, { recursive: true });
const child = spawn("npm", ["run", "build", "--workspace", "@pbengblog/web"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, CONTENT_SNAPSHOT: path.join(dir, "articles.json") },
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
