import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { PoolClient } from "pg";
import { draftSchema, type Post, type Article } from "../shared/content";
import { assignTags, postTagsSql } from "./tags";
export class ConflictError extends Error {}
function fromRow(row: Record<string, any>): Post {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    category: row.category,
    tags: row.tags ?? [],
    cover: row.cover,
    blocks: row.blocks,
    version: row.version,
    published: row.published,
    notionId: row.notion_id,
    updatedAt: new Date(row.updated_at).toISOString(),
    entryDate: row.entry_date ?? "",
  };
}
export async function listPosts(): Promise<Post[]> {
  const r = await db().query(
    `SELECT posts.*, ${postTagsSql} FROM posts ORDER BY updated_at DESC`,
  );
  return r.rows.map(fromRow);
}
export async function getPost(id: string): Promise<Post | null> {
  const r = await db().query(
    `SELECT posts.*, ${postTagsSql} FROM posts WHERE id = $1`,
    [id],
  );
  return r.rows[0] ? fromRow(r.rows[0]) : null;
}
export async function createPost(
  input: unknown,
  notionId?: string,
): Promise<Post> {
  const draft = draftSchema.parse(input),
    id = randomUUID();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      "INSERT INTO posts (id,slug,title,summary,category,cover,blocks,notion_id,entry_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [
        id,
        draft.slug,
        draft.title,
        draft.summary,
        draft.category,
        draft.cover,
        JSON.stringify(draft.blocks),
        notionId ?? null,
        draft.entryDate,
      ],
    );
    const post = fromRow(r.rows[0]);
    post.tags = await assignTags(client, id, draft.tags);
    await client.query(
      "INSERT INTO revisions (post_id,version,snapshot) VALUES ($1,1,$2)",
      [id, JSON.stringify(post)],
    );
    await client.query("COMMIT");
    return post;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function savePost(id: string, input: unknown): Promise<Post> {
  const draft = draftSchema.parse(input);
  if (!draft.version) throw new ConflictError("A version is required.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const old = await client.query(
      "SELECT published FROM posts WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (old.rows[0]?.published && old.rows[0].published.slug !== draft.slug)
      throw new ConflictError(
        "Published URLs are permanent. Keep the original slug.",
      );
    const r = await client.query(
      "UPDATE posts SET slug=$2,title=$3,summary=$4,category=$5,cover=$6,blocks=$7,entry_date=$9,version=version+1,updated_at=now() WHERE id=$1 AND version=$8 RETURNING *",
      [
        id,
        draft.slug,
        draft.title,
        draft.summary,
        draft.category,
        draft.cover,
        JSON.stringify(draft.blocks),
        draft.version,
        draft.entryDate,
      ],
    );
    if (!r.rows[0])
      throw new ConflictError(
        "This post changed in another tab. Reload before saving.",
      );
    const post = fromRow(r.rows[0]);
    post.tags = await assignTags(client, id, draft.tags);
    await client.query(
      "INSERT INTO revisions (post_id,version,snapshot) VALUES ($1,$2,$3)",
      [id, post.version, JSON.stringify(post)],
    );
    await client.query("COMMIT");
    return post;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function publishPostInTransaction(
  client: PoolClient,
  id: string,
  version: number,
): Promise<Post> {
  const r = await client.query(
    `SELECT posts.*, ${postTagsSql} FROM posts WHERE id=$1 FOR UPDATE`,
    [id],
  );
  if (!r.rows[0] || r.rows[0].version !== version)
    throw new ConflictError("Save the current draft before publishing.");
  const post = fromRow(r.rows[0]);
  const { published: _, notionId: __, ...snapshot } = post;
  // Reject collisions with another published URL, even if its draft has been renamed.
  const collision = await client.query(
    "SELECT id FROM posts WHERE id<>$1 AND published->>'slug'=$2",
    [id, post.slug],
  );
  if (collision.rowCount)
    throw new ConflictError("That URL already belongs to a published post.");
  await client.query("UPDATE posts SET published=$2 WHERE id=$1", [
    id,
    JSON.stringify(snapshot),
  ]);
  return { ...post, published: snapshot as Article };
}
export async function publishPost(id: string, version: number): Promise<Post> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const post = await publishPostInTransaction(client, id, version);
    await client.query("COMMIT");
    return post;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revisions(id: string) {
  const r = await db().query(
    "SELECT version,created_at,snapshot FROM revisions WHERE post_id=$1 ORDER BY version DESC LIMIT 50",
    [id],
  );
  return r.rows;
}
