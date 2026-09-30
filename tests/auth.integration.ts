import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import {
  authorized,
  createSession,
  guard,
  loginAllowance,
  revokeSession,
  sessionCookie,
  trustedProxy,
} from "../lib/auth";
if (!process.env.DATABASE_URL?.endsWith("/auth_test"))
  throw new Error("Use the isolated auth_test database");
process.env.EDITOR_ORIGIN = "https://editor.example.com";
process.env.EDITOR_USERNAME = "test";
process.env.EDITOR_PASSWORD = "short-test!";
process.env.EDITOR_SESSION_SECRET =
  "independent-test-session-secret-32-characters";
process.env.EDITOR_PROXY_SECRET = "independent-test-proxy-secret-32-characters";
const proxyHeaders = { "x-editor-proxy-key": process.env.EDITOR_PROXY_SECRET };
const req = (token = "", extra: Record<string, string> = {}, method = "GET") =>
  new Request("http://127.0.0.1:3011/api/posts", {
    method,
    headers: {
      ...proxyHeaders,
      cookie: sessionCookie(token).split(";")[0],
      ...extra,
    },
  });
test("sessions expire, revoke on logout/credential rotation, and enforce origin/proxy boundaries", async () => {
  assert.equal(trustedProxy(new Request("http://localhost")), false);
  assert.equal((await guard(new Request("http://localhost")))?.status, 404);
  assert.equal(await authorized(req()), false);
  const token = await createSession();
  assert.equal(await authorized(req(token)), true);
  assert.equal(await authorized(req("A".repeat(43))), false);
  assert.equal(
    (await guard(req(token, { origin: "https://evil.test" }, "POST")))?.status,
    403,
  );
  assert.equal(
    await guard(req(token, { origin: "https://editor.example.com" }, "POST")),
    undefined,
  );
  assert.equal((await guard(req(token, {}, "POST")))?.status, 403);
  process.env.EDITOR_PASSWORD = "changed-test!";
  assert.equal(await authorized(req(token)), false);
  process.env.EDITOR_PASSWORD = "short-test!";
  await revokeSession(req(token));
  assert.equal(await authorized(req(token)), false);
  const expired = await createSession();
  await db().query(
    "UPDATE editor_sessions SET expires_at=now()-interval '1 second'",
  );
  assert.equal(await authorized(req(expired)), false);
  const duplicate = await createSession();
  assert.equal(
    await authorized(
      req(duplicate, {
        cookie: `${sessionCookie(duplicate).split(";")[0]}; ${sessionCookie(duplicate).split(";")[0]}`,
      }),
    ),
    false,
  );
});
test("concurrent login attempts cannot bypass per-client or global rate limits", async () => {
  await db().query("DELETE FROM editor_login_limits");
  const request = req("", { "x-vercel-forwarded-for": "192.0.2.1" });
  const results = await Promise.all(
    Array.from({ length: 15 }, () => loginAllowance(request)),
  );
  assert.equal(results.filter((value) => value === 0).length, 10);
  assert.equal(results.filter((value) => value > 0).length, 5);
  assert.equal(
    await loginAllowance(req("", { "x-vercel-forwarded-for": "192.0.2.2" })),
    0,
  );
  await db().query(
    "UPDATE editor_login_limits SET resets_at=now()-interval '1 second'",
  );
  assert.equal(await loginAllowance(request), 0);
  await db().query(
    "UPDATE editor_login_limits SET attempts=100 WHERE bucket='global'",
  );
  assert.ok(
    (await loginAllowance(req("", { "x-vercel-forwarded-for": "192.0.2.3" }))) >
      0,
  );
  assert.equal(
    await loginAllowance(
      new Request("http://localhost", {
        headers: { "x-vercel-forwarded-for": "192.0.2.4" },
      }),
    ),
    300,
  );
});
test.after(async () => {
  await db().end();
});
