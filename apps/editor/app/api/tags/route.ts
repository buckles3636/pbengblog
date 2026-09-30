import { readJson } from "../../../../../lib/http";
import { guard } from "../../../../../lib/auth";
import { createTag, listTags } from "../../../../../lib/tags";
import { apiError } from "../../../api-error";
import { z } from "zod";
import { tagNameSchema } from "../../../../../shared/content";
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return Response.json(await listTags());
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const input = z
      .object({ name: tagNameSchema })
      .parse(await readJson(request));
    return Response.json(await createTag(input.name), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
