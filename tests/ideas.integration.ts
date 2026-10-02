import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";
import { listIdeas, writeIdea, deleteIdea } from "../lib/ideas";
import { createTag, renameTag } from "../lib/tags";
import { exportSnapshot } from "../lib/export";
if (!process.env.DATABASE_URL?.endsWith("/publish_test"))
  throw Error("Use isolated publish_test database");
test("ideas reject concurrent/stale writes, roll back invalid tags, and never enter exports", async () => {
  let id = "",
    tagId = "";
  try {
    const name = "Idea test " + randomUUID();
    const tag = await createTag(name);
    tagId = tag.id;
    assert.equal((await createTag(name.toLowerCase())).id, tag.id);
    const idea = await writeIdea({
      title: "Private idea " + randomUUID(),
      details: "Not a public article",
      tags: [tag, tag],
    });
    id = idea.id;
    assert.equal(idea.tags.length, 1);
    const writes = await Promise.allSettled([
      writeIdea({ ...idea, details: "First tab" }, id),
      writeIdea({ ...idea, details: "Second tab" }, id),
    ]);
    assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
    let current = (await listIdeas()).find((i) => i.id === id)!;
    assert.equal(current.version, 2);
    await assert.rejects(
      writeIdea(
        { ...current, tags: [{ id: randomUUID(), name: "Missing" }] },
        id,
      ),
    );
    assert.equal((await listIdeas()).find((i) => i.id === id)!.version, 2);
    await renameTag(tag.id, "Renamed " + tag.id, name);
    current = (await listIdeas()).find((i) => i.id === id)!;
    assert.equal(current.tags[0].name, "Renamed " + tag.id);
    for (const preview of [false, true]) {
      const release = await exportSnapshot(preview);
      const exported = await readFile(
        path.join(release.dir, "articles.json"),
        "utf8",
      );
      assert.ok(!exported.includes(id));
      assert.ok(!exported.includes(idea.title));
    }
    await assert.rejects(deleteIdea(id, 1));
    await deleteIdea(id, current.version);
    assert.equal(
      (await db().query("SELECT * FROM idea_tags WHERE idea_id=$1", [id]))
        .rowCount,
      0,
    );
  } finally {
    if (id) await db().query("DELETE FROM project_ideas WHERE id=$1", [id]);
    if (tagId) await db().query("DELETE FROM tags WHERE id=$1", [tagId]);
    await db().end();
  }
});
