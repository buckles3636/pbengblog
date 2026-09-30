import { readJson } from "../../../../../lib/http";
import { guard } from "../../../../../lib/auth";
import { createPost, listPosts } from "../../../../../lib/posts";
import { apiError } from "../../../api-error";
export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    return Response.json(await listPosts());
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    return Response.json(await createPost(await readJson(request)), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
