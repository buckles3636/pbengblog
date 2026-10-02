import { randomUUID } from "node:crypto";
import { db } from "./db";
import { publishPostInTransaction, ConflictError } from "./posts";
import { HttpError } from "./http";
import { draftSchema } from "../shared/content";
const fields =
  "id,post_id,post_version,title,state,message,created_at,updated_at";
export async function publicationStatus() {
  const enabled = process.env.PUBLISHER_ENABLED === "true";
  if (!enabled) return { enabled, available: false, siteUrl: null, job: null };
  const [heartbeat, latest] = await Promise.all([
    db().query(
      "SELECT heartbeat_at>now()-interval '45 seconds' AS available FROM publisher_state WHERE id=true",
    ),
    db().query(
      `SELECT ${fields} FROM publication_jobs ORDER BY created_at DESC LIMIT 1`,
    ),
  ]);
  let siteUrl: string | null = null;
  try {
    const url = new URL(process.env.SITE_URL || "");
    if (["https:", "http:"].includes(url.protocol)) siteUrl = url.origin;
  } catch {}
  return {
    enabled,
    available: heartbeat.rows[0]?.available === true,
    siteUrl,
    job: latest.rows[0] || null,
  };
}
export async function enqueuePublication(
  postId: string,
  version: number,
  requestId: string,
) {
  if (process.env.PUBLISHER_ENABLED !== "true")
    throw new HttpError(503, "Website publishing is not configured.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(563632026)");
    const existing = await client.query(
      `SELECT ${fields} FROM publication_jobs WHERE request_id=$1`,
      [requestId],
    );
    if (existing.rows[0]) {
      const job = existing.rows[0];
      if (job.post_id !== postId || job.post_version !== version)
        throw new ConflictError(
          "This publish request already belongs to another revision.",
        );
      await client.query("COMMIT");
      return { job };
    }
    const active = await client.query(
      `SELECT ${fields} FROM publication_jobs WHERE state IN ('queued','building','deploying','needs_review') LIMIT 1`,
    );
    if (active.rows[0]) {
      const job = active.rows[0];
      if (
        job.post_id === postId &&
        job.post_version === version &&
        job.state !== "needs_review"
      ) {
        await client.query("COMMIT");
        return { job };
      }
      throw new ConflictError(
        job.state === "needs_review"
          ? "The last deployment needs review before publishing again."
          : "Another publication is running. Wait for it to finish.",
      );
    }
    const health = await client.query(
      "SELECT 1 FROM publisher_state WHERE id=true AND heartbeat_at>now()-interval '45 seconds'",
    );
    if (!health.rowCount)
      throw new HttpError(
        503,
        "The publisher is offline. Your draft is saved; try publishing again shortly.",
      );
    const post = await publishPostInTransaction(client, postId, version);
    // Freeze one consistent view. Drafts from other posts never enter the job.
    const result = await client.query(
      "SELECT published FROM posts WHERE published IS NOT NULL ORDER BY updated_at DESC",
    );
    const articles = result.rows.map((row) => row.published);
    for (const article of articles) draftSchema.parse(article);
    const job = await client.query(
      `INSERT INTO publication_jobs(id,request_id,post_id,post_version,title,articles)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${fields}`,
      [
        randomUUID(),
        requestId,
        postId,
        version,
        post.title,
        JSON.stringify(articles),
      ],
    );
    await client.query("COMMIT");
    return { job: job.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
