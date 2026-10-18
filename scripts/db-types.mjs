import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "src/lib/shared/supabase/database.types.ts";
const raw = execSync("npx --yes supabase gen types typescript --local --schema public", {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  stdio: ["ignore", "pipe", "inherit"],
});

const nullableArgs = (source) => {
  let out = "";
  let index = 0;
  const marker = /Args:\s*\{/g;
  for (let match = marker.exec(source); match; match = marker.exec(source)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < source.length; close++) {
      if (source[close] === "{") depth++;
      else if (source[close] === "}" && --depth === 0) break;
    }
    const props = [];
    let level = 0;
    let current = "";
    for (const char of source.slice(open + 1, close)) {
      if ("{[(<".includes(char)) level++;
      else if ("}])>".includes(char)) level--;
      if ((char === "," || char === ";") && level === 0) {
        props.push(current);
        current = "";
      } else current += char;
    }
    if (current.trim()) props.push(current);
    const rewritten = props
      .map((prop) => {
        const split = prop.indexOf(":");
        const type = prop.slice(split + 1).trim();
        return type.endsWith("| null") ? prop : `${prop.slice(0, split)}: ${type} | null`;
      })
      .join(",");
    out += source.slice(index, open + 1) + rewritten;
    index = close;
    marker.lastIndex = close;
  }
  return out + source.slice(index);
};

writeFileSync(OUT, nullableArgs(raw));
execSync(`npx prettier --write ${OUT}`, { stdio: "inherit" });
console.log(`Wrote ${OUT}`);
