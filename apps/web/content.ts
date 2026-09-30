import fs from "node:fs";
import { demos } from "../../shared/demo";
import type { Article } from "../../shared/content";
// A specified empty snapshot is an empty site; demo content is only for template previews.
export const posts: Article[] = process.env.CONTENT_SNAPSHOT
  ? JSON.parse(fs.readFileSync(process.env.CONTENT_SNAPSHOT, "utf8"))
  : demos;
