#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
mkdir -p .local
exec 9>.local/publish.lock
flock -n 9 || { echo 'Another release is running.' >&2; exit 1; }
export PB_RELEASE_LOCK_HELD=1
bash scripts/prepare-release.sh
python3 scripts/deploy.py "$(cat .local/prepared-release)" "$@"
