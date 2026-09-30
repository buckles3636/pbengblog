import {
  trustedProxy,
  authError,
  revokeSession,
  sameOrigin,
  sessionCookie,
} from "../../../../../../lib/auth";
export async function POST(request: Request) {
  if (!trustedProxy(request)) return authError("Not found", 404);
  if (!sameOrigin(request))
    return authError("Cross-origin logout is forbidden", 403);
  try {
    await revokeSession(request);
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": sessionCookie("", true),
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return authError("Logout temporarily unavailable", 503);
  }
}
