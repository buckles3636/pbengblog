# Migrating from Notion

Keep Notion and the existing deployment available until the imported copy is reviewed. Also export the Notion root page as **Markdown & CSV**, including subpages, and retain the ZIP as an independent backup. The current importer uses public source records; ZIP import is not implemented yet.

```sh
npm run import:notion -- --site https://your-existing-site.example
npm run import:notion -- --site https://your-existing-site.example --apply
```

The first command only inventories. `--apply` imports linked public pages as **unpublished drafts**, preserving the exact current URL slugs. `--limit 1` provides a small trial import. Pages marked non-public, unlinked pages, and unnamed records are excluded from automatic migration.

The importer archives raw public Notion blocks, inventory, original date metadata, and a conversion report under `.local/migrations/<hostname>/`. It understands both old and nested Notion record wrappers, follows pagination, and fetches missing descendant blocks. It downloads supported images into local storage, rewrites recognized internal links, and converts headings, styled text, equations, code, lists, quotes, and basic tables to BlockNote.

Unsupported blocks get visible review placeholders. Callouts become quotes; embeds and non-image attachments remain links and are flagged. Missing images are flagged and left as visible placeholders. The generated jump menu replaces Notion's table-of-contents block. The importer is intentionally a one-time migration tool: its use of Notion's unofficial API is not part of normal site operation.

Reruns skip existing source IDs and reuse downloaded images. A failed article is reported and does not replace existing content. Inspect `report.json` and the original archived blocks before publishing. Original date metadata is retained in the inventory/report; the first UI version still displays the new local update timestamp.

## Review before switching domains

- Compare every public post, About, and Contact with Notion.
- Resolve all image and unsupported-block warnings; verify equations and table structure.
- Verify internal links and every existing URL slug.
- Save a database/media backup and run the restore test.
- Build and inspect the static output at desktop and mobile widths.
- Deploy to a preview first, then switch the production domain deliberately.

The public template must never receive `.env`, `.local`, migration archives, database dumps, or a personal site's generated media.

## Existing imports: reusable tags

New imports preserve Notion Tags as reusable tags. For previously imported posts, back up the database, apply migrations, then run `npx tsx scripts/import-notion-tags.ts .local/migrations/YOUR-HOST/homepage-source.json` to preview tag assignments. Add `--apply` to create the collection’s tag options and merge assignments into existing imported drafts. The backfill is idempotent, matches only existing Notion IDs, preserves article content and categories, and does not change published snapshots. Review and republish when ready.
