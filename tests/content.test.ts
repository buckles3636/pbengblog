import test from "node:test";
import assert from "node:assert/strict";
import { draftSchema, safeUrl, headings } from "../shared/content";
import { demo } from "../shared/demo";
import { imageType } from "../lib/media";
import { guard } from "../lib/auth";
import { readBody } from "../lib/http";
test("content accepts equations and nested headings", () => {
  assert.equal(draftSchema.parse(demo).blocks.length, demo.blocks.length);
  assert.equal(headings(demo.blocks).length, 3);
});
test("content rejects malformed nested blocks, duplicate anchors, and unsafe URLs", () => {
  assert.equal(
    draftSchema.safeParse({
      ...demo,
      blocks: [
        {
          id: "x",
          type: "paragraph",
          children: [{ id: "x", type: "paragraph" }],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    draftSchema.safeParse({
      ...demo,
      blocks: [
        {
          id: "x",
          type: "paragraph",
          content: [{ type: "link", href: "javascript:alert(1)", content: [] }],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    draftSchema.safeParse({ ...demo, blocks: [{ id: "x", type: "unknown" }] })
      .success,
    false,
  );
  assert.equal(draftSchema.safeParse({ ...demo, slug: "api" }).success, false);
});
test("URL filtering blocks executable and network-path URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "//evil.test",
    "/\\evil.test",
    "data:text/html,hello",
  ])
    assert.equal(safeUrl(url), undefined);
  assert.equal(safeUrl("/media/test.png"), "/media/test.png");
});
test("uploads reject mislabeled HTML", () => {
  assert.equal(imageType(Buffer.from("<svg onload='alert(1)'/>")), null);
  assert.equal(
    imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))?.mime,
    "image/png",
  );
});
test("request body limits apply even without Content-Length", async () => {
  await assert.rejects(
    readBody(
      new Request("http://localhost", { method: "POST", body: "123456" }),
      3,
    ),
    /too large/,
  );
});
test("writes need authentication and the correct Origin", () => {
  const user = process.env.EDITOR_USERNAME,
    password = process.env.EDITOR_PASSWORD;
  process.env.EDITOR_USERNAME = "test";
  process.env.EDITOR_PASSWORD = "a-long-test-only-password-123";
  const authorization = `Basic ${Buffer.from("test:a-long-test-only-password-123").toString("base64")}`;
  try {
    assert.equal(
      guard(new Request("http://localhost:3011/api/posts"))?.status,
      401,
    );
    assert.equal(
      guard(
        new Request("http://localhost:3011/api/posts", {
          method: "POST",
          headers: { authorization, origin: "https://evil.test" },
        }),
      )?.status,
      403,
    );
    assert.equal(
      guard(
        new Request("http://localhost:3011/api/posts", {
          method: "POST",
          headers: { authorization, origin: "http://localhost:3011" },
        }),
      ),
      undefined,
    );
  } finally {
    if (user === undefined) delete process.env.EDITOR_USERNAME;
    else process.env.EDITOR_USERNAME = user;
    if (password === undefined) delete process.env.EDITOR_PASSWORD;
    else process.env.EDITOR_PASSWORD = password;
  }
});
