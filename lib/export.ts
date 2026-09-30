import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { dataDir } from "./env";
import { db } from "./db";
import { listPosts } from "./posts";
import { draftSchema, type Article } from "../shared/content";
export async function exportSnapshot(preview = false) {
  // One SQL statement observes a consistent view of every published article.
  const result = await db().query(
    "SELECT published FROM posts WHERE published IS NOT NULL ORDER BY updated_at DESC",
  );
  const articles: Article[] = preview
    ? (await listPosts()).map(
        ({ published: _published, notionId: _notionId, ...article }) => article,
      )
    : result.rows.map((r) => r.published);
  const slugs = new Set<string>(),
    media = new Set<string>();
  function walk(value: unknown) {
    if (typeof value === "string" && value.startsWith("/media/"))
      media.add(value.slice(7));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  }
  for (const article of articles) {
    draftSchema.parse(article);
    if (slugs.has(article.slug))
      throw new Error(`Duplicate URL: ${article.slug}`);
    slugs.add(article.slug);
    walk(article);
  }
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const dir = path.join(dataDir, "releases", id);
  await mkdir(path.join(dir, "media"), { recursive: true, mode: 0o700 });
  const checksums: Record<string, string> = {};
  for (const name of media) {
    if (!/^[a-f0-9-]+\.(png|jpg|jpeg|webp|gif)$/.test(name))
      throw new Error(`Invalid media filename: ${name}`);
    const data = await readFile(path.join(dataDir, "uploads", name));
    const hash = createHash("sha256").update(data).digest("hex");
    const row = await db().query("SELECT sha256 FROM media WHERE filename=$1", [
      name,
    ]);
    if (!row.rows[0] || row.rows[0].sha256 !== hash)
      throw new Error(`Media integrity check failed: ${name}`);
    await copyFile(
      path.join(dataDir, "uploads", name),
      path.join(dir, "media", name),
    );
    checksums[name] = hash;
  }
  await writeFile(
    path.join(dir, "articles.json"),
    JSON.stringify(articles, null, 2) + "\n",
  );
  await writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        id,
        preview,
        createdAt: new Date().toISOString(),
        articles: articles.length,
        media: checksums,
      },
      null,
      2,
    ) + "\n",
  );
  const pointer = path.join(
      dataDir,
      "releases",
      preview ? "preview-current.json" : "current.json",
    ),
    temp = `${pointer}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify({ id }) + "\n");
  await rename(temp, pointer);
  return { id, dir, articles: articles.length, images: media.size };
}
