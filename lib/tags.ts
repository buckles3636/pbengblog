import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./db";
import { tagNameSchema, type Tag } from "../shared/content";
import { HttpError } from "./http";
export async function listTags(): Promise<Tag[]> {
  return (await db().query("SELECT id,name FROM tags ORDER BY lower(name),id"))
    .rows;
}
export async function createTag(input: unknown): Promise<Tag> {
  const name = tagNameSchema.parse(input);
  // Reuse an existing spelling; concurrent creates also return the same tag.
  return (
    await db().query(
      "INSERT INTO tags(id,name) VALUES($1,$2) ON CONFLICT (lower(name)) DO UPDATE SET name=tags.name RETURNING id,name",
      [randomUUID(), name],
    )
  ).rows[0];
}
export async function renameTag(
  id: string,
  input: unknown,
  expected: unknown,
): Promise<Tag> {
  const name = tagNameSchema.parse(input),
    previous = tagNameSchema.parse(expected);
  try {
    const r = await db().query(
      "UPDATE tags SET name=$2 WHERE id=$1 AND name=$3 RETURNING id,name",
      [id, name, previous],
    );
    if (!r.rows[0])
      throw new HttpError(
        409,
        "Tag changed in another tab. Reload tags before renaming.",
      );
    return r.rows[0];
  } catch (e: any) {
    if (e.code === "23505")
      throw new HttpError(409, "A tag with that name already exists.");
    throw e;
  }
}
export const postTagsSql = `COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) ORDER BY lower(t.name),t.id) FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=posts.id),'[]'::jsonb) AS tags`;
export async function assignTags(
  client: PoolClient,
  postId: string,
  tags: Tag[],
): Promise<Tag[]> {
  const ids = [...new Set(tags.map((t) => t.id))].sort();
  const result = await client.query(
    "SELECT id,name FROM tags WHERE id=ANY($1::uuid[]) ORDER BY lower(name),id FOR SHARE",
    [ids],
  );
  if (result.rowCount !== ids.length)
    throw new HttpError(
      400,
      "Unknown tag. Reload tags and choose an existing tag.",
    );
  await client.query("DELETE FROM post_tags WHERE post_id=$1", [postId]);
  await client.query(
    "INSERT INTO post_tags(post_id,tag_id) SELECT $1,unnest($2::uuid[])",
    [postId, ids],
  );
  return result.rows;
}
