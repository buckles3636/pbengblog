#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec docker run --rm --network host --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm-cache -v "$project_dir:/app" -w /app node:24-bookworm-slim "$@"
