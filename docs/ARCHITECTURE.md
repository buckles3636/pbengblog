# Architecture

PBEngBlog has two Next.js apps: the private editor in `apps/editor` and the static website in `apps/web`. Both use the BlockNote document schema in `shared/content.ts`. The website renders supported blocks without loading the editor.

## Data model

`posts` stores the current draft, its version, and a separate published JSON snapshot. Each successful create or save adds a `revisions` row in the same transaction. Competing saves with a stale version return HTTP 409 without adding a revision. PostgreSQL enforces unique slugs, published snapshot identity, and URL consistency. After publication, a post's slug cannot change.

`media` stores immutable filenames, original filenames, MIME types, file lengths, and SHA-256 hashes. The upload handler writes the file before inserting metadata and removes it if the insert fails. An interrupted upload can leave an orphan file. Keep media files until a cleanup tool can check references from older revisions; the application does not delete them.

`imports` tracks source IDs and conversion warnings. The importer archives raw source documents under DATA_DIR and creates drafts. Repeating an import skips known source IDs, preserving your edits.

The migration runner uses a PostgreSQL advisory lock, applies each migration in a transaction, and checks applied migration checksums before making changes.

## Publishing

The exporter reads published snapshots in one SQL query, validates each article, and checks local media against the stored hashes. It writes a new release directory, then replaces `current.json` with an atomic rename. A failed export leaves the previous release selected. Concurrent exports use separate directories and temporary pointer files.

The static build reads an explicit snapshot path. It includes published articles and their assets, without database access or editor credentials. A failed build leaves the deployed website in place. You deploy through the release command or the optional background publisher.

## Authentication and trust boundary

The editor supports one owner with a password-only login. Migration `004_editor_sessions.sql` adds session and login-throttle tables. The server issues random session tokens, stores keyed hashes, and expires sessions after 12 hours. Logout revokes the session; changing the password or session key invalidates existing sessions. HTTPS cookies are host-only, Secure, HttpOnly, and SameSite=Strict. Unconfigured credentials deny access. The password has no minimum length; choose a strong password and generate a separate random session key.

Article, tag, revision, publication, idea, and upload endpoints check the session. Login, logout, and writes also check `EDITOR_ORIGIN`. After a session expires, you can keep an open draft, sign in through another tab, and return to save. Draft and media responses use `private, no-store`. The editor blocks indexing and framing, limits JSON and upload sizes while reading the request, and rejects SVG/HTML uploads and executable URLs.

PostgreSQL stores login limits across restarts and serializes concurrent attempts: 10 per client and 100 total in a five-minute window. It stores keyed client-IP hashes rather than raw addresses and prunes expired limits on login. The Vercel proxy removes caller-supplied `x-vercel-forwarded-for` and `x-real-ip` before Vercel regenerates them. Tests through the tunnel confirmed this with forged headers. The editor trusts the regenerated client-IP header only after checking an independent proxy key. Direct mode uses one shared client bucket. Sustained abuse can block new logins until limits expire; existing sessions remain usable.

The editor and database bind to loopback. Optional public editor access uses a separate Vercel routing project and an HTTPS tunnel. Vercel stores the proxy key in an encrypted variable; the editor rejects upstream requests without that key. The static website deploys through a separate project. The editor has no registration or multi-user account model.

## Future work

Open work includes browser-crash draft recovery, richer attachment conversion, publication timestamps, slug-change redirects, and retention policies. Drafts autosave every five seconds, and navigation warns about unsaved edits. A browser crash can still lose changes made since the last save. See [Operations](OPERATIONS.md) for release scripts and rclone backup verification.

## Background publications

The optional host worker reads `publication_jobs` from PostgreSQL. Enqueuing a publication saves the selected article's public snapshot and freezes the complete published set in one transaction. The editor creates jobs through authenticated, same-origin requests; it has no Docker socket or Vercel credential.

One worker runs fixed build and deployment scripts, shares a lock with manual releases, reports heartbeats, and checks remote deployment receipts after interruptions. A submission with an unknown outcome blocks further publication until an operator reviews it. See [Operations](OPERATIONS.md#background-publishing) for installation and recovery.

`posts.entry_date` stores an optional year, month, or full date chosen by the author. Revisions and frozen publication snapshots preserve that precision. Saving a post does not change its entry date; an empty date produces no label. The editor and website derive tag colors from stable tag IDs.

## Private ideas

`project_ideas` and `idea_tags` store ideas outside the article model and reuse the tag registry. Authenticated `/api/ideas` and `/api/ideas/[id]` routes handle listing, creation, version-checked updates, and deletion. Idea and tag writes share a transaction; foreign keys enforce valid tag references.

You manage ideas on the editor's `/ideas` page. Public releases and draft previews export posts, excluding ideas. Full database backups include both idea tables.
