import { readFileSync } from "node:fs";
import { createDatabase, loadTapShim, sqlFiles } from "./db-verify/database.mjs";

const read = (path) => readFileSync(path, "utf8");

const db = await createDatabase((file) => console.log(`applied ${file}`));
await loadTapShim(db);

const tapLine = /^(not ok|ok|1\.\.)/;
let failures = 0;
let total = 0;
for (const file of sqlFiles("supabase/tests")) {
  console.log(`\n${file}`);
  let lines = [];
  try {
    const results = await db.exec(read(file));
    lines = results.flatMap((result) =>
      result.rows
        .map((row) => Object.values(row)[0])
        .filter((value) => typeof value === "string" && tapLine.test(value)),
    );
  } catch (error) {
    failures += 1;
    console.log(`  ERROR ${error.message}`);
    await db.exec("rollback").catch(() => undefined);
    continue;
  }
  const planned = lines.find((line) => line.startsWith("1.."));
  const results = lines.filter((line) => !line.startsWith("1.."));
  for (const line of results) {
    total += 1;
    if (line.startsWith("not ok")) failures += 1;
    if (line.startsWith("not ok")) console.log(`  ${line}`);
  }
  if (planned !== `1..${results.length}`) {
    failures += 1;
    console.log(`  plan mismatch: ${planned ?? "none"} but ${results.length} assertions ran`);
  }
  console.log(`  ${results.length} assertions`);
}
console.log(`\n${total} assertions, ${failures} failure(s)`);
await db.close();
process.exit(failures === 0 ? 0 : 1);
