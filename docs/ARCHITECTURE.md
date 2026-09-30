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

This initial version is a single-owner editor using HTTP Basic auth. It fails closed if credentials are missing or too short. Every route is protected; write endpoints additionally require the same Origin. JSON bodies and uploads have streaming size limits. SVG/HTML uploads and executable URLs are rejected. The database and editor bind to loopback. Use an SSH tunnel or trusted HTTPS reverse proxy; this scaffold is not configured as a public multi-user service.

## Future work

Automated deployment from a publish action, durable browser draft recovery after a browser crash, richer attachment conversion, publication timestamps, redirects for intentional slug changes, and automated retention policies are follow-up work. Static Vercel release scripts and verified rclone offsite backups are available in the operations guide. Five-second autosave and before-unload protection are implemented; unsaved keystrokes can still be lost if a tab crashes before saving.
