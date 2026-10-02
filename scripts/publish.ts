import { exportSnapshot } from "../lib/export";
import { db } from "../lib/db";
try {
  const index = process.argv.indexOf("--publication-id");
  const publicationId = index >= 0 ? process.argv[index + 1] : undefined;
  if (index >= 0 && !/^[0-9a-f-]{36}$/i.test(publicationId || ""))
    throw new Error("Invalid publication ID");
  const result = await exportSnapshot(
    process.argv.includes("--preview"),
    publicationId,
  );
  console.log(JSON.stringify(result, null, 2));
  console.log(
    "Private snapshot ready. Use npm run build:published to build it. Nothing was deployed.",
  );
} finally {
  await db().end();
}
