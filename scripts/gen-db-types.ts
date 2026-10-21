/**
 * Generates src/lib/supabase/database.types.ts in the same shape as
 * `supabase gen types typescript`, by introspecting the database at SUPABASE_DB_URL.
 * (The Supabase CLI generator needs Docker; this works anywhere.)
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const PG_TO_TS: Record<string, string> = {
  uuid: "string", text: "string", varchar: "string", bpchar: "string", citext: "string",
  int2: "number", int4: "number", int8: "number", float4: "number", float8: "number", numeric: "number",
  bool: "boolean", json: "Json", jsonb: "Json", date: "string", time: "string", timetz: "string",
  timestamp: "string", timestamptz: "string", interval: "string", bytea: "string", inet: "string",
};

async function main() {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  const enums = await client.query<{ name: string; values: string[] }>(`
    select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as values
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by t.typname`);
  const enumNames = new Set(enums.rows.map((e) => e.name));

  const tsType = (udt: string, isArray: boolean): string => {
    const base = udt.replace(/^_/, "");
    const t = enumNames.has(base) ? `Database["public"]["Enums"]["${base}"]` : PG_TO_TS[base] ?? "unknown";
    return isArray || udt.startsWith("_") ? `${t}[]` : t;
  };

  const cols = await client.query<{
    table_name: string; column_name: string; udt_name: string; data_type: string; is_nullable: string;
    column_default: string | null; is_identity: string; is_generated: string; identity_generation: string | null;
  }>(`
    select c.table_name, c.column_name, c.udt_name, c.data_type, c.is_nullable, c.column_default, c.is_identity, c.is_generated, c.identity_generation
    from information_schema.columns c join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE' order by c.table_name, c.ordinal_position`);

  const fks = await client.query<{ constraint_name: string; table_name: string; columns: string[]; foreign_table: string; foreign_columns: string[]; is_one_to_one: boolean }>(`
    select con.conname as constraint_name, rel.relname as table_name,
      array(select att.attname::text from unnest(con.conkey) k join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k) as columns,
      frel.relname as foreign_table,
      array(select att.attname::text from unnest(con.confkey) k join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k) as foreign_columns,
      exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique and
        (select array_agg(x order by x) from unnest(i.indkey) x) = (select array_agg(x order by x) from unnest(con.conkey) x)) as is_one_to_one
    from pg_constraint con join pg_class rel on rel.oid = con.conrelid join pg_namespace n on n.oid = rel.relnamespace
    join pg_class frel on frel.oid = con.confrelid join pg_namespace fn on fn.oid = frel.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public' order by rel.relname, con.conname`);

  const fns = await client.query<{ name: string; args: string | null; defaults: number; arg_types: string[] | null; returns_set: boolean; ret: string; ret_table: string | null }>(`
    select p.proname as name, array_to_string(p.proargnames[1:p.pronargs], ',') as args, p.pronargdefaults as defaults,
      array(select format_type(t, null)::text from unnest(p.proargtypes) t) as arg_types,
      p.proretset as returns_set, format_type(p.prorettype, null) as ret,
      case when p.prorettype in (select reltype from pg_class where relnamespace = 'public'::regnamespace) then (select relname from pg_class where reltype = p.prorettype) end as ret_table
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and format_type(p.prorettype, null) <> 'trigger' order by p.proname`);
  const tableFnCols = await client.query<{ name: string; cols: { n: string; t: string }[] }>(`
    select p.proname as name, json_agg(json_build_object('n', a.name, 't', format_type(a.type, null)) order by a.ord) as cols
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
      unnest(p.proallargtypes, p.proargnames, p.proargmodes) with ordinality a(type, name, mode, ord)
    where n.nspname = 'public' and a.mode = 't' group by p.proname`);
  await client.end();

  const fmtToTs = (f: string) => {
    const arr = f.endsWith("[]");
    const base = f.replace(/\[\]$/, "").replace(/^public\./, "");
    const map: Record<string, string> = { "double precision": "number", integer: "number", bigint: "number", numeric: "number", text: "string", uuid: "string", boolean: "boolean", jsonb: "Json", "timestamp with time zone": "string", void: "undefined", smallint: "number", real: "number" };
    const t = enumNames.has(base) ? `Database["public"]["Enums"]["${base}"]` : map[base] ?? "unknown";
    return arr ? `${t}[]` : t;
  };

  const tables = [...new Set(cols.rows.map((c) => c.table_name))];
  const lines: string[] = [];
  lines.push("// GENERATED by scripts/gen-db-types.ts — run `pnpm db:types` after changing migrations.");
  lines.push("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n");
  lines.push("export type Database = {\n  public: {\n    Tables: {");
  for (const t of tables) {
    const tc = cols.rows.filter((c) => c.table_name === t);
    const row = tc.map((c) => `          ${c.column_name}: ${tsType(c.udt_name, c.data_type === "ARRAY")}${c.is_nullable === "YES" ? " | null" : ""};`);
    const ins = tc
      .filter((c) => c.identity_generation !== "ALWAYS" && c.is_generated !== "ALWAYS")
      .map((c) => {
        const optional = c.is_nullable === "YES" || c.column_default !== null || c.is_identity === "YES";
        return `          ${c.column_name}${optional ? "?" : ""}: ${tsType(c.udt_name, c.data_type === "ARRAY")}${c.is_nullable === "YES" ? " | null" : ""};`;
      });
    const upd = ins.map((l) => l.replace(/^(\s+\w+)\??:/, "$1?:"));
    const rels = fks.rows.filter((f) => f.table_name === t).map((f) =>
      `          {\n            foreignKeyName: "${f.constraint_name}";\n            columns: [${f.columns.map((c) => `"${c}"`).join(", ")}];\n            isOneToOne: ${f.is_one_to_one};\n            referencedRelation: "${f.foreign_table}";\n            referencedColumns: [${f.foreign_columns.map((c) => `"${c}"`).join(", ")}];\n          },`);
    lines.push(`      ${t}: {\n        Row: {\n${row.join("\n")}\n        };\n        Insert: {\n${ins.join("\n")}\n        };\n        Update: {\n${upd.join("\n")}\n        };\n        Relationships: [\n${rels.join("\n")}\n        ];\n      };`);
  }
  lines.push("    };\n    Views: { [_ in never]: never };\n    Functions: {");
  for (const f of fns.rows) {
    const names = f.args ? f.args.split(",") : [];
    const argTypes = f.arg_types ?? [];
    const firstOptional = names.length - f.defaults;
    const args = names.length ? `{ ${names.map((n, i) => `${n}${i >= firstOptional ? "?" : ""}: ${fmtToTs(argTypes[i] ?? "unknown")}`).join("; ")} }` : "Record<PropertyKey, never>";
    let ret: string;
    const tf = tableFnCols.rows.find((x) => x.name === f.name);
    if (tf) ret = `{ ${tf.cols.map((c) => `${c.n}: ${fmtToTs(c.t)}`).join("; ")} }[]`;
    else if (f.ret_table) ret = `Database["public"]["Tables"]["${f.ret_table}"]["Row"]${f.returns_set ? "[]" : ""}`;
    else ret = fmtToTs(f.ret) + (f.returns_set ? "[]" : "");
    lines.push(`      ${f.name}: { Args: ${args}; Returns: ${ret} };`);
  }
  lines.push("    };\n    Enums: {");
  for (const e of enums.rows) lines.push(`      ${e.name}: ${e.values.map((v) => `"${v}"`).join(" | ")};`);
  lines.push("    };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n");
  lines.push(`type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
`);
  const file = path.resolve(__dirname, "../src/lib/supabase/database.types.ts");
  writeFileSync(file, lines.join("\n"));
  console.log(`wrote ${file} (${tables.length} tables, ${fns.rows.length} functions, ${enums.rows.length} enums)`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
