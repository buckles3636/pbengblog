import { guard } from "../../../../../lib/auth";
import { readJson } from "../../../../../lib/http";
import { listIdeas, writeIdea } from "../../../../../lib/ideas";
import { apiError } from "../../../api-error";
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return Response.json(await listIdeas());
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    return Response.json(await writeIdea(await readJson(request)), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
