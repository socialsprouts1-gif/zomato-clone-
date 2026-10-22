#!/usr/bin/env node
/**
 * One-command local setup on any OS with Docker:
 *   1. starts the Supabase local stack (Postgres, Auth, REST, Realtime, Storage, Studio) via the Supabase CLI,
 *      which applies supabase/migrations and supabase/seed.sql on first start;
 *   2. writes .env.local with the local keys and demo mode on.
 * Re-running is safe. Use `pnpm local:reset` to wipe and re-seed the database.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CLI = "npx -y supabase@2.53.6";
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const read = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

try {
  execSync("docker info", { stdio: "ignore" });
} catch {
  console.error("Docker isn't running. Start Docker Desktop (or the Docker daemon) and run this again.");
  process.exit(1);
}

if (process.argv.includes("--reset")) run(`${CLI} db reset`);
else run(`${CLI} start`);

// `status -o env` prints KEY="value" lines.
const env = Object.fromEntries(
  read(`${CLI} status -o env`)
    .split("\n")
    .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const url = env.API_URL;
const anon = env.ANON_KEY ?? env.PUBLISHABLE_KEY;
const service = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
if (!url || !anon || !service) {
  console.error("Couldn't read the local Supabase keys from `supabase status`.", Object.keys(env));
  process.exit(1);
}

// Keep any Razorpay/OpenAI keys the user already added.
const keep = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => /^(NEXT_PUBLIC_RAZORPAY_KEY_ID|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|OPENAI_API_KEY|CRON_SECRET)=/.test(l))
  : [];

writeFileSync(
  ".env.local",
  [
    "# Written by scripts/local-setup.mjs for the local Supabase stack. Not for production.",
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    `SUPABASE_DB_URL=${env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"}`,
    "NEXT_PUBLIC_DEMO_MODE=true",
    ...keep,
    "",
  ].join("\n"),
);

console.log(`
✓ Local Supabase is running and .env.local is written.

  Next:   pnpm dev            → http://localhost:3000
  Studio: ${env.STUDIO_URL ?? "http://localhost:54323"}   (browse the database)
  Emails: ${env.INBUCKET_URL ?? env.MAILPIT_URL ?? "http://localhost:54324"}   (magic-link emails)
  Stop:   npx supabase stop
`);
