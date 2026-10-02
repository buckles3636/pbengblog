# Migrating from Notion

Keep Notion and the existing deployment available until you review the import. Export the Notion root page as **Markdown & CSV**, including subpages, and retain the ZIP as a separate backup. The importer reads public source records; it cannot import that ZIP.

```sh
npm run import:notion -- --site https://your-existing-site.example
npm run import:notion -- --site https://your-existing-site.example --apply
```

The first command inventories the source. Add `--apply` to import linked public pages as **unpublished drafts** with their existing URL slugs. Use `--limit 1` for a trial import. The importer skips non-public pages, unlinked pages, and unnamed records.

Find the raw Notion blocks, inventory, original dates, and conversion report under `.local/migrations/<hostname>/`. The importer reads old and nested record wrappers, follows pagination, and fetches missing descendants. It downloads supported images, rewrites recognized internal links, and converts headings, styled text, equations, code, lists, quotes, and basic tables to BlockNote.

Review the conversion report before publishing:

- Unsupported blocks and missing images leave visible placeholders.
- Callouts become quotes.
- Embeds and non-image attachments remain links with review warnings.
- The website's heading menu replaces Notion's table of contents.

The importer uses Notion's unofficial API for migration. Running the blog after import requires no Notion connection. Reruns skip known source IDs and reuse downloaded images; a failed import reports the article without replacing existing content. Check `report.json` against the archived blocks. The inventory and report retain original date metadata. Set **Entry date** in the editor to show a project date instead of relying on the local save timestamp.

## Review before switching domains

- Compare each public post, About, and Contact with Notion.
- Resolve image and unsupported-block warnings; check equations and tables.
- Check internal links and existing URL slugs.
- Back up the database and media, then run the restore test.
- Inspect a static build at desktop and mobile widths.
- Review a preview deployment before switching the production domain.

Keep `.env`, `.local`, migration archives, database dumps, and personal media out of the public template.

## Existing imports: reusable tags

New imports preserve Notion Tags as reusable tags. For older imports, back up the database and apply migrations, then preview assignments with `npx tsx scripts/import-notion-tags.ts .local/migrations/YOUR-HOST/homepage-source.json`.

Add `--apply` to create the collection's tag options and merge assignments into existing imported drafts. The backfill matches known Notion IDs and preserves article content, categories, and published snapshots. You can repeat it without duplicating assignments. Review the tags, then republish the affected articles.
