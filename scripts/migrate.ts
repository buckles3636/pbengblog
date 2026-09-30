import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { root } from "../lib/env";
import { db } from "../lib/db";
const client = await db().connect();
try {
  await client.query("SELECT pg_advisory_lock(563632025)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir(path.join(root, "db/migrations")))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(path.join(root, "db/migrations", name), "utf8"),
      checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT checksum FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name,checksum) VALUES ($1,$2)",
        [name, checksum],
      );
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(563632025)");
  client.release();
  await db().end();
}
