import { HttpError } from "../../lib/http";
import { ZodError } from "zod";
import { ConflictError } from "../../lib/posts";
export function apiError(e: unknown): Response {
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError)
    return Response.json(
      { error: "Invalid input", details: e.issues },
      { status: 400 },
    );
  if (e instanceof ConflictError)
    return Response.json({ error: e.message }, { status: 409 });
  if (e && typeof e === "object" && "code" in e && e.code === "23505")
    return Response.json(
      { error: "That post URL or Notion source already exists." },
      { status: 409 },
    );
  console.error(e);
  return Response.json(
    { error: "Unable to complete the request. Check the editor server logs." },
    { status: 500 },
  );
}
