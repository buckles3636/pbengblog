import { exportSnapshot } from "../lib/export";
import { db } from "../lib/db";
try {
  const result = await exportSnapshot(process.argv.includes("--preview"));
  console.log(JSON.stringify(result, null, 2));
  console.log(
    "Private snapshot ready. Use npm run build:published to build it. Nothing was deployed.",
  );
} finally {
  await db().end();
}
