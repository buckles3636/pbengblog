import { NextRequest, NextResponse } from "next/server";
import { authorized, editorOrigin, trustedProxy } from "../../lib/auth";
export async function proxy(request: NextRequest) {
  if (!trustedProxy(request))
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const pathname = request.nextUrl.pathname;
  const publicPath = pathname === "/login" || pathname === "/api/auth/login";
  let response: NextResponse;
  try {
    if (!publicPath && !(await authorized(request))) {
      response =
        pathname.startsWith("/api/") || pathname.startsWith("/media/")
          ? NextResponse.json(
              {
                error:
                  "Session expired. Sign in in another tab, then save this draft again.",
              },
              { status: 401 },
            )
          : NextResponse.redirect(new URL("/login", editorOrigin()));
    } else response = NextResponse.next();
  } catch {
    response = NextResponse.json(
      { error: "Editor temporarily unavailable" },
      { status: 503 },
    );
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Vercel-CDN-Cache-Control", "no-store");
  if (editorOrigin().startsWith("https:"))
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  return response;
}
export const config = { matcher: ["/((?!_next/static|favicon.ico).*)"] };
