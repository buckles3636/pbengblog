#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
backup_dir="${1:?Usage: bash scripts/restore-test.sh /absolute/path/to/backup}"
(cd "$backup_dir" && sha256sum -c SHA256SUMS)
test_db="pbengblog_restore_$(date +%s)_$RANDOM"
restore_dir="$(mktemp -d)"
cleanup() {
  docker compose exec -T db sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$test_db" >/dev/null
  rm -rf -- "$restore_dir"
}
trap cleanup EXIT
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" -T template0 "$1"' sh "$test_db"
docker compose exec -T db sh -c 'pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$1"' sh "$test_db" < "$backup_dir/database.dump"
tar -xzf "$backup_dir/uploads.tar.gz" -C "$restore_dir"
docker compose exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -At -F " " -c "SELECT sha256, filename FROM media ORDER BY filename"' sh "$test_db" > "$restore_dir/media-checksums"
while read -r expected filename; do
  [[ -z "$filename" ]] && continue
  actual="$(sha256sum "$restore_dir/uploads/$filename")"
  [[ "${actual%% *}" == "$expected" ]] || { printf 'Media checksum mismatch: %s
' "$filename" >&2; exit 1; }
done < "$restore_dir/media-checksums"
docker compose exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "SELECT (SELECT count(*) FROM posts) AS posts, (SELECT count(*) FROM revisions) AS revisions, (SELECT count(*) FROM media) AS media"' sh "$test_db"
printf 'Restore verified in an isolated database; live database unchanged.
'
