import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const problems = [];
const report = (message) => problems.push(message);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === "node_modules" || name.startsWith(".git")) return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const read = (path) => readFileSync(join(root, path), "utf8");
const tokens = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

const markdownFiles = [
  ...walk(join(root, "docs")),
  join(root, "AGENTS.md"),
  join(root, "CLAUDE.md"),
].filter((file) => file.endsWith(".md") && existsSync(file));

for (const file of markdownFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = target.split("#")[0];
    if (path === "") continue;
    if (!existsSync(resolve(dirname(file), path))) {
      report(`Broken link in ${file.replace(root, "").replace(/\\/g, "/")}: ${target}`);
    }
  }
}

const tableRows = (text) => {
  const tables = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) {
      current = null;
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    if (current === null) {
      current = { header: cells, rows: [] };
      tables.push(current);
    } else if (!cells.every((cell) => /^:?-+:?$/.test(cell))) {
      current.rows.push(cells);
    }
  }
  return tables;
};

const errorCodes = new Set(
  tableRows(read("docs/reference/error-codes.md"))
    .flatMap((table) => table.rows)
    .flatMap((row) => tokens(row[0] ?? "")),
);

const catalogText = read("docs/foundations/roles-and-actions.md");
const catalogStart = catalogText.indexOf("## 5. Action catalog");
const catalogEnd = catalogText.indexOf("**Reserved actions", catalogStart);
const actions = new Set(
  tokens(catalogText.slice(catalogStart, catalogEnd)).filter((token) =>
    /^[a-z]+\.[a-z_]+$/.test(token),
  ),
);

const auditText = read("docs/modules/audit.md");
const auditActions = new Set(tokens(auditText).filter((token) => /^[a-z_]+\.[a-z_]+$/.test(token)));

const enumsText = read("docs/reference/enums.md");
const kindsLine = enumsText.split("\n").find((line) => line.includes("`NotificationKind`")) ?? "";
const notificationKinds = new Set(
  tokens(kindsLine).filter((token) => /^[a-z_]+\.[a-z_]+$/.test(token)),
);

const columnOf = (table, pattern) => table.header.findIndex((cell) => pattern.test(cell));

const checkColumn = (file, table, pattern, valid, label, shape) => {
  const index = columnOf(table, pattern);
  if (index < 0) return;
  for (const row of table.rows) {
    for (const token of tokens(row[index] ?? "")) {
      if (!shape.test(token)) continue;
      if (!valid.has(token)) report(`${file}: ${label} "${token}" is not in its registry`);
    }
  }
};

const functionTables = tableRows(read("docs/reference/functions.md"));
for (const table of functionTables) {
  checkColumn("functions.md", table, /^Errors$/, errorCodes, "error code", /^[a-z_]+$/);
  checkColumn("functions.md", table, /^Audit/, auditActions, "audit action", /^[a-z_]+\.[a-z_]+$/);
  checkColumn(
    "functions.md",
    table,
    /^Notif/,
    notificationKinds,
    "notification kind",
    /^[a-z_]+\.[a-z_]+$/,
  );
  checkColumn("functions.md", table, /^Act\./, actions, "action", /^[a-z]+\.[a-z_]+$/);
}

const usedAudit = new Set();
const functionNames = new Set();
for (const table of functionTables) {
  const auditIndex = columnOf(table, /^Audit/);
  for (const row of table.rows) {
    if (auditIndex >= 0) for (const token of tokens(row[auditIndex] ?? "")) usedAudit.add(token);
    for (const cell of row)
      for (const token of tokens(cell)) functionNames.add(token.replace(/\(.*$/, ""));
  }
}
const catalogRows = tableRows(auditText).find((table) => table.header[0] === "Action")?.rows ?? [];
for (const row of catalogRows) {
  const action = tokens(row[0] ?? "")[0];
  if (action !== undefined && !usedAudit.has(action))
    report(`audit.md: action "${action}" is not written by any function in functions.md`);
  for (const token of tokens(row[2] ?? "")) {
    const name = token.replace(/\(.*$/, "");
    if (/^[a-z_]+$/.test(name) && !functionNames.has(name))
      report(`audit.md: "${name}" (writer of ${action}) is not in functions.md`);
    if (/^[a-z]+[A-Z]/.test(name) && !functionNames.has(name))
      report(`audit.md: "${name}" (writer of ${action}) is not in functions.md`);
  }
}

for (const table of tableRows(read("docs/reference/routes.md"))) {
  checkColumn("routes.md", table, /^Action$/, actions, "action", /^[a-z]+\.[a-z_]+$/);
}

if (problems.length > 0) {
  console.error(`\nDocumentation problems (${problems.length}):`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log("Docs consistent: links, error codes, actions, audit actions and notification kinds.");
