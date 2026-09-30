import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { dataDir } from "./env";
import { HttpError } from "./http";
export function imageType(
  bytes: Buffer,
): { extension: string; mime: string } | null {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { extension: "png", mime: "image/png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { extension: "jpg", mime: "image/jpeg" };
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString()))
    return { extension: "gif", mime: "image/gif" };
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return { extension: "webp", mime: "image/webp" };
  return null;
}
export async function storeImage(bytes: Buffer, originalName: string) {
  if (!bytes.length || bytes.length > 12 * 1024 * 1024)
    throw new HttpError(413, "Images must be between 1 byte and 12 MB");
  const type = imageType(bytes);
  if (!type) throw new HttpError(400, "Use a PNG, JPEG, WebP, or GIF image");
  const id = randomUUID(),
    filename = `${id}.${type.extension}`,
    dir = path.join(dataDir, "uploads");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, filename);
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  try {
    await db().query(
      "INSERT INTO media (id,filename,original_name,mime_type,bytes,sha256) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        id,
        filename,
        originalName.slice(0, 255),
        type.mime,
        bytes.length,
        createHash("sha256").update(bytes).digest("hex"),
      ],
    );
  } catch (e) {
    await unlink(file);
    throw e;
  }
  return { url: `/media/${filename}`, name: originalName };
}
