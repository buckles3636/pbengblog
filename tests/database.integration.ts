import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import {
  createPost,
  savePost,
  publishPost,
  getPost,
  revisions,
  ConflictError,
} from "../lib/posts";
import { demo } from "../shared/demo";
test("database preserves revisions, isolates published snapshots, and rejects competing saves", async () => {
  const ids: string[] = [];
  try {
    const p = await createPost({ ...demo, slug: `test-${randomUUID()}` });
    ids.push(p.id);
    assert.equal((await revisions(p.id)).length, 1);
    const results = await Promise.allSettled([
      savePost(p.id, { ...p, title: "Writer one" }),
      savePost(p.id, { ...p, title: "Writer two" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.filter(
        (r) => r.status === "rejected" && r.reason instanceof ConflictError,
      ).length,
      1,
    );
    const saved = (await getPost(p.id))!;
    assert.equal(saved.version, 2);
    assert.equal((await revisions(p.id)).length, 2);
    await assert.rejects(publishPost(p.id, 1), ConflictError);
    const published = await publishPost(p.id, 2);
    assert.equal(published.published?.title, saved.title);
    const edited = await savePost(p.id, {
      ...published,
      title: "Unpublished edit",
    });
    assert.equal(edited.published?.title, saved.title);
    assert.equal(edited.version, 3);
    await assert.rejects(
      savePost(p.id, { ...edited, slug: `renamed-${randomUUID()}` }),
      ConflictError,
    );
    await assert.rejects(createPost({ ...demo, slug: p.slug }));
    assert.equal((await revisions(p.id)).length, 3);
    await assert.rejects(
      db().query(
        "UPDATE posts SET published = jsonb_set(published,'{slug}','\"wrong-url\"'::jsonb) WHERE id=$1",
        [p.id],
      ),
    );
  } finally {
    for (const id of ids)
      await db().query("DELETE FROM posts WHERE id=$1", [id]);
    await db().end();
  }
});
