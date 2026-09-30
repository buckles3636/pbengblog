import { guard } from "../../../../../lib/auth";
import { dataDir } from "../../../../../lib/env";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET(
  request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const denied = guard(request);
  if (denied) return denied;
  const { name } = await context.params;
  if (!/^[a-f0-9-]+\.(png|jpg|jpeg|webp|gif)$/.test(name))
    return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(dataDir, "uploads", name));
    const ext = name.split(".").pop();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type":
          ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
