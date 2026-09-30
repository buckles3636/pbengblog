export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readBody(
  request: Request,
  limit: number,
): Promise<Buffer> {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new HttpError(413, "Request too large");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > limit) {
        await reader.cancel();
        throw new HttpError(413, "Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON");
  try {
    return JSON.parse((await readBody(request, 8 * 1024 * 1024)).toString());
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Malformed JSON");
  }
}
