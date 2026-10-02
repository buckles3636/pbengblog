import {
  trustedProxy,
  authError,
  credentialsMatch,
  createSession,
  loginAllowance,
  sameOrigin,
  sessionCookie,
} from "../../../../../../lib/auth";
import { readBody, HttpError } from "../../../../../../lib/http";
export async function POST(request: Request) {
  if (!trustedProxy(request)) return authError("Not found", 404);
  if (!sameOrigin(request))
    return authError("Cross-origin login is forbidden", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return authError("Expected JSON", 415);
  try {
    const retry = await loginAllowance(request);
    if (retry)
      return Response.json(
        {
          error: `Too many login attempts. Try again in ${Math.ceil(retry / 60)} minutes.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retry),
            "Cache-Control": "private, no-store",
          },
        },
      );
    let body;
    try {
      body = JSON.parse((await readBody(request, 4096)).toString());
    } catch (error) {
      return authError(
        error instanceof HttpError ? error.message : "Malformed JSON",
        error instanceof HttpError ? error.status : 400,
      );
    }
    if (!credentialsMatch(body?.password))
      return authError("Incorrect password", 401);
    const token = await createSession();
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": sessionCookie(token),
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return authError("Login temporarily unavailable", 503);
  }
}
