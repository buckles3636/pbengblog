#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
bash scripts/prepare-release.sh
python3 scripts/deploy.py "$(cat .local/prepared-release)" "$@"
