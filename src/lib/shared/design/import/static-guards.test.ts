import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const IMPORT_DIR = join(REPO_ROOT, "src/lib/shared/design/import");
const HOOK_DIR = join(REPO_ROOT, "src/hooks/shared/design");
const HOOK_FILES = ["use-design-import.ts", "use-import-place.ts"];

const isTestOrFixture = (path: string): boolean =>
  /\.test\.ts$/.test(path) || /fixtures\.ts$/.test(path);

const SOURCES = new Map<string, string>(
  readdirSync(IMPORT_DIR, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !isTestOrFixture(path))
    .map((path) => [relative(IMPORT_DIR, path).replaceAll("\\", "/"), readFileSync(path, "utf8")]),
);

const HOOKS = new Map<string, string>(
  HOOK_FILES.map((name) => [name, readFileSync(join(HOOK_DIR, name), "utf8")]),
);

const source = (name: string): string => {
  const text = SOURCES.get(name);
  if (text === undefined) throw new Error(`missing import source ${name}`);
  return text;
};

const namesWhere = (check: (text: string) => boolean): string[] =>
  [...SOURCES].filter(([, text]) => check(text)).map(([name]) => name);

describe("static guards on the import module", () => {
  it("has no psdMemoryBytes in the import module or the generic hooks", () => {
    expect(namesWhere((text) => text.includes("psdMemoryBytes"))).toEqual([]);
    for (const [name, text] of HOOKS) expect(text, name).not.toContain("psdMemoryBytes");
  });

  it("budgets PSD decoding with DESIGN_LIMITS.rasterBudgetBytes", () => {
    expect(source("worker/psd-runner.ts")).toContain("DESIGN_LIMITS.rasterBudgetBytes");
  });

  it("keeps DOM globals and React out of the worker side files", () => {
    const workerSide = [
      "worker/import.worker.ts",
      "worker/psd-engine.ts",
      "worker/psd-runner.ts",
      "worker/protocol.ts",
      "worker/validate-document.ts",
      "handlers/psd-decode.ts",
      "handlers/psd-plan.ts",
    ];
    for (const name of workerSide) {
      const text = source(name);
      expect(text, name).not.toMatch(
        /globalThis\.document|\bdocument\.(createElement|body|head|querySelector|getElementById|documentElement)/,
      );
      expect(text, name).not.toMatch(/\b(window|self)\b/);
      expect(text, name).not.toMatch(/from "react"/);
      expect(text, name).not.toMatch(/@\/(hooks|components)\//);
      expect(text, name).not.toMatch(/\blocalStorage\b|\bnavigator\b/);
    }
  });

  it("does not import hooks, components or React in any import source", () => {
    for (const [name, text] of SOURCES) {
      expect(text, name).not.toMatch(/from "react"/);
      expect(text, name).not.toMatch(/@\/(hooks|components)\//);
    }
  });

  it("has one PDF marker finder: the %PDF- literal lives only in sniff.ts", () => {
    expect(namesWhere((text) => text.includes("%PDF-"))).toEqual(["sniff.ts"]);
  });

  it("has one render implementation shared by the ai and pdf handlers", () => {
    expect(source("handlers/ai.ts")).toContain("renderPdfPageDesign");
    expect(source("handlers/pdf.ts")).toContain("pdfPageDesign");
    expect(namesWhere((text) => text.includes("getDocument("))).toEqual(["render-pdf-page.ts"]);
  });

  it("defines DESIGN_IMPORT_MESSAGE exactly once, in messages.ts", () => {
    expect(namesWhere((text) => /export const DESIGN_IMPORT_MESSAGE\s*=/.test(text))).toEqual([
      "messages.ts",
    ]);
  });

  it("no longer has the removed format-specific modules", () => {
    for (const removed of [
      "src/lib/shared/design/design-import.ts",
      "src/lib/shared/design/import-file.ts",
      "src/lib/shared/design/ai-import.ts",
      "src/lib/shared/design/psd-import.ts",
    ]) {
      expect(existsSync(join(REPO_ROOT, removed)), removed).toBe(false);
    }
  });

  it("runs pdf.js and the main-thread canvas only outside the worker files", () => {
    const offenders = namesWhere((text) =>
      /pdfjs-dist|OffscreenCanvas|createImageBitmap/.test(text),
    );
    expect(offenders.filter((name) => name.startsWith("worker/"))).toEqual([]);
  });
});

describe("static guards on the orchestrator hooks (read only)", () => {
  it("names no format in the generic hooks and fails if a hook file is renamed", () => {
    expect([...HOOKS.keys()]).toEqual(HOOK_FILES);
    for (const [name, text] of HOOKS) {
      expect(text, name).not.toMatch(/(?<![a-z])(psd|pdf|png|jpe?g|webp)(?![a-z])/i);
    }
  });
});
