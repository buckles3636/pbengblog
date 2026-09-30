import "./env";
import { timingSafeEqual } from "node:crypto";
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function authorized(header: string | null): boolean {
  const username = process.env.EDITOR_USERNAME,
    password = process.env.EDITOR_PASSWORD;
  if (
    !username ||
    !password ||
    password.length < 20 ||
    password.startsWith("replace-with-") ||
    !header?.startsWith("Basic ")
  )
    return false;
  const value = Buffer.from(header.slice(6), "base64").toString(),
    split = value.indexOf(":");
  return (
    split >= 0 &&
    equal(value.slice(0, split), username) &&
    equal(value.slice(split + 1), password)
  );
}
export function guard(request: Request): Response | undefined {
  if (!authorized(request.headers.get("authorization")))
    return new Response("Editor authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="PBEngBlog", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const url = new URL(request.url);
    const expectedOrigin =
      process.env.EDITOR_ORIGIN ||
      `${url.protocol}//${request.headers.get("host") || url.host}`;
    if (!origin || origin !== expectedOrigin)
      return new Response("Cross-origin writes are forbidden", { status: 403 });
  }
}
