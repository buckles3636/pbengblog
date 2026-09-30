import { readJson } from "../../../../../../lib/http";
import { guard } from "../../../../../../lib/auth";
import { renameTag } from "../../../../../../lib/tags";
import { apiError } from "../../../../api-error";
import { z } from "zod";
import { tagNameSchema } from "../../../../../../shared/content";
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const id = z.uuid().parse((await context.params).id);
    const input = z
      .object({ name: tagNameSchema, previousName: tagNameSchema })
      .parse(await readJson(request));
    return Response.json(await renameTag(id, input.name, input.previousName));
  } catch (e) {
    return apiError(e);
  }
}
