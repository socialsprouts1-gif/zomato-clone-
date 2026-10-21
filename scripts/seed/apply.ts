/** Applies supabase/seed.sql to the database in SUPABASE_DB_URL (from .env.local). */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL (Supabase → Project Settings → Database → Connection string) in .env.local");
  process.exit(1);
}
const sql = readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8");
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
async function main() {
  await client.connect();
  try {
    await client.query(sql);
    console.log("✓ seed applied");
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
