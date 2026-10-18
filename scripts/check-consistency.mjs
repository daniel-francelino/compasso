import { existsSync } from "node:fs";

if (!existsSync("supabase/migrations")) {
  console.log("check:consistency: no migrations yet, nothing to compare.");
  process.exit(0);
}
console.log("check:consistency: comparisons are added by task P0-07.");
