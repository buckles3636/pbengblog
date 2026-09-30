#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
mkdir -p .local
exec 9>.local/backup-offsite.lock
flock -n 9 || exit 0
remote="${PB_BACKUP_REMOTE:?Set PB_BACKUP_REMOTE to your rclone backup folder}"
backup_dir="$(bash scripts/backup.sh)"
destination="$remote/$(basename "$backup_dir")"
rclone copy "$backup_dir" "$destination" --include database.dump --include uploads.tar.gz --include SHA256SUMS
rclone check "$backup_dir" "$destination" --one-way
printf 'Backup verified at %s\n' "$destination"
