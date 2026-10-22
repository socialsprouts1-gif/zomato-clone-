#!/usr/bin/env node
/**
 * One-command local setup on any OS with Docker:
 *   1. starts the Supabase local stack (Postgres, Auth, REST, Realtime, Storage, Studio) via the Supabase CLI,
 *      which applies supabase/migrations and supabase/seed.sql on first start;
 *   2. writes .env.local with the local keys and demo mode on.
 * Re-running is safe. Use `pnpm local:reset` to wipe and re-seed the database.
 */
import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Supabase CLI: use a globally installed `supabase` (e.g. Homebrew) if there is one; otherwise download the
// official release binary once into node_modules/.cache (npm-based installs break when npm blocks install scripts).
const VERSION = "2.53.6";
const ENV = process.env;
function resolveCli() {
  try {
    execSync("supabase --version", { stdio: "ignore" });
    return "supabase";
  } catch {
    // not installed globally
  }
  const dir = path.resolve("node_modules/.cache/supabase-cli");
  const bin = path.join(dir, process.platform === "win32" ? "supabase.exe" : "supabase");
  if (!existsSync(bin)) {
    const os = { darwin: "darwin", linux: "linux", win32: "windows" }[process.platform];
    const arch = { arm64: "arm64", x64: "amd64" }[process.arch];
    if (!os || !arch) throw new Error(`No Supabase CLI build for ${process.platform}/${process.arch}. Install it yourself: https://supabase.com/docs/guides/local-development/cli/getting-started`);
    console.log(`• downloading Supabase CLI ${VERSION} (${os}/${arch})…`);
    mkdirSync(dir, { recursive: true });
    const url = `https://github.com/supabase/cli/releases/download/v${VERSION}/supabase_${os}_${arch}.tar.gz`;
    execSync(`curl -fsSL "${url}" | tar -xz -C "${dir}"`, { stdio: "inherit" });
    if (process.platform !== "win32") chmodSync(bin, 0o755);
  }
  return `"${bin}"`;
}
const CLI = resolveCli();
const run = (cmd) => execSync(cmd, { stdio: "inherit", env: ENV });
const read = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], env: ENV });

try {
  execSync("docker info", { stdio: "ignore" });
} catch {
  console.error("Docker isn't running. Start Docker Desktop (or the Docker daemon) and run this again.");
  process.exit(1);
}

if (process.argv.includes("--stop")) {
  run(`${CLI} stop`);
  process.exit(0);
}
try {
  if (process.argv.includes("--reset")) run(`${CLI} db reset`);
  else run(`${CLI} start`);
} catch {
  console.error(`
✗ Supabase didn't start. Things to try:
  • Make sure Docker Desktop is open and running, then run \`pnpm local:setup\` again.
  • Install the Supabase CLI directly (macOS: \`brew install supabase/tap/supabase\`), then run \`pnpm local:setup\` again.
`);
  process.exit(1);
}

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
  Stop:   pnpm local:stop
`);
