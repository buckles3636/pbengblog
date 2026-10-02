# Architecture

The application contains two separate Next.js apps. `apps/editor` is a private server application; `apps/web` is a static website. Both use the structured BlockNote document model in `shared/content.ts`. The website renders supported blocks without loading the editor.

## Data model

`posts` owns the current draft and its version, plus an independent published JSON snapshot. Each successful create/save transaction inserts a row into `revisions`. Failed competing writes do not create revisions. A stale version receives HTTP 409. Slugs are unique and become immutable once published, preserving existing links. PostgreSQL constraints also enforce published snapshot identity and URL consistency.

`media` records immutable filenames, original filenames, MIME types, lengths, and SHA-256 hashes. Files are created before metadata insertion; database insertion failures remove the newly created file. There is no automatic media deletion, so old revisions retain their images. An interrupted upload can leave an orphan file; it is harmless and should only be removed by a deliberate future cleanup tool.

`imports` records source IDs and migration warnings. Raw source documents are archived separately under DATA_DIR. Imports always create drafts. Re-running a source ID skips it rather than overwriting edits.

Migrations are serialized with a PostgreSQL advisory lock and applied transactionally. Applied migration checksums are verified before further changes.

## Publishing

A single SQL query reads all published snapshots. The exporter validates each article and verifies each local media file against its database hash. It writes a new release directory and atomically switches `current.json` only after success. Failed exports leave the previous release selected. Concurrent exports use distinct directories and pointer temporary files.

The static build consumes an explicit snapshot path. No credentials, database client, or unpublished articles are imported into the public website. Failed frontend builds do not change the deployed website. Deployment remains a separate deliberate action.

## Authentication and trust boundary

The editor uses a single-owner login page and opaque random session cookies. Migration `004_editor_sessions.sql` adds sessions and login throttles to the existing PostgreSQL database. Session tokens are stored as keyed hashes, expire after 12 hours, and are revoked on logout. Credential or session-key changes invalidate existing sessions. HTTPS cookies are host-only, Secure, HttpOnly, and SameSite=Strict. Empty/unconfigured credentials fail closed; the password has no minimum length. Use a strong owner-selected password and an independent random session key.

Every article, tag, revision, publish, and upload endpoint validates its session. Write endpoints, login, and logout also require the explicitly configured `EDITOR_ORIGIN`. Authentication failures preserve the open draft and provide a sign-in link for another tab. Draft and media responses use `private, no-store`; the editor is excluded from indexing and framing. JSON bodies and uploads have streaming size limits. SVG/HTML uploads and executable URLs are rejected.

Login limits persist across restarts and serialize concurrent attempts in PostgreSQL: 10 attempts per client in a five-minute window and 100 globally. Client IPs are keyed hashes, not raw addresses. The Vercel routing deployment strips caller-supplied `x-vercel-forwarded-for` and `x-real-ip` before Vercel regenerates them. This was verified with forged headers through the actual tunnel. The regenerated client-IP header is trusted only when an independent proxy key authenticates the request; direct mode shares one client bucket. These caps can temporarily block legitimate new logins during sustained abuse; existing sessions remain usable. Expired rate-limit rows are pruned on login.

The editor and database bind to loopback. Optional Vercel routing uses a separate routing-only project and an HTTPS upstream tunnel. An encrypted Vercel variable supplies the proxy key; direct access to the upstream cannot reach the editor without it. The public static site and its deployments remain independent. This is a single-owner editor, with no registration or multi-user account model.

## Future work

durable browser draft recovery after a browser crash, richer attachment conversion, publication timestamps, redirects for intentional slug changes, and automated retention policies are follow-up work. Static Vercel release scripts and verified rclone offsite backups are available in the operations guide. Five-second autosave and before-unload protection are implemented; unsaved keystrokes can still be lost if a tab crashes before saving.

## Background publications

The optional host publisher consumes durable `publication_jobs` from PostgreSQL. Enqueueing saves the selected published snapshot and freezes all published articles in one transaction. The editor only creates authenticated, same-origin jobs; it has no Docker or Vercel access. A separate single-consumer worker executes fixed build/deploy scripts, serializes with manual releases, reports heartbeats, and reconciles remote deployment receipts after interruptions. Uncertain submissions block retries pending review. See Operations for installation and recovery.

`posts.entry_date` is optional editorial metadata, independent of save/revision timestamps. It preserves year, month or day precision, travels through revisions and frozen publication snapshots, and is never inferred from a recent save. Empty dates render nothing. Tag colors are derived from stable tag IDs, consistently across the editor and website.
