# Operations

## Backend hosting without a home server

Run the editor and PostgreSQL on a Linux computer with persistent storage for the database and uploads. A cloud VM can use the same Docker setup while Vercel serves the static website.

### Choose where it runs

Start with **2 vCPUs, 4 GB RAM and 40 GB disk** to leave room for Next.js builds alongside the editor and database. We have not load-tested this sizing. Allow more disk space as you add images and retain backups.

| Option | Backend cost | When it fits |
| --- | --- | --- |
| Your existing Linux laptop or WSL2 environment | No extra hosting charge | Write locally and deploy when ready. The public site remains available while the computer is off. |
| Hetzner CX23 in an EU region | €5.49 / US$6.49 per month base, excluding IPv4 and VAT | Recommended budget cloud option when available: 2 vCPUs, 4 GB RAM, 40 GB disk. Capacity is limited. [Plan](https://www.hetzner.com/cloud/cost-optimized/) · [Price list](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). |
| DigitalOcean Basic, regular CPU | US$24 per month for 2 vCPUs / 4 GiB / 80 GiB | A paid alternative if your preferred budget region is unavailable. The $12 / 2 GiB plan is cheaper but leaves less room for builds. [Pricing](https://www.digitalocean.com/pricing/droplets). |
| Oracle Cloud Always Free, Ampere A1 | $0 within eligible quotas | Free option with setup and availability tradeoffs. Current documentation lists 2 OCPUs / 12 GB total and 200 GB combined boot/block storage in the home region. Free capacity can be unavailable; idle instances may be reclaimed. [Limits and conditions](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). |

Prices checked **October 2, 2026**. Check taxes, backup charges, networking costs, and regional capacity before ordering. Trial credits expire. On Oracle, select resources marked Always Free eligible and check your account allocation. We have not tested this repository on Oracle ARM hardware.

### Set up a cloud backend

1. Create an Ubuntu 24.04 LTS server with persistent disk and an SSH key. Use a regular administrator account with sudo, such as `blog`. Allow SSH from your own IP in the provider firewall. The tunnel setup below does not require exposing ports 3011 or 5544 publicly.
2. Install [Docker Engine and the Compose plugin](https://docs.docker.com/engine/install/ubuntu/). Give your administrator account Docker access using Docker's documented post-installation steps, then reconnect. Install the supporting tools:

   ```sh
   sudo apt update
   sudo apt install -y git python3 python3-venv openssl util-linux
   docker version
   docker compose version
   ```

3. Clone **your own copy** of the template, then install dependencies using its Node 24 container:

   ```sh
   git clone https://github.com/YOUR_ACCOUNT/YOUR_BLOG.git
   cd YOUR_BLOG
   bash scripts/node.sh npm ci
   cp .env.example .env
   chmod 600 .env
   ```

4. Edit `.env` using the README's configuration instructions. Set your own database/editor credentials and session key, plus `SITE_*` branding. For the SSH-tunnel setup, use `EDITOR_ORIGIN=http://localhost:3011` and leave `EDITOR_PROXY_SECRET` unset. Start persistent storage and the production editor:

   ```sh
   docker compose up -d --wait db
   bash scripts/node.sh npm run db:migrate
   bash scripts/node.sh npm run build --workspace @pbengblog/editor
   bash scripts/start-editor.sh
   ```

5. On **your laptop**, open an SSH tunnel and leave it running:

   ```sh
   ssh -N -L 3011:127.0.0.1:3011 blog@YOUR_SERVER_IP
   ```

   Open **http://localhost:3011** and sign in. Traffic between your laptop and the server travels through SSH. The editor stays running after the tunnel closes; reconnect whenever you want to write. If you prefer a public HTTPS editor domain, follow [editor hosting](#editor-login-and-continuous-hosting).

6. Follow the [README Vercel setup](../README.md#deploy-to-vercel), running release commands on this cloud server. For one-click publishing, enable the [background publisher](#background-publishing) on the same server. Manual publishing does not require that service.
7. Run `bash scripts/backup.sh` on the server and keep copies on a separate destination; see [Backups](#backups). Protect both PostgreSQL data and `.local/uploads`. Do not delete the server or its disk until you have a verified backup.

You maintain the operating system and backups on these cloud servers. Choose a host with persistent disk for PostgreSQL and uploads. A managed database covers the database alone; you still need somewhere to run the editor and store images.

## Persistent data

- PostgreSQL: Compose named volume `pbengblog_postgres` by default. PostgreSQL 17; host port 5544 on loopback.
- Uploads: `$DATA_DIR/uploads`, default `.local/uploads`.
- Migration archives: `$DATA_DIR/migrations`.
- Published releases: `$DATA_DIR/releases`.
- Credentials and branding: `.env`, mode 0600 on the development host.

Do not run `docker compose down -v` on a database you want to keep: it deletes the volume. Stop/start commands preserve it. Apply migrations from the same code version you run.

## Backups

```sh
bash scripts/backup.sh
bash scripts/restore-test.sh /absolute/path/printed/by/backup
```

The backup script writes a PostgreSQL custom-format dump and an archive of immutable uploads, then records their hashes in `SHA256SUMS`. The restore test creates a temporary database, restores in one transaction, checks media hashes, and reports row counts. It removes its test database and temporary files without touching the active database.

Backups go to `.local/backups`; set `PB_BACKUP_DIR` to choose another directory. Schedule daily runs through your service manager and monitor disk use, since the scripts do not prune old copies. To copy a completed backup to an existing rclone remote and verify checksums, run `PB_BACKUP_REMOTE=your-remote:BlogBackups bash scripts/backup-offsite.sh`. These copies have no client-side encryption. Use a private destination or an rclone crypt remote if you need encryption. Keep an off-host copy and a separate way to recover credentials, which the backup excludes.

For a production restore, stop the publisher and provision an empty database. Restore with `pg_restore --exit-on-error --single-transaction --no-owner --no-acl`, restore the matching uploads, and set DATABASE_URL and DATA_DIR to the recovered data. Apply migrations, clear restored editor sessions, and resolve restored active publication jobs as described below. Check the editor and static build before reopening access or changing routing.

## Serving

Use `npm run dev` for local development. Build with `npm run build --workspace @pbengblog/editor` and run with `npm run start --workspace @pbengblog/editor` for a production editor on loopback port 3011. Use HTTPS or an SSH tunnel for remote access. You must configure public routing yourself.

The static website output goes to `apps/web/out/`. Run `npm run publish`, then `npm run build:published` to build from published snapshots. The export needs a database connection; the static build and deployed website do not. The Vercel workflow below exports on the editor host and uploads static files. A Git push does not publish database content.

## Updating

Back up before updating. Review dependency changes, run type checks and tests, apply migrations, and test a restore. For a private derivative, keep `upstream` pointed at the public template and review changes before merging. GitHub does not allow a private fork of a public repository; use a separate private repository with shared Git history.

## Private draft previews

Run `npm run preview:export` and `npm run build:preview` to inspect drafts in a local static build. The export sets `preview: true` and writes `preview-current.json`, separate from published releases. Review the contents before sharing a draft preview.

## Reusable tags

Run `npm run db:migrate` to apply `003_reusable_tags.sql`, which adds `tags` and `post_tags`. Existing posts start without tags. Tag assignments and article revisions save in one transaction; an unknown tag ID rejects the save. Names are unique ignoring case, and concurrent creation reuses the existing tag. A rename checks the previous name to detect stale edits. Revisions and published snapshots retain their tag IDs and names, so a rename affects the website after you republish. Database backups include the registry and assignments.

## Release to Vercel

Install Docker, Python 3, and `flock`, and create a Vercel project/account token. Copy `docs/deploy-config.example.json` to `.local/deploy-config.json`. Enter the project ID, project name, team, and path to the token file. Keep the config and token outside Git with mode 0600.

1. In the editor, save each article and click **Save snapshot**.
2. From the repository root, run `bash scripts/release.sh` for a Vercel preview, or `bash scripts/release.sh --production` for the live site.
3. Check the returned URL. Deployment records, including the previous production ID, are in `.local/deployments/`.

Run `bash scripts/prepare-release.sh` to prepare a release without deploying it. Check it with `python3 scripts/deploy.py "$(cat .local/prepared-release)" --check`. To deploy that same release, replace `--check` with `--production`, or omit the flag for a preview. The deploy script rejects empty sites, draft previews, and modified build files. Vercel preview access depends on the project's protection settings.

The release includes published snapshots and preserves extensionless URLs. It excludes current unpublished edits, database credentials, and editor routes. Keep automatic Git deployments disconnected to prevent a demo build from replacing published content. With the background publisher enabled, **Publish to website** saves and deploys. **Save snapshot** saves the public version for a later manual release.

To roll back the website, open the Vercel project's Deployments page and promote the last working deployment from `.local/deployments/production.json`, or use Instant Rollback. This leaves drafts and the database unchanged. Correct the article and publish a new release after checking it.

## Offsite restore verification

Download a dated backup with `rclone copy REMOTE:FOLDER/DATED-BACKUP .local/restore-from-drive`, then run `bash scripts/restore-test.sh "$PWD/.local/restore-from-drive"`. The test restores to a temporary database and leaves live data untouched. Recover credentials from your separate private copy. Monitor storage use; backups retain dated copies until you remove them.


## Editor login and continuous hosting

Set `EDITOR_PASSWORD` and `EDITOR_SESSION_SECRET` in the ignored `.env` file (0600). Both must be nonempty. Generate the session key with `openssl rand -hex 32`; it needs at least 32 characters and must be generated independently of the password. Set `EDITOR_ORIGIN` to the browser origin you will use, such as `http://localhost:3011` or `https://edit.example.com`. The editor uses a login page, not HTTP Basic authentication. Apply migrations before starting it.

```sh
bash scripts/node.sh npm run db:migrate
bash scripts/node.sh npm run build --workspace @pbengblog/editor
bash scripts/start-editor.sh
```

The start script recreates the container named by `PB_EDITOR_CONTAINER`, default `pbengblog-editor`, without changing the database volume. It binds port 3011 to loopback and uses `unless-stopped`. App, dependency, and config mounts are read-only; the uploads mount and temporary directory are writable. The container drops Linux capabilities, blocks privilege escalation, and limits CPU, memory, processes, and logs. Re-run the script after rebuilding or changing config or credentials. Docker restarts exited processes under this policy; an unhealthy health check alone does not trigger a restart.

Open `/login`, sign in, and choose an article. Paste images, use `/` for blocks, and select tags. Article drafts autosave every five seconds. **Sign out** saves pending article changes before revoking the session. Sessions expire after 12 hours; sign in through another tab and return to save an open draft. Use **Publish to website** with the background publisher, or **Save snapshot** followed by the manual release command.

## Optional Vercel editor domain

Create a separate Vercel project for the editor proxy so static blog releases cannot overwrite its route. Copy `docs/editor-deploy-config.example.json` to ignored `.local/editor-deploy-config.json`. Set the domain, HTTPS upstream URL, Vercel token/team, and path to a private proxy-key file. Generate a separate random proxy key and put the same value in the editor's `EDITOR_PROXY_SECRET`. Restart the editor before opening the public tunnel.

Check the non-secret routing config with `python3 scripts/deploy-editor.py --check`. Run `python3 scripts/deploy-editor.py --setup` to create the project if needed, attach the domain, store the proxy key as an encrypted Vercel variable, and deploy the no-cache HTTPS proxy. Omit `--setup` for later routing updates. The proxy removes caller-supplied client-IP headers before Vercel regenerates them, preventing forged addresses from bypassing throttling. The script uploads proxy configuration; database and login credentials, session keys, and blog content stay on the editor host. Point DNS to Vercel. The script can configure Vercel-managed domains, but you must create the upstream tunnel.

Give the editor its own tunnel path and remove that path alone during rollback. Check that anonymous API/media requests fail, upstream requests without the proxy key fail, and login/logout work on the final domain. Sessions and login throttles persist through editor restarts.

## Authentication recovery and tests

Database backups contain hashed sessions and throttle state, but exclude login, session, and proxy secrets. Clear `editor_sessions` before reopening a restored deployment to prevent reuse of sessions revoked since the backup. Recover secrets from your private copy; rotating `EDITOR_SESSION_SECRET` also invalidates sessions. Restart the editor after credential changes. Password recovery requires host access; there is no public reset endpoint.

`npm test` checks content and credential/origin/cookie behavior. After migrating a disposable database named `auth_test`, run `npx tsx --test tests/auth.integration.ts` with DATABASE_URL pointing to it. The suite enforces that database name and checks revocation, expiry, proxy enforcement, CSRF, concurrent throttles, and window reset. Run browser tests against a separate editor with matching EDITOR_ORIGIN and test credentials. Keep destructive throttle tests away from production.

## Background publishing

With the host worker enabled, click **Publish to website** to save the selected draft and enqueue a release. The job freezes that article and the other published snapshots in PostgreSQL. Other drafts and edits made after the click stay out of the job. The worker builds and deploys one job at a time, even after you close the browser. Sign in again to see progress. Success means Vercel reported READY; a failed build leaves the live site in place and permits another attempt.

Configure Vercel releases and apply migrations, including `005_publication_jobs.sql`, then install the worker:

```sh
bash scripts/install-publisher.sh
# Keep user services running after logout and at boot (administrator command):
sudo loginctl enable-linger "$USER"
```

Install Python 3 with venv support and give the worker Docker access and the deployment credential. The installer creates a private Python environment, `.local/publisher-config.json` with the database connection, and the user service `pbengblog-publisher.service`. Set `PUBLISHER_ENABLED=true` in `.env`, build the editor, and recreate its container. Set SITE_URL for the **View website** link. Deployment credentials and Docker access stay with the host worker. The template disables the worker by default; you can still use **Save snapshot** and manual releases.

Check `systemctl --user status pbengblog-publisher.service` and `journalctl --user -u pbengblog-publisher.service`. Per-job logs and receipts stay private under `.local/publications/`; the editor displays a status message without raw logs or credentials. Duplicate clicks reuse the active job. A shared release lock prevents overlap with manual releases. Re-run the installer after changing the database connection, and restart the service after updating its code.

On restart, the worker fails interrupted builds and checks known deployment IDs with Vercel. A submission with an unknown outcome enters `needs_review` and blocks new publication. Inspect its private receipt, the project's deployment history, and `pbengblogPublication` metadata. Do not retry or run a manual production release until you establish the outcome. Then stop the worker, mark that exact job succeeded with its deployment ID or failed in PostgreSQL, and restart. Keep the job record.

Stop the publisher before restoring a production database. Clear restored editor sessions and mark restored active publication jobs failed before restarting, so the worker cannot deploy an old snapshot. Check the recovered content and Vercel state first. Backups include jobs and frozen snapshots. You must manage retention for backups, publication history, and release files.

## Finding and restoring articles

Search by article title, summary, or tag name, and combine the search with a tag filter. **History** opens under the toolbar and reports loading or errors. To restore a revision, the editor saves pending changes, then saves the chosen content as a new revision. Publish to put the restored version online. **Sign out** sits in the header and saves pending article edits before ending the session.

## Entry dates and tag colors

Enter **Entry date** as `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; leave it blank if unknown. Apply `006_entry_dates.sql` before using this field. Publish to show the date on the homepage and article. Later edits do not change it, and existing posts stay undated until you enter a date. Tag badges derive colors from stable IDs and use text and selection outlines to remain readable.

The release script selects Node 24 for Vercel, matching the local toolchain. An obsolete project runtime can reject a static-file release. See [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Writing studio and password-only login

The editor uses a light palette regardless of your operating-system theme. Expand **Article details** for the date, URL, category, and tags. The title, summary, cover, and document stay visible. Choose **Upload cover**, **Replace cover**, or **Use an image URL** to set a cover. The authenticated upload endpoint accepts PNG, JPEG, WebP, and GIF files up to 12 MB. A failed replacement keeps the old cover; removing a cover clears its reference but retains the file for older revisions. Wait for an upload to finish before saving, publishing, or navigating.

A success message clears after ten seconds or when you dismiss it, and stays hidden on reopening the editor. Active, failed, uncertain, and offline publication states remain visible when they apply. Set SITE_URL to add **View website** to the header.

Sign in with the owner password; you can remove the unused EDITOR_USERNAME setting. The server checks the password with a constant-time digest comparison. On the public HTTPS editor, the browser sends it in a POST JSON body. It does not store it in the URL, browser storage, or session cookie. Vercel terminates browser TLS and connects to the HTTPS Funnel upstream, followed by HTTP over host loopback. The server and proxy handle the password during login, so keep their config private. The frontend contains no configured credential.

On HTTPS, the server issues a random HttpOnly, Secure, SameSite=Strict cookie and a one-year HSTS policy. PostgreSQL stores keyed token hashes. Login throttles, origin checks, proxy authentication, and no-store responses protect the editor. The password-only login rollout invalidated earlier sessions through a credential-version change without changing the password. Keep real credentials out of screenshots, logs, tests, and documentation.

## Template appearance

Edit `shared/template-theme.css` to change colors, fonts, and corner radius across the public website and editor. Keep the document surface and controls legible, including tags and errors. Change website layout in `apps/web/app/monochrome.css` and editor layout in `apps/editor/app/editor.css`. The README shows the full homepage without cropping.

## Private project ideas

Apply `007_project_ideas.sql` with `npm run db:migrate`. Open **Project ideas** above the article workspace or visit `/ideas`. Enter a title, optional plain-text details, and tags, then click **Add idea** or **Save idea**. Ideas require a save click; article drafts autosave. Leaving an unsaved idea prompts you to confirm.

Check an idea to mark it done; uncheck it to reopen it. Filter by status or tag. Deletion is permanent and asks for confirmation. Migration 007 adds Server, Hardware, and Business to the shared tag registry. Create or rename tags through the picker; reload to see renamed labels. The ideas page requires the owner login, and writes require the configured origin.

PostgreSQL stores ideas in `project_ideas` and their tags in `idea_tags`. Public releases and draft-preview exports exclude both. Version checks reject stale edits, completion changes, and deletions. After a conflict, copy your unsaved notes before reloading. Full database backups include ideas and tag links; image backups use the existing process.

Run `tests/ideas.integration.ts` and `tests/ideas.e2e.ts` against a disposable `publish_test` database, not production. They cover version conflicts, tag integrity, exclusion from publication, authentication, editing, completion, filtering, and deletion.

Review on October 2, 2026: `lib/ideas.ts` contains input validation, tag resolution, transactions, and version checks behind three functions. Browser and database tests exercise that interface. The security review covered anonymous and authenticated requests, proxy/session/origin checks, parameterized SQL, writable fields, escaped text, and post-only exports. The review found no high-confidence vulnerabilities in the changed scope. Ideas use the existing single-owner access model.
