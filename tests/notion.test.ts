import test from "node:test";
import assert from "node:assert/strict";
import { convertPage, rich, unwrap, rewriteLink } from "../lib/notion-import";
import { draftSchema } from "../shared/content";
import { demo } from "../shared/demo";
test("Notion nested wrappers, equations, links, and missing-image warnings survive conversion", () => {
  assert.deepEqual(unwrap({ value: { value: { id: "p" }, role: "reader" } }), {
    id: "p",
  });
  const routes = new Map([
    ["123456781234123412341234567890ab", "original-url"],
  ]);
  assert.equal(
    rewriteLink(
      "https://www.notion.so/123456781234123412341234567890ab",
      routes,
    ),
    "/original-url",
  );
  assert.deepEqual(rich([["equation", [["e", "x^2"]]]], routes, []), [
    { type: "math", content: "x^2" },
  ]);
  const converted = convertPage(
    "root",
    {
      root: { id: "root", type: "page", content: ["h", "e", "i", "u"] },
      h: { id: "h", type: "header", properties: { title: [["Design"]] } },
      e: { id: "e", type: "equation", properties: { title: [["E=mc^2"]] } },
      i: { id: "i", type: "image" },
      u: {
        id: "u",
        type: "unknown_type",
        properties: { title: [["Preserve me"]] },
      },
    },
    routes,
    new Map(),
  );
  assert.equal(converted.blocks[0].type, "heading");
  assert.equal(converted.blocks[1].type, "mathBlock");
  assert.equal(converted.warnings.length, 2);
  assert.match(JSON.stringify(converted.blocks), /Preserve me/);
  assert.equal(
    draftSchema.safeParse({ ...demo, blocks: converted.blocks }).success,
    true,
  );
});
