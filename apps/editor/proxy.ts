import { NextRequest, NextResponse } from "next/server";
import { authorized } from "../../lib/auth";
export function proxy(request: NextRequest) {
  if (!authorized(request.headers.get("authorization")))
    return new NextResponse(
      "Editor authentication required. Configure a username and password (20+ characters).",
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="PBEngBlog", charset="UTF-8"',
          "Cache-Control": "no-store",
        },
      },
    );
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
