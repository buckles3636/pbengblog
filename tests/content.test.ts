import test from "node:test";
import assert from "node:assert/strict";
import { draftSchema, safeUrl, headings } from "../shared/content";
import { demo } from "../shared/demo";
import { imageType } from "../lib/media";
import {
  credentialsMatch,
  sameOrigin,
  sessionCookie,
  sessionToken,
} from "../lib/auth";
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
test("credentials accept an owner-selected password and reject invalid input", () => {
  const password = process.env.EDITOR_PASSWORD;
  process.env.EDITOR_PASSWORD = "test-pass!";
  try {
    assert.equal(credentialsMatch("test-pass!"), true);
    assert.equal(credentialsMatch("wrong"), false);
    assert.equal(credentialsMatch(null), false);
    assert.equal(credentialsMatch({}), false);
    process.env.EDITOR_PASSWORD = "";
    assert.equal(credentialsMatch(""), false);
  } finally {
    if (password === undefined) delete process.env.EDITOR_PASSWORD;
    else process.env.EDITOR_PASSWORD = password;
  }
});
test("origin checks and HTTPS cookie protections cannot use forwarded headers", () => {
  const origin = process.env.EDITOR_ORIGIN;
  process.env.EDITOR_ORIGIN = "https://editor.example.com";
  try {
    assert.equal(
      sameOrigin(
        new Request("http://localhost", {
          headers: { origin: "https://editor.example.com" },
        }),
      ),
      true,
    );
    assert.equal(
      sameOrigin(
        new Request("http://localhost", {
          headers: {
            origin: "https://evil.test",
            "x-forwarded-host": "evil.test",
          },
        }),
      ),
      false,
    );
    assert.equal(sameOrigin(new Request("http://localhost")), false);
    assert.match(
      sessionCookie("x"),
      /__Host-pb-session=x; Path=\/; HttpOnly; SameSite=Strict; Max-Age=43200; Secure/,
    );
    assert.match(sessionCookie("", true), /Max-Age=0; Secure/);
    assert.equal(
      sessionToken(
        new Request("http://localhost", {
          headers: { cookie: "__Host-pb-session=invalid" },
        }),
      ),
      undefined,
    );
  } finally {
    if (origin === undefined) delete process.env.EDITOR_ORIGIN;
    else process.env.EDITOR_ORIGIN = origin;
  }
});
