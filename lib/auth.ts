import "./env";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
import { isIP } from "node:net";

export const SESSION_SECONDS = 12 * 60 * 60;
export function editorOrigin() {
  return new URL(process.env.EDITOR_ORIGIN || "http://localhost:3011").origin;
}
export function cookieName() {
  return editorOrigin().startsWith("https:")
    ? "__Host-pb-session"
    : "pb_session";
}
function secret() {
  const value = process.env.EDITOR_SESSION_SECRET;
  if (!value || value.length < 32 || value.startsWith("replace-with-"))
    throw new Error(
      "Configure EDITOR_SESSION_SECRET with at least 32 random characters",
    );
  return value;
}
function digest(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
function credentialVersion() {
  return digest(JSON.stringify(["password-only", process.env.EDITOR_PASSWORD]));
}
export function credentialsMatch(password: unknown): boolean {
  const expectedPassword = process.env.EDITOR_PASSWORD;
  if (
    !expectedPassword ||
    expectedPassword.startsWith("replace-with-") ||
    typeof password !== "string" ||
    password.length > 1024
  )
    return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  const passwordMatches = timingSafeEqual(
    hash(password),
    hash(expectedPassword),
  );
  return passwordMatches;
}
export function sessionToken(request: Request): string | undefined {
  const matches = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName()}=`));
  if (matches.length !== 1) return;
  const token = matches[0].slice(cookieName().length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
export async function authorized(request: Request): Promise<boolean> {
  const token = sessionToken(request);
  if (!token) return false;
  const result = await db().query(
    "SELECT 1 FROM editor_sessions WHERE token_hash=$1 AND credential_version=$2 AND expires_at>now()",
    [digest(token), credentialVersion()],
  );
  return result.rowCount === 1;
}
export function trustedProxy(request: Request): boolean {
  const expected = process.env.EDITOR_PROXY_SECRET;
  if (!expected) return true; // Direct loopback / SSH mode.
  const supplied = request.headers.get("x-editor-proxy-key") || "";
  if (expected.length < 32 || supplied.length > 256) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(supplied), hash(expected));
}
export function sameOrigin(request: Request): boolean {
  return request.headers.get("origin") === editorOrigin();
}
export function authError(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function guard(request: Request): Promise<Response | undefined> {
  if (!trustedProxy(request)) return authError("Not found", 404);
  try {
    if (!(await authorized(request)))
      return authError(
        "Session expired. Sign in in another tab, then save this draft again.",
        401,
      );
  } catch {
    return authError("Editor authentication temporarily unavailable", 503);
  }
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    return authError("Cross-origin writes are forbidden", 403);
}
// Trust Vercel's replaced client-IP header only behind the authenticated proxy.
// The global cap also prevents distributed guessing or forged client headers.
export async function loginAllowance(request: Request): Promise<number> {
  if (!trustedProxy(request)) return 300;
  const forwarded = request.headers.get("x-vercel-forwarded-for") || "";
  const client =
    process.env.EDITOR_PROXY_SECRET && isIP(forwarded)
      ? digest(forwarded)
      : "direct";
  const connection = await db().connect();
  try {
    await connection.query("BEGIN");
    await connection.query(
      "DELETE FROM editor_login_limits WHERE resets_at < now()-interval '1 day'",
    );
    let retry = 0;
    for (const [bucket, limit] of [
      ["global", 100],
      [`client:${client}`, 10],
    ] as const) {
      const result = await connection.query(
        `
        INSERT INTO editor_login_limits(bucket,attempts,resets_at)
        VALUES ($1,1,now()+interval '5 minutes')
        ON CONFLICT(bucket) DO UPDATE SET
          attempts=CASE WHEN editor_login_limits.resets_at<=now() THEN 1 ELSE LEAST(editor_login_limits.attempts+1,$2+1) END,
          resets_at=CASE WHEN editor_login_limits.resets_at<=now() THEN now()+interval '5 minutes' ELSE editor_login_limits.resets_at END
        RETURNING attempts, GREATEST(1,CEIL(EXTRACT(EPOCH FROM resets_at-now())))::integer AS retry
      `,
        [bucket, limit],
      );
      if (result.rows[0].attempts > limit)
        retry = Math.max(retry, result.rows[0].retry);
    }
    await connection.query("COMMIT");
    return retry;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
export async function createSession() {
  await db().query(
    "DELETE FROM editor_sessions WHERE expires_at<=now() OR credential_version<>$1",
    [credentialVersion()],
  );
  const token = randomBytes(32).toString("base64url");
  await db().query(
    "INSERT INTO editor_sessions(token_hash,credential_version,expires_at) VALUES ($1,$2,now()+interval '12 hours')",
    [digest(token), credentialVersion()],
  );
  return token;
}
export async function revokeSession(request: Request) {
  const token = sessionToken(request);
  if (token)
    await db().query("DELETE FROM editor_sessions WHERE token_hash=$1", [
      digest(token),
    ]);
}
export function sessionCookie(token: string, clear = false) {
  return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${editorOrigin().startsWith("https:") ? "; Secure" : ""}`;
}
