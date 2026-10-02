import { guard } from "../../../../../../lib/auth";
import { readJson } from "../../../../../../lib/http";
import { deleteIdea, writeIdea } from "../../../../../../lib/ideas";
import { apiError } from "../../../../api-error";
import { z } from "zod";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return Response.json(
      await writeIdea(await readJson(request), (await context.params).id),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request, context: Context) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const input = z
      .object({ version: z.number().int().positive() })
      .parse(await readJson(request));
    await deleteIdea((await context.params).id, input.version);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
