import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createDatabase } from "./db-verify/database.mjs";

const OUT = "src/lib/shared/supabase/database.types.ts";

const SCALARS = {
  uuid: "string",
  text: "string",
  citext: "string",
  varchar: "string",
  "character varying": "string",
  date: "string",
  "timestamp with time zone": "string",
  "timestamp without time zone": "string",
  integer: "number",
  bigint: "number",
  smallint: "number",
  numeric: "number",
  boolean: "boolean",
  jsonb: "Json",
  json: "Json",
  void: "undefined",
};

const tsType = (pgType) => {
  const isArray = pgType.endsWith("[]");
  const base = isArray ? pgType.slice(0, -2) : pgType;
  const mapped = SCALARS[base] ?? "string";
  return isArray ? `${mapped}[]` : mapped;
};

const q = async (db, text) => (await db.query(text)).rows;

const db = await createDatabase();

const columns = await q(
  db,
  `select c.relname as table_name, a.attname as column_name,
          format_type(a.atttypid, a.atttypmod) as data_type,
          a.attnotnull as not_null, a.atthasdef as has_default,
          a.attidentity as identity, a.attnum
   from pg_attribute a
   join pg_class c on c.oid = a.attrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
   order by c.relname, a.attnum`,
);

const foreignKeys = await q(
  db,
  `select con.conname, rel.relname as table_name, ref.relname as referenced_table,
          array(select att.attname from unnest(con.conkey) k join pg_attribute att
                on att.attrelid = con.conrelid and att.attnum = k) as columns,
          array(select att.attname from unnest(con.confkey) k join pg_attribute att
                on att.attrelid = con.confrelid and att.attnum = k) as referenced_columns
   from pg_constraint con
   join pg_class rel on rel.oid = con.conrelid
   join pg_class ref on ref.oid = con.confrelid
   join pg_namespace n on n.oid = rel.relnamespace
   where con.contype = 'f' and n.nspname = 'public'
   order by rel.relname, con.conname`,
);

const functions = await q(
  db,
  `select p.proname, p.pronargs, p.pronargdefaults, p.proretset,
          coalesce(p.proargnames, '{}') as argnames,
          array(select format_type(t, null) from unnest(p.proargtypes::oid[]) t) as argtypes,
          coalesce(p.proargmodes::text[], '{}') as argmodes,
          coalesce(array(select format_type(t, null) from unnest(p.proallargtypes) t), '{}') as alltypes,
          format_type(p.prorettype, null) as rettype
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
   order by p.proname`,
);

const tables = Object.groupBy(columns, (column) => column.table_name);

const renderTable = (name, cols) => {
  const row = cols.map(
    (c) => `          ${c.column_name}: ${tsType(c.data_type)}${c.not_null ? "" : " | null"}`,
  );
  const insert = cols.map((c) => {
    const optional = !c.not_null || c.has_default || c.identity !== "";
    return `          ${c.column_name}${optional ? "?" : ""}: ${tsType(c.data_type)}${c.not_null ? "" : " | null"}`;
  });
  const update = cols.map(
    (c) => `          ${c.column_name}?: ${tsType(c.data_type)}${c.not_null ? "" : " | null"}`,
  );
  const relationships = foreignKeys
    .filter((fk) => fk.table_name === name)
    .map(
      (fk) => `          {
            foreignKeyName: "${fk.conname}"
            columns: ${JSON.stringify(fk.columns)}
            isOneToOne: false
            referencedRelation: "${fk.referenced_table}"
            referencedColumns: ${JSON.stringify(fk.referenced_columns)}
          }`,
    );
  return `      ${name}: {
        Row: {
${row.join("\n")}
        }
        Insert: {
${insert.join("\n")}
        }
        Update: {
${update.join("\n")}
        }
        Relationships: [
${relationships.join(",\n")}
        ]
      }`;
};

const renderFunction = (fn) => {
  const required = fn.pronargs - fn.pronargdefaults;
  const args = fn.argtypes.map((type, index) => {
    const name = fn.argnames[index] ?? `arg${index + 1}`;
    return `${name}${index >= required ? "?" : ""}: ${tsType(type)} | null`;
  });
  const tableColumns = fn.argmodes
    .map((mode, index) =>
      mode === "t" ? `${fn.argnames[index]}: ${tsType(fn.alltypes[index])}` : null,
    )
    .filter((column) => column !== null);
  const returns =
    tableColumns.length > 0
      ? `{ ${tableColumns.join("; ")} }[]`
      : `${tsType(fn.rettype)}${fn.proretset ? "[]" : ""}`;
  return `      ${fn.proname}: {
        Args: ${args.length === 0 ? "never" : `{ ${args.join("; ")} }`}
        Returns: ${returns}
      }`;
};

const source = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${Object.entries(tables)
  .map(([name, cols]) => renderTable(name, cols))
  .join("\n")}
    }
    Views: { [_ in never]: never }
    Functions: {
${functions.map(renderFunction).join("\n")}
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
`;

writeFileSync(OUT, source);
execSync(`npx prettier --write ${OUT}`, { stdio: "inherit" });
console.log(`Wrote ${OUT} (offline generator, see docs/pending-external-setup.md)`);
await db.close();
