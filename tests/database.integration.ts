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
import { createTag, renameTag } from "../lib/tags";
import { demo } from "../shared/demo";
test("database preserves revisions, isolates published snapshots, and rejects competing saves", async () => {
  const ids: string[] = [];
  const tagIds: string[] = [];
  try {
    const p = await createPost({
      ...demo,
      tags: [],
      slug: `test-${randomUUID()}`,
    });
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
    await assert.rejects(createPost({ ...demo, tags: [], slug: p.slug }));
    assert.equal((await revisions(p.id)).length, 3);
    const tag = await createTag(`Integration ${randomUUID()}`);
    tagIds.push(tag.id);
    const duplicate = await createTag(`  ${tag.name.toUpperCase()}  `);
    assert.equal(duplicate.id, tag.id);
    const tagged = await savePost(p.id, { ...edited, tags: [tag, tag] });
    assert.equal(tagged.tags?.length, 1);
    const taggedPublished = await publishPost(p.id, tagged.version);
    const renamed = await renameTag(tag.id, `${tag.name} renamed`, tag.name);
    assert.equal((await getPost(p.id))?.tags?.[0].name, renamed.name);
    assert.equal((await getPost(p.id))?.published?.tags?.[0].name, tag.name);
    await assert.rejects(renameTag(tag.id, "stale rename", tag.name));
    const republished = await publishPost(p.id, tagged.version);
    assert.equal(republished.published?.tags?.[0].name, renamed.name);
    await assert.rejects(
      savePost(p.id, {
        ...tagged,
        tags: [{ id: randomUUID(), name: "Missing" }],
      }),
    );
    assert.equal((await getPost(p.id))?.version, tagged.version);
    const removed = await savePost(p.id, { ...taggedPublished, tags: [] });
    assert.deepEqual(removed.tags, []);
    const restored = await savePost(p.id, { ...removed, tags: [tag] });
    assert.equal(restored.tags?.[0].name, renamed.name);
    assert.equal(
      (await revisions(p.id))[0].snapshot.tags[0].name,
      renamed.name,
    );
    await assert.rejects(
      db().query(
        "UPDATE posts SET published = jsonb_set(published,'{slug}','\"wrong-url\"'::jsonb) WHERE id=$1",
        [p.id],
      ),
    );
  } finally {
    for (const id of ids)
      await db().query("DELETE FROM posts WHERE id=$1", [id]);
    for (const id of tagIds)
      await db().query("DELETE FROM tags WHERE id=$1", [id]);
    await db().end();
  }
});
