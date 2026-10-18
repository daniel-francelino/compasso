import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(path, "utf8");

export const sqlFiles = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => join(dir, name));

export const createDatabase = async (onApplied = () => undefined) => {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  await db.exec(read("scripts/db-verify/stubs.sql"));
  for (const file of sqlFiles("supabase/migrations")) {
    await db.exec(read(file));
    onApplied(file);
  }
  return db;
};

export const loadTapShim = (db) => db.exec(read("scripts/db-verify/tap.sql"));
