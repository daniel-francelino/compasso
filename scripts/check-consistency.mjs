import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = "supabase/migrations";

if (!existsSync(MIGRATIONS)) {
  console.log("check:consistency: no migrations yet, nothing to compare.");
  process.exit(0);
}

const problems = [];
const report = (title, items) => {
  if (items.length > 0) problems.push(`${title}: ${items.join(", ")}`);
};
const difference = (left, right) => [...left].filter((item) => !right.has(item)).sort();

const sql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(MIGRATIONS, name), "utf8"))
  .join("\n");

const read = (path) => readFileSync(path, "utf8");
const quoted = (text, pattern) => new Set([...text.matchAll(pattern)].map((match) => match[1]));

const tsActions = quoted(read("src/lib/shared/auth/actions.ts"), /"([a-z_]+\.[a-z_]+)"/g);
const sqlActions = quoted(sql, /^\s+\('([a-z_]+\.[a-z_]+)', '[a-z_]+', '/gm);
const usedInSql = quoted(sql, /has_action\(\s*'([a-z_]+\.[a-z_]+)'\s*\)/g);

report("Actions used by has_action in SQL but missing in Action", difference(usedInSql, tsActions));
report("Actions in Action that no migration seeds", difference(tsActions, sqlActions));
report("Actions seeded by SQL but missing in Action", difference(sqlActions, tsActions));

const retiredCodes = new Set(["approver_without_access", "not_designated_approver"]);
const raised = new Set(
  [...quoted(sql, /raise exception '([a-z_0-9]+)'/g)].filter((code) => !retiredCodes.has(code)),
);
const errorsText = read("src/lib/shared/auth/errors.ts");
const messageCodes = quoted(errorsText, /^ {2}([a-z_0-9]+): \{/gm);
const registryText = read("docs/reference/error-codes.md");
const registryCodes = quoted(registryText, /^\| `([a-z_0-9]+)` \|/gm);

report("Codes raised in SQL without a message in errors.ts", difference(raised, messageCodes));
report(
  "Messages in errors.ts missing from docs/reference/error-codes.md",
  difference(messageCodes, registryCodes),
);

const catalogBlock =
  [...sql.matchAll(/v_catalog constant text\[\] := array\[([\s\S]*?)\];/g)].at(-1)?.[1] ?? "";
const sqlAudit = quoted(catalogBlock, /'([a-z_]+\.[a-z_]+)'/g);
const tsAudit = quoted(read("src/lib/shared/audit/actions.ts"), /"([a-z_]+\.[a-z_]+)"/g);
const docAudit = quoted(
  read("docs/modules/audit.md"),
  /^\| `([a-z_]+\.[a-z_]+)` \| `[a-z_]+` \|/gm,
);

report("Audit actions in SQL missing in AuditAction", difference(sqlAudit, tsAudit));
report("Audit actions in AuditAction missing in the SQL catalog", difference(tsAudit, sqlAudit));
report(
  "Audit actions in docs/modules/audit.md missing in AuditAction",
  difference(docAudit, tsAudit),
);
report(
  "Audit actions in AuditAction missing in docs/modules/audit.md",
  difference(tsAudit, docAudit),
);

const checkValues = (table, column, constant, file, definedIn = table) => {
  const tableBlock =
    sql.match(new RegExp(`create table public\\.${definedIn} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? "";
  const columnLine =
    tableBlock.match(
      new RegExp(`${column} text[^,;]*?check \\(${column} in \\(([^)]*)\\)\\)`),
    )?.[1] ?? "";
  const constraints = [
    ...sql.matchAll(
      new RegExp(
        `add constraint ${table}_${column}_check check \\(\\s*${column} in \\(([^)]*)\\)`,
        "g",
      ),
    ),
  ];
  const latestConstraint = constraints.at(-1)?.[1] ?? "";
  const added =
    latestConstraint !== ""
      ? latestConstraint
      : columnLine === ""
        ? (sql.match(
            new RegExp(
              `add column ${column} text[\\s\\S]*?check \\(\\s*(?:${column} is null or )?${column} in \\(([^)]*)\\)`,
            ),
          )?.[1] ?? "")
        : columnLine;
  const fromSql = quoted(added, /'([a-z_]+)'/g);
  const body =
    read(file).match(new RegExp(`export const ${constant} = \\{([\\s\\S]*?)\\} as const`))?.[1] ??
    "";
  const fromTs = quoted(body, /:\s*"([a-z_]+)"/g);
  report(`${table}.${column} CHECK values missing in ${constant}`, difference(fromSql, fromTs));
  report(`${constant} values missing in the ${table}.${column} CHECK`, difference(fromTs, fromSql));
};

checkValues("profiles", "status", "ProfileStatus", "src/lib/shared/enums.ts");
checkValues("media_shares", "status", "MediaShareStatus", "src/lib/shared/enums.ts");
checkValues("profiles", "kind", "ProfileKind", "src/lib/shared/enums.ts");
checkValues("audit_events", "actor_kind", "AuditActorKind", "src/lib/shared/enums.ts");
checkValues(
  "content_channels",
  "format",
  "ContentFormat",
  "src/lib/shared/enums.ts",
  "content_variants",
);
checkValues("content_items", "editorial_status", "EditorialStatus", "src/lib/shared/enums.ts");
checkValues("content_items", "objective_kind", "ContentObjective", "src/lib/shared/enums.ts");
checkValues(
  "content_channels",
  "publication_status",
  "PublicationStatus",
  "src/lib/shared/enums.ts",
  "content_variants",
);
checkValues("calendar_notes", "kind", "CalendarNoteKind", "src/lib/shared/enums.ts");
checkValues("calendar_notes", "repeat", "CalendarNoteRepeat", "src/lib/shared/enums.ts");
checkValues("approval_requests", "status", "ApprovalRequestStatus", "src/lib/shared/enums.ts");
checkValues("approval_decisions", "outcome", "ApprovalOutcome", "src/lib/shared/enums.ts");
checkValues("comments", "visibility", "CommentVisibility", "src/lib/shared/enums.ts");
checkValues("site_pages", "kind", "SitePageKind", "src/lib/shared/enums.ts");
checkValues("site_pages", "status", "SitePageStatus", "src/lib/shared/enums.ts");
checkValues("site_entries", "kind", "SiteEntryKind", "src/lib/shared/enums.ts");
checkValues("contact_messages", "status", "ContactMessageStatus", "src/lib/shared/enums.ts");

if (problems.length > 0) {
  console.error(`\ncheck:consistency found ${problems.length} problem(s):`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log(
  `check:consistency OK: ${tsActions.size} actions, ${raised.size} raised error codes, ${tsAudit.size} audit actions, 17 CHECK lists.`,
);
