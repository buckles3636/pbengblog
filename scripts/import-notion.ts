import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { dataDir } from "../lib/env";
import { db } from "../lib/db";
import { createTag } from "../lib/tags";
import { createPost } from "../lib/posts";
import { storeImage } from "../lib/media";
import {
  convertPage,
  unwrap,
  plain,
  type NotionBlock,
} from "../lib/notion-import";
import { draftSchema } from "../shared/content";
const args = process.argv.slice(2),
  argument = (name: string) => args[args.indexOf(name) + 1];
if (!args.includes("--site"))
  throw new Error(
    "Usage: npm run import:notion -- --site https://your-site.example [--apply] [--limit 1]",
  );
const site = new URL(argument("--site"));
if (!["https:", "http:"].includes(site.protocol))
  throw new Error("Expected website URL");
const apply = args.includes("--apply"),
  limit = args.includes("--limit") ? Number(argument("--limit")) : 100;
const dir = path.join(dataDir, "migrations", site.hostname);
await mkdir(dir, { recursive: true, mode: 0o700 });
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function notion(endpoint: string, body: unknown): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://www.notion.so/api/v3/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PBEngBlog/0.1 content migration",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      await delay(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`Notion ${endpoint}: HTTP ${response.status}`);
  }
  throw new Error(`Notion ${endpoint}: retry limit reached`);
}
async function fetchPage(id: string): Promise<Record<string, NotionBlock>> {
  const file = path.join(dir, `${id}.source.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {}
  const records: Record<string, NotionBlock> = {};
  let cursor: any = { stack: [] };
  const cursors = new Set<string>();
  for (let chunk = 0; chunk < 500; chunk++) {
    const result = await notion("loadPageChunk", {
      pageId: id,
      limit: 100,
      cursor,
      chunkNumber: chunk,
      verticalColumns: false,
    });
    for (const [key, value] of Object.entries(result.recordMap?.block ?? {}))
      records[key] = unwrap(value);
    cursor = result.cursor;
    if (!cursor?.stack?.length) break;
    const key = JSON.stringify(cursor);
    if (cursors.has(key))
      throw new Error("Notion pagination stopped progressing");
    cursors.add(key);
    if (chunk === 499) throw new Error("Notion page exceeds chunk limit");
    await delay(150);
  }
  for (let pass = 0; pass < 20; pass++) {
    const missing = new Set<string>();
    const visited = new Set<string>();
    function visit(key: string) {
      if (visited.has(key)) return;
      visited.add(key);
      const b = records[key];
      if (!b) {
        missing.add(key);
        return;
      }
      if (key !== id && b.type === "page") return;
      (b.content ?? []).forEach(visit);
    }
    visit(id);
    if (!missing.size) break;
    const ids = [...missing];
    for (let i = 0; i < ids.length; i += 100) {
      const result = await notion("syncRecordValuesMain", {
        requests: ids
          .slice(i, i + 100)
          .map((id) => ({ id, table: "block", version: -1 })),
      });
      for (const [key, value] of Object.entries(result.recordMap?.block ?? {}))
        records[key] = unwrap(value);
      await delay(150);
    }
    if (ids.every((key) => !records[key])) break;
  }
  if (records[id]?.type !== "page" || records[id]?.alive === false)
    throw new Error("Page unavailable");
  await writeFile(file, JSON.stringify(records), { mode: 0o600 });
  return records;
}
function decode(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
const html = await (
  await fetch(site, { signal: AbortSignal.timeout(30000) })
).text();
const serialized = html.match(
  /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
)?.[1];
if (!serialized)
  throw new Error(
    "This importer expects a nextjs-notion-starter-kit homepage. Use a Notion export for other sites.",
  );
const pageProps = JSON.parse(serialized).props.pageProps,
  root = pageProps.recordMap;
await writeFile(
  path.join(dir, "homepage-source.json"),
  JSON.stringify(pageProps),
  { mode: 0o600 },
);
const pages = Object.values(root.block ?? {})
  .map(unwrap)
  .filter((b: any) => b.type === "page" && plain(b.properties?.title));
const links = [
  ...html.matchAll(/<a\b[^>]*href="(\/[^"?#]+)"[^>]*>(.*?)<\/a>/gs),
]
  .map((m) => ({
    slug: decode(m[1]).slice(1),
    text: decode(m[2].replace(/<[^>]+>/g, "")),
  }))
  .filter((l) => !l.slug.includes("/"));
const collections = Object.values(root.collection ?? {}).map(unwrap);
function property(b: any, name: string) {
  const collection =
    collections.find((c: any) => c.id === b.parent_id) || collections[0];
  const key = Object.entries(collection?.schema ?? {}).find(
    ([, s]: any) => s.name === name,
  )?.[0];
  return key ? b.properties?.[key] : undefined;
}
const inventory = pages
  .filter(
    (p: any) => p.id.replace(/-/g, "") !== pageProps.pageId.replace(/-/g, ""),
  )
  .map((p: any) => {
    const title = plain(p.properties?.title),
      link = links.find((l) => l.text.includes(title));
    return {
      id: p.id,
      title,
      slug: link?.slug ?? null,
      public: plain(property(p, "Public")) !== "No",
      summary: plain(property(p, "Description")),
      category: p.parent_table === "collection" ? "Projects" : "Pages",
      tags: plain(property(p, "Tags"))
        .split(",")
        .map((name: string) => name.trim())
        .filter(Boolean),
      sourcePublished: property(p, "Published"),
      sourceCreated: p.created_time,
      sourceEdited: p.last_edited_time,
    };
  });
await writeFile(
  path.join(dir, "inventory.json"),
  JSON.stringify(inventory, null, 2),
  { mode: 0o600 },
);
console.log(
  `Found ${inventory.filter((p: any) => p.public && p.slug).length} linked public pages; ${inventory.filter((p: any) => !p.public).length} non-public records excluded.`,
);
if (!apply) {
  console.log(
    `Inventory saved to ${dir}. Add --apply to import public pages as drafts.`,
  );
  process.exit(0);
}
const routes = new Map<string, string>(
  inventory
    .filter((p: any) => p.public && p.slug)
    .map((p: any) => [p.id.replace(/-/g, ""), p.slug]),
);
const report: any[] = [];
let previousReport: any[] = [];
try {
  previousReport = JSON.parse(
    await readFile(path.join(dir, "report.json"), "utf8"),
  );
} catch {}
async function downloadImage(id: string, url: string): Promise<string> {
  const cacheFile = path.join(
    dir,
    `image-${createHash("sha256")
      .update(id + url)
      .digest("hex")}.json`,
  );
  try {
    const cached = JSON.parse(await readFile(cacheFile, "utf8"));
    if (
      (
        await db().query("SELECT 1 FROM media WHERE filename=$1", [
          cached.url.slice(7),
        ])
      ).rowCount
    )
      return cached.url;
  } catch {}
  let source = url.startsWith("/") ? `https://www.notion.so${url}` : url;
  if (
    /(?:prod-files-secure|secure.notion-static.com|attachment:)/.test(source)
  ) {
    const signed = await notion("getSignedFileUrls", {
      urls: [{ permissionRecord: { table: "block", id }, url: source }],
    });
    source = signed.signedUrls?.[0] ?? source;
  }
  const target = new URL(source);
  if (target.protocol !== "https:") throw new Error("Image must use HTTPS");
  const response = await fetch(target, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get("content-length") ?? 0) > 12 * 1024 * 1024)
    throw new Error("Image exceeds 12 MB");
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 12 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Image exceeds 12 MB");
    }
    chunks.push(value);
  }
  const stored = await storeImage(
    Buffer.concat(chunks),
    decodeURIComponent(target.pathname.split("/").pop() || "Notion image"),
  );
  await writeFile(cacheFile, JSON.stringify(stored), { mode: 0o600 });
  return stored.url;
}
try {
  for (const entry of inventory
    .filter((p: any) => p.public && p.slug)
    .slice(0, limit)) {
    if (
      (await db().query("SELECT id FROM posts WHERE notion_id=$1", [entry.id]))
        .rowCount
    ) {
      console.log(`Already imported: ${entry.title}`);
      report.push(
        previousReport.find(
          (p) => p.id === entry.id && p.status === "imported-draft",
        ) ?? { ...entry, status: "skipped-existing" },
      );
      continue;
    }
    console.log(`Importing ${entry.title}`);
    const warnings: string[] = [];
    try {
      const records = await fetchPage(entry.id),
        media = new Map<string, string>(),
        seen = new Set<string>();
      const images: NotionBlock[] = [];
      function visit(id: string) {
        if (seen.has(id)) return;
        seen.add(id);
        const b = records[id];
        if (!b) return;
        if (id !== entry.id && b.type === "page") return;
        if (b.type === "image") images.push(b);
        (b.content ?? []).forEach(visit);
      }
      visit(entry.id);
      for (const image of images) {
        try {
          const url =
            plain(image.properties?.source) || image.format?.display_source;
          if (!url) throw new Error("Missing source URL");
          media.set(image.id, await downloadImage(image.id, url));
        } catch (e) {
          warnings.push(`Image ${image.id}: ${(e as Error).message}`);
        }
      }
      let cover = "";
      if (records[entry.id].format?.page_cover) {
        try {
          cover = await downloadImage(
            entry.id,
            records[entry.id].format!.page_cover,
          );
        } catch (e) {
          warnings.push(`Cover: ${(e as Error).message}`);
        }
      }
      const converted = convertPage(entry.id, records, routes, media);
      warnings.push(...converted.warnings);
      const draft = draftSchema.parse({
        title: entry.title,
        slug: entry.slug,
        summary: entry.summary.slice(0, 1000),
        category: entry.category.slice(0, 100),
        tags: await Promise.all(
          entry.tags.map((name: string) => createTag(name)),
        ),
        cover,
        blocks: converted.blocks,
      });
      const post = await createPost(draft, entry.id);
      await db().query(
        "INSERT INTO imports (source_id,post_id,source_url,warnings) VALUES ($1,$2,$3,$4)",
        [
          entry.id,
          post.id,
          `${site.origin}/${entry.slug}`,
          JSON.stringify(warnings),
        ],
      );
      report.push({
        ...entry,
        status: "imported-draft",
        postId: post.id,
        blocks: converted.sourceBlocks,
        images: media.size,
        warnings,
      });
      console.log(
        `  Draft saved: ${converted.sourceBlocks} source blocks, ${media.size} images, ${warnings.length} review notes`,
      );
    } catch (e) {
      report.push({
        ...entry,
        status: "failed",
        error: (e as Error).message,
        warnings,
      });
      console.error(`  Failed: ${(e as Error).message}`);
      process.exitCode = 1;
    }
    await writeFile(
      path.join(dir, "report.json"),
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
  }
} finally {
  await db().end();
}
console.log(
  `Migration report: ${path.join(dir, "report.json")}. All imports remain unpublished drafts.`,
);
