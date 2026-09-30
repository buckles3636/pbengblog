import "./env";
import pg from "pg";
const globalDb = globalThis as unknown as { pbPool?: pg.Pool };
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required; see .env.example");
  return (globalDb.pbPool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  }));
}
