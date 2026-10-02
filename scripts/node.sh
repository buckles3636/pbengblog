#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
container_args=()
if [[ -n "${PB_NODE_CONTAINER_NAME:-}" ]]; then
  container_args+=(--name "$PB_NODE_CONTAINER_NAME" --memory 2g --cpus 2 --pids-limit 256)
fi
exec docker run "${container_args[@]}" --rm --network host --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm-cache -v "$project_dir:/app" -w /app node:24-bookworm-slim "$@"
