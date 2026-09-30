#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
mkdir -p .local
exec 9>.local/publish.lock
flock -n 9 || { echo 'Another release is being prepared.' >&2; exit 1; }
bash scripts/node.sh npm run publish
bash scripts/node.sh npm run build:published
bash scripts/node.sh node --input-type=module -e '
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import {config} from "dotenv";
config({quiet:true}); const dataDir=path.resolve(process.env.DATA_DIR||".local");
const {id}=JSON.parse(fs.readFileSync(path.join(dataDir,"releases/current.json"),"utf8"));
if(!/^[a-zA-Z0-9-]+$/.test(id))throw Error("Invalid release ID");
const release=path.join(dataDir,"releases",id), manifest=JSON.parse(fs.readFileSync(path.join(release,"manifest.json"),"utf8"));
if(manifest.preview||!manifest.articles)throw Error("No published articles to deploy");
fs.cpSync("apps/web/out",path.join(release,"site"),{recursive:true});
const hashes={}; function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile())hashes[path.relative(path.join(release,"site"),file)]=crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}}walk(path.join(release,"site"));
fs.writeFileSync(path.join(release,"site-checksums.json"),JSON.stringify(hashes,null,2));
fs.writeFileSync(".local/prepared-release",path.relative("/app",release)+"\n");
console.log("Prepared release:",id);'
