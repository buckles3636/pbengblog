import { readJson } from "../../../../../../lib/http";
import { guard } from "../../../../../../lib/auth";
import { getPost, savePost } from "../../../../../../lib/posts";
import { apiError } from "../../../../api-error";
import { z } from "zod";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success)
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    const p = await getPost(id);
    return p
      ? Response.json(p)
      : Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success)
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    return Response.json(await savePost(id, await readJson(request)));
  } catch (e) {
    return apiError(e);
  }
}
