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


## Editor login and continuous hosting

Set `EDITOR_USERNAME`, a nonempty `EDITOR_PASSWORD`, and `EDITOR_SESSION_SECRET` in the ignored `.env` (0600). Generate the session key with `openssl rand -hex 32`; it must contain at least 32 characters and be independent of the password. Set `EDITOR_ORIGIN` to the exact browser origin, such as `http://localhost:3011` for a local editor or `https://edit.example.com` for HTTPS. HTTP Basic authentication is no longer supported. Run migrations before starting this version.

```sh
bash scripts/node.sh npm run db:migrate
bash scripts/node.sh npm run build --workspace @pbengblog/editor
bash scripts/start-editor.sh
```

The start script recreates only the named editor container (`PB_EDITOR_CONTAINER`, default `pbengblog-editor`). It uses `unless-stopped`, loopback 3011, a health check, read-only app/dependency/config mounts, a writable uploads-only mount, a temporary directory, no Linux capabilities, no privilege escalation, and bounded CPU/memory/processes/logs. The database volume is untouched. Re-run after rebuilding or changing credentials/config. The health check reports failure; Docker's restart policy restarts exited processes, not merely unhealthy ones.

Open `/login`, sign in, and choose an article. Paste images, use `/` for block choices, and select reusable tags. Drafts autosave every five seconds. **Sign out** saves pending changes first and revokes the session. Sessions expire after 12 hours; if an open draft's session expires, sign in in another tab and return to save it. **Publish snapshot** still requires the separate release command described above to update the website.

## Optional Vercel editor domain

Use a dedicated routing-only Vercel project so publishing the static blog cannot overwrite the editor route. Copy `docs/editor-deploy-config.example.json` to ignored `.local/editor-deploy-config.json`. Set its domain, HTTPS upstream URL, existing Vercel token/team, and a private proxy-key file. Generate a separate random key, store the same value as `EDITOR_PROXY_SECRET` in the editor's `.env`, and restart the editor before enabling the public tunnel.

`python3 scripts/deploy-editor.py --check` validates non-secret routing configuration. `python3 scripts/deploy-editor.py --setup` creates the routing project if absent, attaches the domain, saves the proxy key as an encrypted Vercel variable, and deploys a no-cache HTTPS proxy. The routing rules remove caller-supplied client-IP headers before Vercel regenerates them, preventing forged addresses from bypassing throttling. Subsequent routing updates omit `--setup`. Only proxy configuration is uploaded; database credentials, login credentials, session keys, and blog content stay on the editor host. DNS must point to Vercel; domains managed by Vercel can be configured automatically. The script does not create the upstream tunnel itself.

Keep each tunnel route separate and remove only its path during rollback. Verify unauthenticated API/media requests fail, direct upstream requests fail without the proxy key, and login/logout work through the final domain. Existing sessions and login throttles survive editor restarts.

## Authentication recovery and tests

Database backups contain hashed session records and throttle state, but not login/session/proxy secrets. When restoring a real deployment, clear `editor_sessions` before opening access so a restored backup cannot resurrect logged-out sessions. Recover credentials separately; rotating `EDITOR_SESSION_SECRET` also invalidates all sessions. Credential changes require an editor restart. There is no public password-reset endpoint.

`npm test` covers content and credential/origin/cookie checks. Run `npx tsx --test tests/auth.integration.ts` only with `DATABASE_URL` pointing to a disposable database named `auth_test`, after migrations; the test enforces this database name and exercises session revocation, expiry, proxy checks, CSRF, concurrent throttles, and window reset. Run browser tests against an isolated editor configured with matching `EDITOR_ORIGIN` and test credentials. Never point destructive throttle tests at the live database.
