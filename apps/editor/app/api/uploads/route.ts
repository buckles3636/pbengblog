import { guard } from "../../../../../lib/auth";
import { readBody, HttpError } from "../../../../../lib/http";
import { storeImage } from "../../../../../lib/media";
import { apiError } from "../../../api-error";
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  try {
    const bytes = await readBody(request, 13 * 1024 * 1024);
    let form: FormData;
    try {
      form = await new Response(new Uint8Array(bytes), {
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      }).formData();
    } catch {
      throw new HttpError(400, "Expected multipart image upload");
    }
    const file = form.get("file");
    if (!(file instanceof File))
      throw new HttpError(400, "An image is required");
    return Response.json(
      await storeImage(Buffer.from(await file.arrayBuffer()), file.name),
    );
  } catch (e) {
    return apiError(e);
  }
}
