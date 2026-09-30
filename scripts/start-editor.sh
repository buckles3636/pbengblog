#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
container_name="${PB_EDITOR_CONTAINER:-pbengblog-editor}"
[[ -f .env && -d apps/editor/.next ]] || { echo 'Configure .env and build the editor first.' >&2; exit 1; }
# Resolve only the upload directory. Do not evaluate .env as shell code.
data_dir="$(bash scripts/node.sh node --input-type=module -e 'import {config} from "dotenv"; config({quiet:true}); console.log(process.env.DATA_DIR||".local")')"
[[ "$data_dir" = /* ]] || data_dir="$project_dir/$data_dir"
mkdir -p "$data_dir/uploads"
if docker container inspect "$container_name" >/dev/null 2>&1; then docker rm -f "$container_name" >/dev/null; fi
docker run -d --name "$container_name" --restart unless-stopped \
  --network host --user "$(id -u):$(id -g)" --workdir /app \
  --read-only --tmpfs /tmp:rw,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --memory 768m --cpus 1 --pids-limit 128 \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  -e DATA_DIR=/data -e npm_config_cache=/tmp/npm-cache \
  --mount "type=bind,src=$project_dir/node_modules,dst=/app/node_modules,readonly" \
  --mount "type=bind,src=$project_dir/package.json,dst=/app/package.json,readonly" \
  --mount "type=bind,src=$project_dir/apps/editor,dst=/app/apps/editor,readonly" \
  --mount "type=bind,src=$project_dir/.env,dst=/app/.env,readonly" \
  --mount "type=bind,src=$data_dir/uploads,dst=/data/uploads" \
  --health-cmd "node --input-type=module -e 'import {config} from \"dotenv\"; config({path:\"/app/.env\",quiet:true}); const r=await fetch(\"http://127.0.0.1:3011/login\",{headers:{\"x-editor-proxy-key\":process.env.EDITOR_PROXY_SECRET||\"\"}}); process.exit(r.ok?0:1)'" \
  --health-interval 30s --health-timeout 10s --health-start-period 15s --health-retries 3 \
  node:24-bookworm-slim npm run start --workspace @pbengblog/editor
