import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { incomingText, insideProject, projectDir, readStdin, toRelative } from "./lib.mjs";

const input = await readStdin();
const toolInput = input.tool_input ?? {};
const relativePath = toRelative(toolInput.file_path);

if (!insideProject(relativePath)) process.exit(0);

const text = incomingText(toolInput);
const name = basename(relativePath);
const isNew = !existsSync(join(projectDir, relativePath));
const violations = [];

const deny = (message) => violations.push(message);

if (/^\.env(\..+)?$/.test(name) && name !== ".env.example") {
  deny("SEC-4: never read or edit .env files with secrets. Use .env.example (no values) and the env validation module.");
}

if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(text) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
  deny("SEC-4: the content looks like a secret (token or private key). Secrets never go into files of the repository.");
}

const spaces = ["marketing", "cms", "site", "portal"];
const forbiddenImports = {
  shared: spaces,
  marketing: ["cms", "site", "portal"],
  cms: ["marketing", "site", "portal"],
  site: ["marketing", "cms", "portal"],
  portal: ["marketing", "cms", "site"],
};

const isSource = /^src\/.+\.(ts|tsx)$/.test(relativePath);
const generated = /(routeTree\.gen\.ts|database\.types\.ts)$/.test(relativePath);

if (isSource && !generated) {
  const segmentNames = relativePath.split("/").slice(1);
  const fileName = segmentNames[segmentNames.length - 1] ?? "";
  const bareName = fileName.replace(/\.(functions|server|test)?\.?(ts|tsx)$/, "");
  if (/[A-Z]/.test(bareName) && !/^__root$/.test(bareName)) {
    deny(`CODE-8: file names are kebab-case (found "${fileName}").`);
  }

  const lines = text.split("\n");
  const commentLine = lines.find((line) => {
    const trimmed = line.trim();
    const isComment =
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*/") ||
      /^\{\s*\/\*/.test(trimmed);
    const allowed = /eslint-disable|@ts-expect-error/.test(trimmed);
    return isComment && !allowed;
  });
  if (commentLine !== undefined) {
    deny(`CODE-1: no comments in src (found: ${commentLine.trim().slice(0, 60)}). Express intent with names, types and small functions.`);
  }

  if (/\bconsole\.(log|error|warn|info|debug)\b/.test(text) && !/logger\.ts$/.test(relativePath)) {
    deny("CODE-2: no console in src. Use logError from src/lib/shared/logger.ts.");
  }
  if (/\bas\s+unknown\s+as\b/.test(text)) {
    deny("CODE-5: no `as unknown as`. Type the source or validate with zod (parseOutput).");
  }
  if (/:\s*any\b|\bas\s+any\b|<any>/.test(text)) {
    deny("CODE-5: no `any`. Use a precise type or unknown + validation.");
  }
  if (/[\w)\]]!(?=[.[),;]|\s*$)/m.test(text)) {
    deny("CODE-5: no non-null assertion (`!`). Narrow the type or handle the null case.");
  }
  if (/z\.enum\(\s*\[/.test(text)) {
    deny("CODE-4: use z.nativeEnum(Constant), not z.enum([...]).");
  }
  if (/["'`]#[0-9a-fA-F]{3,8}["'`]/.test(text) && !/color-field|chart/.test(relativePath)) {
    deny("UI-9: no hex colors in code. Use the tokens of styles.css (docs/standards/color-palette.md).");
  }
  if (/\b(bg|text|border|ring|fill|stroke)-(white|black)\b/.test(text)) {
    deny("UI-9: no pure white/black. Use palette tokens (ivory, surface, ink…).");
  }
  if (
    /\b(bg|text|border|ring|fill|stroke|from|to|via)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/.test(
      text,
    )
  ) {
    deny("UI-9: do not use the default Tailwind palette. Use palette tokens.");
  }
  if (/\b(localStorage|sessionStorage)\b/.test(text) && !/lib\/shared\/stored\.ts$/.test(relativePath)) {
    deny("CODE-4: browser storage goes through StoredKey + readStored/writeStored.");
  }
  if (/dangerouslySetInnerHTML/.test(text)) {
    deny("SEC-8: no dangerouslySetInnerHTML. Render rich text from JSON with the own renderer.");
  }
  if (/queryKey:\s*\[/.test(text)) {
    deny("CODE-4: query keys come from QueryKey factories, not inline arrays.");
  }
  if (/VITE_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE)/.test(text)) {
    deny("SEC-4: secrets never use the VITE_ prefix.");
  }
  if (/supabase\/admin\.server/.test(text) && !/\.server\.ts$|\.functions\.ts$/.test(relativePath)) {
    deny("SEC-5: the service-role client is only imported from allowed server modules.");
  }

  const owner = relativePath.match(/^src\/(?:components|lib|hooks)\/([^/]+)\//)?.[1];
  const forbidden = owner === undefined ? undefined : forbiddenImports[owner];
  if (forbidden !== undefined) {
    for (const other of forbidden) {
      const pattern = new RegExp(`from\\s+["']@/(components|lib|hooks)/${other}/`);
      if (pattern.test(text)) {
        deny(`ORG: the "${owner}" space must not import from "${other}". Move the shared piece to "shared" (docs/standards/project-structure.md).`);
      }
    }
  }
}

if (/^supabase\/migrations\//.test(relativePath)) {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
    deny("DATA-12: migrations are named YYYYMMDDHHMMSS_<module>_<change>.sql.");
  }
  if (!isNew) {
    deny("DATA-12: never edit an existing migration; add a new one (expand → migrate → contract).");
  }
  if (/create\s+table/i.test(text) && !/enable\s+row\s+level\s+security/i.test(text)) {
    deny("DATA-1: a migration that creates a table must enable RLS in the same file.");
  }
  if (/\bto\s+anon\b/i.test(text) && /create\s+policy/i.test(text)) {
    deny("DATA-1/DATA-2: no policies for anon; public reads go through dedicated security definer functions.");
  }
  if (/password\s*[:=]\s*['"][^'"]{4,}['"]/i.test(text) || /crypt\(\s*'[^']+'/i.test(text)) {
    deny("DATA-13: no passwords in migrations. The first Owner is created by scripts/seed-owner.mjs.");
  }
}

if (relativePath.startsWith("docs/")) {
  const segments = relativePath.split("/");
  const badSegment = segments.find((segment) => !/^[a-z0-9][a-z0-9.-]*$/.test(segment.replace(/^_/, "")) && segment !== "README.md");
  if (badSegment !== undefined || !relativePath.endsWith(".md")) {
    deny("DOC-1: documents are English kebab-case .md files (e.g. docs/modules/content.md).");
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Blocked by the project standards (docs/standards/base.md):\n- ${violations.join("\n- ")}\n` +
      `Fix the content and retry. If the rule itself must change, say so: the rule and its document are updated first (base.md section 9.1).\n`,
  );
  process.exit(2);
}

if (isNew && relativePath.startsWith("docs/") && relativePath !== "docs/README.md") {
  const isAudit = relativePath.startsWith("docs/audits/");
  const reason = isAudit
    ? "DOC-7: audit documents are one file per topic, updated in place. Confirm this is a NEW topic (otherwise add to the existing file) and add it to docs/README.md."
    : "DOC-3: one document per area; confirm this is not an overlap with an existing document and add it to docs/README.md.";
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    }),
  );
}

process.exit(0);
