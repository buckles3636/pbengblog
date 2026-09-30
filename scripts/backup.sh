#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
backup_root="${PB_BACKUP_DIR:-$project_dir/.local/backups}"
backup_dir="$backup_root/$(date -u +%Y%m%dT%H%M%S)-$RANDOM"
mkdir -p "$backup_dir"
# Files are immutable and written before their database record is committed.
# Copying uploads after the consistent database dump includes all referenced media.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$backup_dir/database.dump.partial"
mv "$backup_dir/database.dump.partial" "$backup_dir/database.dump"
# Ask the application for DATA_DIR rather than evaluating .env as shell code.
data_dir="$(bash scripts/node.sh node --input-type=module -e 'import {config} from "dotenv"; config({quiet:true}); console.log(process.env.DATA_DIR||".local")')"
if [[ "$data_dir" != /* ]]; then data_dir="$project_dir/$data_dir"; fi
mkdir -p "$data_dir/uploads"
tar -C "$data_dir" -czf "$backup_dir/uploads.tar.gz" uploads
(cd "$backup_dir" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
printf '%s
' "$backup_dir"
