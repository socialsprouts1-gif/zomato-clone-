// DEV ONLY: a tiny stand-in for the Supabase API gateway, used where Docker
// (and so `supabase start`) is unavailable. Routes:
//   /auth/v1/*      -> Supabase Auth (GoTrue) binary
//   /rest/v1/*      -> PostgREST binary
//   /storage/v1/*   -> minimal file store on disk
//   /realtime/v1/*  -> minimal Phoenix-protocol server for postgres_changes + broadcast,
//                      fed by pg_notify triggers (see realtime-triggers.sql), with RLS checks.
import { createHmac } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import pg from "pg";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH_URL = process.env.AUTH_URL ?? "http://127.0.0.1:9999";
const REST_URL = process.env.REST_URL ?? "http://127.0.0.1:54330";
const JWT_SECRET = process.env.JWT_SECRET;
const DB_URL = process.env.DB_URL;
const STORAGE_DIR = process.env.STORAGE_DIR ?? path.resolve(".dev-storage");
if (!JWT_SECRET || !DB_URL) throw new Error("JWT_SECRET and DB_URL are required");

const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });

// ---------- helpers ----------
function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
function verifyJwt(token) {
  try {
    const [h, p, sig] = token.split(".");
    const expected = createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
    if (expected !== sig) return null;
    const claims = JSON.parse(b64urlDecode(p));
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
  "access-control-allow-headers":
    "authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile,range,x-upsert,cache-control,x-supabase-api-version",
  "access-control-expose-headers": "content-range,content-location,x-total-count",
};
function bearer(req) {
  const h = req.headers.authorization ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : (req.headers.apikey ?? "");
}

// ---------- HTTP proxy ----------
function proxy(req, res, target, stripPrefix) {
  const url = new URL(target);
  const upstreamPath = req.url.slice(stripPrefix.length) || "/";
  const headers = { ...req.headers, host: url.host };
  const up = http.request(
    { hostname: url.hostname, port: url.port, path: upstreamPath, method: req.method, headers },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, { ...upRes.headers, ...CORS });
      upRes.pipe(res);
    },
  );
  up.on("error", (e) => {
    res.writeHead(502, { "content-type": "application/json", ...CORS });
    res.end(JSON.stringify({ message: `upstream error: ${e.message}` }));
  });
  req.pipe(up);
}

// ---------- storage ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function safeJoin(...parts) {
  const p = path.resolve(STORAGE_DIR, ...parts);
  if (!p.startsWith(STORAGE_DIR)) throw new Error("bad path");
  return p;
}
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf", ".svg": "image/svg+xml" };

async function storage(req, res) {
  const json = (code, body) => {
    res.writeHead(code, { "content-type": "application/json", ...CORS });
    res.end(JSON.stringify(body));
  };
  const u = new URL(req.url, "http://x");
  const rest = decodeURIComponent(u.pathname.replace(/^\/storage\/v1\//, ""));
  try {
    if (req.method === "GET" && /^object\/(public|authenticated|sign)\//.test(rest)) {
      const rel = rest.replace(/^object\/(public|authenticated|sign)\//, "");
      const file = safeJoin(rel);
      if (!fs.existsSync(file)) return json(404, { message: "Object not found" });
      const meta = fs.existsSync(`${file}.__type`) ? fs.readFileSync(`${file}.__type`, "utf8") : MIME[path.extname(file)] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": meta, "cache-control": "public, max-age=60", ...CORS });
      return fs.createReadStream(file).pipe(res);
    }
    const claims = verifyJwt(bearer(req));
    if (!claims) return json(401, { message: "Invalid JWT" });
    if ((req.method === "POST" || req.method === "PUT") && rest.startsWith("object/")) {
      const rel = rest.slice("object/".length);
      const file = safeJoin(rel);
      if (fs.existsSync(file) && req.method === "POST" && req.headers["x-upsert"] !== "true") {
        return json(409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      }
      let body = await readBody(req);
      let type = req.headers["content-type"] ?? "application/octet-stream";
      if (type.startsWith("multipart/form-data")) {
        // storage-js sends FormData with one file part plus cacheControl.
        const boundary = type.split("boundary=")[1];
        const parts = body.toString("binary").split(`--${boundary}`);
        const filePart = parts.find((p) => /filename=|name=""/.test(p)) ?? parts.find((p) => p.includes("Content-Type"));
        const [head, ...data] = filePart.split("\r\n\r\n");
        type = /Content-Type: ([^\r\n]+)/i.exec(head)?.[1] ?? "application/octet-stream";
        body = Buffer.from(data.join("\r\n\r\n").replace(/\r\n$/, ""), "binary");
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
      fs.writeFileSync(`${file}.__type`, type);
      return json(200, { Key: rel, Id: rel });
    }
    if (req.method === "DELETE" && rest.startsWith("object/")) {
      const bucket = rest.slice("object/".length).split("/")[0];
      const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
      for (const p of prefixes) fs.rmSync(safeJoin(bucket, p), { force: true });
      return json(200, prefixes.map((name) => ({ name })));
    }
    if (rest.startsWith("bucket")) return json(200, { name: "ok" });
    return json(404, { message: "Not supported by dev storage" });
  } catch (e) {
    return json(500, { message: String(e) });
  }
}

// ---------- realtime ----------
/** @type {Set<{ws: import('ws').WebSocket, claims: any, channels: Map<string, any>}>} */
const sockets = new Set();
let bindingSeq = 1;

function send(ws, join_ref, ref, topic, event, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify([join_ref, ref, topic, event, payload]));
}

function parseFilter(filter) {
  if (!filter) return null;
  const m = /^([a-zA-Z0-9_]+)=(eq|neq|lt|lte|gt|gte|in)\.(.*)$/.exec(filter);
  if (!m) return null;
  const [, col, op, raw] = m;
  const value = op === "in" ? raw.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim()) : raw;
  return { col, op, value };
}
function matchFilter(f, row) {
  if (!f) return true;
  if (!row) return false;
  const v = row[f.col];
  const s = v === null || v === undefined ? "null" : String(v);
  switch (f.op) {
    case "eq": return s === f.value;
    case "neq": return s !== f.value;
    case "in": return f.value.includes(s);
    case "lt": return Number(v) < Number(f.value);
    case "lte": return Number(v) <= Number(f.value);
    case "gt": return Number(v) > Number(f.value);
    case "gte": return Number(v) >= Number(f.value);
    default: return false;
  }
}

/** Returns the row as the subscriber is allowed to see it, or null if RLS hides it. */
async function rowVisibleTo(claims, schema, table, id) {
  const role = claims?.role === "service_role" ? "service_role" : claims?.role === "authenticated" ? "authenticated" : "anon";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims ?? { role: "anon" })]);
    const r = await client.query(`select to_jsonb(t) as row from ${pg.escapeIdentifier(schema)}.${pg.escapeIdentifier(table)} t where t.id = $1`, [id]);
    await client.query("commit");
    return r.rows[0]?.row ?? null;
  } catch {
    await client.query("rollback").catch(() => {});
    return null;
  } finally {
    client.release();
  }
}

async function dispatch(change) {
  const { schema, table, type, commit_timestamp } = change;
  for (const sock of sockets) {
    for (const [topic, ch] of sock.channels) {
      const ids = [];
      for (const b of ch.bindings) {
        if (b.schema !== "*" && b.schema !== schema) continue;
        if (b.table && b.table !== "*" && b.table !== table) continue;
        if (b.event !== "*" && b.event !== type) continue;
        ids.push(b);
      }
      if (!ids.length) continue;
      let record = change.record;
      if (type !== "DELETE") {
        record = await rowVisibleTo(sock.claims, schema, table, change.record?.id);
        if (process.env.DEBUG_RT) console.log("rt", table, type, "role", sock.claims?.role, "sub", sock.claims?.sub, "visible", Boolean(record));
        if (!record) continue;
      }
      if (process.env.DEBUG_RT) console.log("rt filters", ids.map((b) => b.filter), "row restaurant", record?.restaurant_id);
      const matched = ids.filter((b) => matchFilter(b.parsed, type === "DELETE" ? change.old_record : record)).map((b) => b.id);
      if (!matched.length) continue;
      send(sock.ws, null, null, topic, "postgres_changes", {
        ids: matched,
        data: { schema, table, commit_timestamp, type, errors: null, columns: [], record: type === "DELETE" ? undefined : record, old_record: change.old_record ?? undefined },
      });
    }
  }
}

async function listen() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  await client.query("listen dev_realtime");
  client.on("notification", (msg) => {
    try {
      dispatch(JSON.parse(msg.payload)).catch((e) => console.error("dispatch", e));
    } catch (e) {
      console.error("bad notify payload", e);
    }
  });
  client.on("error", (e) => {
    console.error("listener error, reconnecting", e.message);
    setTimeout(listen, 1000);
  });
}

function handleSocket(ws, req) {
  const u = new URL(req.url, "http://x");
  const sock = { ws, claims: verifyJwt(u.searchParams.get("apikey") ?? ""), channels: new Map() };
  sockets.add(sock);
  ws.on("close", () => sockets.delete(sock));
  ws.on("message", (raw, isBinary) => {
    if (isBinary) return; // binary broadcast push: not supported in dev; clients fall back to JSON
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const [join_ref, ref, topic, event, payload] = msg;
    if (topic === "phoenix" && event === "heartbeat") return send(ws, null, ref, "phoenix", "phx_reply", { status: "ok", response: {} });
    if (event === "phx_join") {
      if (payload?.access_token) sock.claims = verifyJwt(payload.access_token) ?? sock.claims;
      const cfg = payload?.config ?? {};
      const bindings = (cfg.postgres_changes ?? []).map((f) => ({
        id: bindingSeq++,
        event: f.event ?? "*",
        schema: f.schema ?? "public",
        table: f.table,
        filter: f.filter,
        parsed: parseFilter(f.filter),
      }));
      sock.channels.set(topic, { join_ref, bindings, self: Boolean(cfg.broadcast?.self) });
      send(ws, join_ref, ref, topic, "phx_reply", {
        status: "ok",
        response: { postgres_changes: bindings.map(({ id, event, schema, table, filter }) => ({ id, event, schema, table, filter })) },
      });
      if (bindings.length) send(ws, join_ref, null, topic, "system", { status: "ok", message: "Subscribed to PostgreSQL", extension: "postgres_changes", channel: topic.replace(/^realtime:/, "") });
      return;
    }
    if (event === "phx_leave") {
      sock.channels.delete(topic);
      return send(ws, join_ref, ref, topic, "phx_reply", { status: "ok", response: {} });
    }
    if (event === "access_token") {
      sock.claims = verifyJwt(payload?.access_token ?? "") ?? sock.claims;
      return;
    }
    if (event === "broadcast") {
      for (const other of sockets) {
        const ch = other.channels.get(topic);
        if (!ch || (other === sock && !ch.self)) continue;
        send(other.ws, ch.join_ref, null, topic, "broadcast", payload);
      }
      if (ref) send(ws, join_ref, ref, topic, "phx_reply", { status: "ok", response: {} });
      return;
    }
    if (event === "presence") {
      if (ref) send(ws, join_ref, ref, topic, "phx_reply", { status: "ok", response: {} });
      return;
    }
    if (ref) send(ws, join_ref, ref, topic, "phx_reply", { status: "ok", response: {} });
  });
}

// ---------- mail catcher (SMTP on :2500, read back via GET /mail?to=) ----------
/** @type {Map<string, {subject: string, body: string, at: number}[]>} */
const mailbox = new Map();
function decodeQuotedPrintable(s) {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
net.createServer((sock) => {
  let rcpts = [];
  let inData = false;
  let buf = "";
  sock.write("220 thaali-dev ESMTP\r\n");
  sock.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    if (inData) {
      const end = buf.indexOf("\r\n.\r\n");
      if (end === -1) return;
      const msg = buf.slice(0, end);
      buf = buf.slice(end + 5);
      inData = false;
      const [head, ...rest] = msg.split("\r\n\r\n");
      const subject = /^Subject: (.*)$/im.exec(head)?.[1] ?? "";
      const body = decodeQuotedPrintable(rest.join("\r\n\r\n"));
      for (const r of rcpts) {
        const list = mailbox.get(r) ?? [];
        list.push({ subject, body, at: Date.now() });
        mailbox.set(r, list.slice(-10));
      }
      rcpts = [];
      sock.write("250 OK queued\r\n");
    }
    let idx;
    while (!inData && (idx = buf.indexOf("\r\n")) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO") sock.write("250-thaali-dev\r\n250 8BITMIME\r\n");
      else if (cmd === "HELO") sock.write("250 thaali-dev\r\n");
      else if (cmd === "RCPT") {
        const m = /<([^>]+)>/.exec(line);
        if (m) rcpts.push(m[1].toLowerCase());
        sock.write("250 OK\r\n");
      } else if (cmd === "DATA") {
        inData = true;
        sock.write("354 End data with <CR><LF>.<CR><LF>\r\n");
      } else if (cmd === "QUIT") {
        sock.end("221 Bye\r\n");
      } else sock.write("250 OK\r\n");
    }
  });
  sock.on("error", () => {});
}).listen(Number(process.env.SMTP_PORT ?? 2500), "127.0.0.1");

// ---------- server ----------
const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.url.startsWith("/auth/v1")) return proxy(req, res, AUTH_URL, "/auth/v1");
  // GoTrue builds email links without the /auth/v1 prefix when running standalone.
  if (req.url.startsWith("/verify") || req.url.startsWith("/callback") || req.url.startsWith("/authorize")) return proxy(req, res, AUTH_URL, "");
  if (req.url.startsWith("/rest/v1")) return proxy(req, res, REST_URL, "/rest/v1");
  if (req.url.startsWith("/storage/v1")) return void storage(req, res);
  if (req.url.startsWith("/mail")) {
    const to = (new URL(req.url, "http://x").searchParams.get("to") ?? "").toLowerCase();
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify(mailbox.get(to) ?? []));
  }
  if (req.url === "/health") {
    res.writeHead(200, CORS);
    return res.end("ok");
  }
  res.writeHead(404, CORS);
  res.end("not found");
});
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (!req.url.startsWith("/realtime/v1/websocket")) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => handleSocket(ws, req));
});

fs.mkdirSync(STORAGE_DIR, { recursive: true });
await listen();
server.listen(PORT, () => console.log(`dev gateway on http://localhost:${PORT}`));
