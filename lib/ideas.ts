import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./http";
import {
  ideaInputSchema,
  ideaSaveSchema,
  type ProjectIdea,
} from "../shared/ideas";
const tagsSql = `COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) ORDER BY lower(t.name),t.id) FROM idea_tags it JOIN tags t ON t.id=it.tag_id WHERE it.idea_id=project_ideas.id),'[]'::jsonb) AS tags`;
function fromRow(row: any): ProjectIdea {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    done: row.done,
    version: row.version,
    updatedAt: new Date(row.updated_at).toISOString(),
    tags: row.tags ?? [],
  };
}
export async function listIdeas(): Promise<ProjectIdea[]> {
  return (
    await db().query(
      `SELECT project_ideas.*, ${tagsSql} FROM project_ideas ORDER BY done,created_at DESC,id`,
    )
  ).rows.map(fromRow);
}
export async function writeIdea(
  input: unknown,
  id?: string,
): Promise<ProjectIdea> {
  if (id) z.uuid().parse(id);
  const value = id ? ideaSaveSchema.parse(input) : ideaInputSchema.parse(input);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const ids = [...new Set(value.tags.map((t) => t.id))].sort();
    const tags = await client.query(
      "SELECT id,name FROM tags WHERE id=ANY($1::uuid[]) ORDER BY lower(name),id FOR SHARE",
      [ids],
    );
    if (tags.rowCount !== ids.length)
      throw new HttpError(
        400,
        "Unknown tag. Reload the list and choose an existing tag.",
      );
    const result = id
      ? await client.query(
          "UPDATE project_ideas SET title=$2,details=$3,done=$4,version=version+1,updated_at=now() WHERE id=$1 AND version=$5 RETURNING *",
          [
            id,
            value.title,
            value.details,
            value.done,
            "version" in value ? value.version : null,
          ],
        )
      : await client.query(
          "INSERT INTO project_ideas(id,title,details,done) VALUES($1,$2,$3,$4) RETURNING *",
          [randomUUID(), value.title, value.details, value.done],
        );
    if (!result.rows[0])
      throw new HttpError(
        409,
        "This idea changed or was deleted in another tab. Your edits are still here; copy them before reloading.",
      );
    const idea = fromRow(result.rows[0]);
    await client.query("DELETE FROM idea_tags WHERE idea_id=$1", [idea.id]);
    await client.query(
      "INSERT INTO idea_tags(idea_id,tag_id) SELECT $1,unnest($2::uuid[])",
      [idea.id, ids],
    );
    await client.query("COMMIT");
    return { ...idea, tags: tags.rows };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function deleteIdea(id: string, version: unknown) {
  z.uuid().parse(id);
  const expected = z.number().int().positive().parse(version);
  const result = await db().query(
    "DELETE FROM project_ideas WHERE id=$1 AND version=$2 RETURNING id",
    [id, expected],
  );
  if (!result.rowCount)
    throw new HttpError(
      409,
      "This idea changed or was deleted in another tab. Reload before removing it.",
    );
}
