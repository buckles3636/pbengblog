import { createTag } from "../lib/tags";
import { demos } from "../shared/demo";
import { createPost, listPosts } from "../lib/posts";
import { db } from "../lib/db";
try {
  if (!(await listPosts()).length) {
    for (const demo of demos) {
      const tags = await Promise.all(
        (demo.tags ?? []).map((tag) => createTag(tag.name)),
      );
      await createPost({ ...demo, tags });
    }
    console.log(
      "Created three fictional demo drafts. Publish it from the editor when ready.",
    );
  } else console.log("Posts already exist; seed skipped.");
} finally {
  await db().end();
}
