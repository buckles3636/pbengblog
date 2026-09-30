import { demos } from "../shared/demo";
import { createPost, listPosts } from "../lib/posts";
import { db } from "../lib/db";
try {
  if (!(await listPosts()).length) {
    for (const demo of demos) await createPost(demo);
    console.log(
      "Created three fictional demo drafts. Publish it from the editor when ready.",
    );
  } else console.log("Posts already exist; seed skipped.");
} finally {
  await db().end();
}
