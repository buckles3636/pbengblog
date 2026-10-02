import { guard } from "../../../../../lib/auth";
import { readJson } from "../../../../../lib/http";
import {
  enqueuePublication,
  publicationStatus,
} from "../../../../../lib/publications";
import { apiError } from "../../../api-error";
import { z } from "zod";
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return Response.json(await publicationStatus(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const { postId, version, requestId } = z
      .object({
        postId: z.uuid(),
        version: z.number().int().positive(),
        requestId: z.uuid(),
      })
      .strict()
      .parse(await readJson(request));
    return Response.json(await enqueuePublication(postId, version, requestId), {
      status: 202,
    });
  } catch (error) {
    return apiError(error);
  }
}
