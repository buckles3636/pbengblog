import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "../lib/db";
import { createPost, savePost, publishPost, getPost } from "../lib/posts";
import { enqueuePublication, publicationStatus } from "../lib/publications";
import { exportSnapshot } from "../lib/export";
import { demo } from "../shared/demo";
if (!process.env.DATABASE_URL?.endsWith("/publish_test"))
  throw new Error("Use disposable publish_test database");
process.env.PUBLISHER_ENABLED = "true";
test("publication queue is atomic, deduplicated, durable, and isolates drafts", async () => {
  const ids: string[] = [];
  try {
    const first = await createPost({
      ...demo,
      tags: [],
      title: "First publication",
      slug: `test-${randomUUID()}`,
      cover: "",
      blocks: [],
    });
    ids.push(first.id);
    const other = await createPost({
      ...demo,
      tags: [],
      title: "Other published",
      slug: `test-${randomUUID()}`,
      cover: "",
      blocks: [],
    });
    ids.push(other.id);
    const draft = await createPost({
      ...demo,
      tags: [],
      title: "Never publish this draft",
      slug: `test-${randomUUID()}`,
      cover: "",
      blocks: [],
    });
    ids.push(draft.id);
    await publishPost(other.id, other.version);
    await savePost(other.id, { ...other, title: "Other private edit" });
    await db().query("DELETE FROM publisher_state");
    await assert.rejects(
      enqueuePublication(first.id, first.version, randomUUID()),
      /offline/,
    );
    assert.equal((await getPost(first.id))?.published, null);
    await db().query(
      "INSERT INTO publisher_state(id,heartbeat_at) VALUES(true,now()) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()",
    );
    await assert.rejects(
      enqueuePublication(first.id, 999, randomUUID()),
      /Save the current/,
    );
    assert.equal(
      (await db().query("SELECT count(*)::int n FROM publication_jobs")).rows[0]
        .n,
      0,
    );
    const requestId = randomUUID();
    const queued = await Promise.all([
      enqueuePublication(first.id, first.version, requestId),
      enqueuePublication(first.id, first.version, randomUUID()),
    ]);
    assert.equal(queued[0].job.id, queued[1].job.id);
    assert.equal(
      (await enqueuePublication(first.id, first.version, requestId)).job.id,
      queued[0].job.id,
    );
    await assert.rejects(
      enqueuePublication(other.id, other.version + 1, randomUUID()),
      /Another publication/,
    );
    await assert.rejects(
      enqueuePublication(other.id, other.version + 1, requestId),
      /another revision/,
    );
    const saved = await savePost(first.id, {
      ...first,
      title: "Later private edit",
    });
    await db().query(
      "UPDATE publication_jobs SET state='building' WHERE id=$1",
      [queued[0].job.id],
    );
    const release = await exportSnapshot(false, queued[0].job.id);
    const articles = JSON.parse(
      await readFile(`${release.dir}/articles.json`, "utf8"),
    );
    assert.deepEqual(articles.map((p: any) => p.title).sort(), [
      "First publication",
      "Other published",
    ]);
    assert.equal(
      JSON.parse(await readFile(`${release.dir}/manifest.json`, "utf8"))
        .publicationId,
      queued[0].job.id,
    );
    await assert.rejects(
      exportSnapshot(true, queued[0].job.id),
      /cannot export drafts/,
    );
    await db().query("UPDATE publication_jobs SET state='failed' WHERE id=$1", [
      queued[0].job.id,
    ]);
    const retry = await enqueuePublication(
      first.id,
      saved.version,
      randomUUID(),
    );
    assert.notEqual(retry.job.id, queued[0].job.id);
    await db().query(
      "UPDATE publication_jobs SET state='needs_review' WHERE id=$1",
      [retry.job.id],
    );
    await assert.rejects(
      enqueuePublication(first.id, saved.version, randomUUID()),
      /needs review/,
    );
    assert.equal((await publicationStatus()).job.id, retry.job.id);
  } finally {
    await db().query("DELETE FROM publication_jobs");
    for (const id of ids)
      await db().query("DELETE FROM posts WHERE id=$1", [id]);
    await db().end();
  }
});
