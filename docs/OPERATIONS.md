# Operations

## Persistent data

- PostgreSQL: Compose named volume `pbengblog_postgres` by default. PostgreSQL 17; host port 5544 on loopback.
- Uploads: `$DATA_DIR/uploads`, default `.local/uploads`.
- Migration archives: `$DATA_DIR/migrations`.
- Published releases: `$DATA_DIR/releases`.
- Credentials and branding: `.env`, mode 0600 on the development host.

Never run `docker compose down -v` against data you want to retain. Normal stop/start commands preserve the volume. Keep database migrations with the matching code version.

## Backups

```sh
bash scripts/backup.sh
bash scripts/restore-test.sh /absolute/path/printed/by/backup
```

Backups use PostgreSQL custom-format dumps, followed by an archive of immutable uploads. `SHA256SUMS` verifies both artifacts. The restore test creates a separate temporary database, restores in one transaction, validates all restored media hashes, reports row counts, and removes only its own temporary database/files. It does not replace the active database.

Default backup location is `.local/backups`; `PB_BACKUP_DIR` overrides it. Scripts do not prune old backups. Schedule daily backups with your service manager. `PB_BACKUP_REMOTE=your-remote:BlogBackups bash scripts/backup-offsite.sh` copies each completed database/media backup to an existing rclone remote and verifies remote checksums. These copies are not client-side encrypted; use a private destination or an rclone crypt remote if encryption is required. A local backup on the same machine is not disaster recovery. Credentials are deliberately excluded and must be recovered separately.

To recover for real, provision an empty database, restore using `pg_restore --exit-on-error --single-transaction --no-owner --no-acl`, restore the matching uploads directory, point DATABASE_URL and DATA_DIR at the restored data, run migrations, and verify the editor and static build before changing routing.

## Serving

`npm run dev` is for local development. `npm run build --workspace @pbengblog/editor` and `npm run start --workspace @pbengblog/editor` run the production editor on loopback port 3011. Use HTTPS or an SSH tunnel for remote access. No public host routes are installed by the template.

For Vercel, the website output is `apps/web/out/`. Build a release with `npm run publish` then `npm run build:published`. A database connection is only required during export, not during the static build or at request time. The release workflow below exports published database snapshots on your editor host and uploads only static files. Git pushes alone do not publish database content.

## Updating

Back up first. Update dependency versions intentionally, run type checks and tests, apply migrations, and test a restore. Keep the private site's `upstream` remote pointed at the public template, review upstream changes, and merge them into the private repository. GitHub public forks cannot be private; a private derivative is a separate repository with shared Git history.

## Private draft previews

`npm run preview:export` and `npm run build:preview` produce a local static preview of drafts without publishing them. The release is marked `preview: true` and uses a separate `preview-current.json` pointer. Never deploy a draft preview publicly without reviewing its contents.

## Reusable tags

Migration `003_reusable_tags.sql` adds `tags` and `post_tags`; run `npm run db:migrate` before starting the updated editor. Existing posts begin with no tags and continue to work. Tag assignment and article revision writes share one transaction. Unknown tag IDs reject the entire save. Tag names are unique ignoring case; concurrent creation reuses the existing tag. Renaming uses the previous name to reject stale writes. Revisions and published snapshots carry tag IDs and names, so renaming draft tags cannot change an exported website. Database backups include the registry and assignments.

## Release to Vercel

Requires Docker, Python 3, `flock`, and a Vercel project/account token. Copy `docs/deploy-config.example.json` to `.local/deploy-config.json`, set the project ID/name/team and token-file path, and keep that config and token private (mode 0600). Never commit credentials.

1. In the editor, save each article and click **Publish snapshot**.
2. From the repository root, run `bash scripts/release.sh` for a Vercel preview, or `bash scripts/release.sh --production` for the live site.
3. Check the returned URL. Deployment records, including the previous production ID, are in `.local/deployments/`.

To prepare without deployment: `bash scripts/prepare-release.sh`. Validate with `python3 scripts/deploy.py "$(cat .local/prepared-release)" --check`. Deploy that exact prepared release with the same command replacing `--check` with `--production` (or no flag for a preview). Empty sites, draft preview releases, and altered build files are rejected. Vercel previews may require account login depending on project protection settings.

The release includes all published articles, never current unpublished edits. It preserves extensionless post URLs. The static deployment has no database credentials or editor routes. Keep the old Notion Git deployment disconnected after cutover so it cannot overwrite a release. Production deployment is deliberate; the editor's **Publish snapshot** button saves a snapshot but does not itself deploy.

For rollback, open the Vercel project's Deployments page and promote the previous known-good deployment recorded in `.local/deployments/production.json` (or use Vercel's Instant Rollback). This restores the website without changing drafts or the database. Correct the draft and prepare a new release when ready.

## Offsite restore verification

Download one dated backup folder with `rclone copy REMOTE:FOLDER/DATED-BACKUP .local/restore-from-drive`, then run `bash scripts/restore-test.sh "$PWD/.local/restore-from-drive"`. The restore test uses a temporary database and does not overwrite live data. Credentials are excluded from backups and must be recovered separately. Backups currently retain every dated copy; monitor storage use.
