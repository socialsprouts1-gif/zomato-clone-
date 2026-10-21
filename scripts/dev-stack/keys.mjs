// Prints anon and service_role JWTs for the dev stack, signed with JWT_SECRET.
import { createHmac } from "node:crypto";
const secret = process.argv[2];
const sign = (payload) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
};
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
console.log(`ANON_KEY=${sign({ iss: "supabase-dev", role: "anon", exp })}`);
console.log(`SERVICE_ROLE_KEY=${sign({ iss: "supabase-dev", role: "service_role", exp })}`);
