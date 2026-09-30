import { readJson } from "../../../../../../../lib/http";
import { guard } from "../../../../../../../lib/auth";
import { publishPost } from "../../../../../../../lib/posts";
import { apiError } from "../../../../../api-error";
import { z } from "zod";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const { version } = z
      .object({ version: z.number().int().positive() })
      .parse(await readJson(request));
    if (!z.uuid().safeParse(id).success)
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    return Response.json(await publishPost(id, version));
  } catch (e) {
    return apiError(e);
  }
}
