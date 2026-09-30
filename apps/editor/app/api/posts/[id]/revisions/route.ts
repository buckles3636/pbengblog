import { guard } from "../../../../../../../lib/auth";
import { revisions } from "../../../../../../../lib/posts";
import { apiError } from "../../../../../api-error";
import { z } from "zod";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success)
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    return Response.json(await revisions(id));
  } catch (e) {
    return apiError(e);
  }
}
