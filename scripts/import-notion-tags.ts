// Backfill tags on already migrated posts without changing their content or published snapshots.
import { readFile } from "node:fs/promises";
import { db } from "../lib/db";
import { getPost, savePost } from "../lib/posts";
import { createTag } from "../lib/tags";
import { unwrap, plain } from "../lib/notion-import";
const file = process.argv[2];
if (!file)
  throw Error(
    "Usage: tsx scripts/import-notion-tags.ts homepage-source.json [--apply]",
  );
const apply = process.argv.includes("--apply");
const source = JSON.parse(await readFile(file, "utf8"));
const root = source.recordMap ?? source.props?.pageProps?.recordMap;
if (!root) throw Error("Notion record map not found");
const collections = Object.values(root.collection ?? {}).map(unwrap);
const blocks = Object.values(root.block ?? {}).map(unwrap);
try {
  for (const collection of collections) {
    const entry = Object.entries(collection.schema ?? {}).find(
      ([, value]: any) =>
        value.type === "multi_select" && value.name === "Tags",
    );
    if (!entry) continue;
    const [key, schema] = entry as [string, any];
    // Keep unused options as reusable tags too.
    if (apply)
      for (const option of schema.options ?? []) await createTag(option.value);
    for (const block of blocks.filter(
      (b: any) => b.type === "page" && b.parent_id === collection.id,
    )) {
      const found = await db().query(
        "SELECT id FROM posts WHERE notion_id=$1",
        [block.id],
      );
      if (!found.rows[0]) continue; // Never import private/unmigrated source pages.
      const post = (await getPost(found.rows[0].id))!;
      const names = plain(block.properties?.[key])
        .split(",")
        .map((name: string) => name.trim())
        .filter(Boolean);
      console.log(`${post.slug}: ${names.join(" | ") || "(no tags)"}`);
      if (!apply) continue;
      const tags = await Promise.all(
        names.map((name: string) => createTag(name)),
      );
      const merged = [
        ...new Map(
          [...(post.tags ?? []), ...tags].map((tag) => [tag.id, tag]),
        ).values(),
      ];
      if (merged.length !== (post.tags ?? []).length)
        await savePost(post.id, { ...post, tags: merged });
    }
  }
} finally {
  await db().end();
}
