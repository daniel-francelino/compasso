import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../../../../", import.meta.url);
const rootPath = (path: string): string =>
  join(ROOT.pathname.replace(/^\/([A-Za-z]:)/, "$1"), path);
const decoded = (path: string): string => decodeURIComponent(rootPath(path));

const filesUnder = (directory: string): string[] =>
  readdirSync(decoded(directory), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

const read = (absolute: string): string => readFileSync(absolute, "utf8");

const isTestOrFixture = (path: string): boolean =>
  /\.test\.ts$/.test(path) || /fixtures\.ts$/.test(path);

const DESIGN_DIRS = [
  "src/lib/shared/design",
  "src/hooks/shared/design",
  "src/components/shared/design",
];

const SOURCES = DESIGN_DIRS.flatMap((directory) => filesUnder(directory));

const designSources = (): string[] => SOURCES;

const IMPORT_DIR = "src/lib/shared/design/import";
const importSources = (): string[] =>
  filesUnder(IMPORT_DIR).filter((path) => path.endsWith(".ts") && !isTestOrFixture(path));

const nameOf = (absolute: string): string =>
  relative(decoded(IMPORT_DIR), absolute).replaceAll("\\", "/");

describe("static guards on the import module", () => {
  it("has no psdMemoryBytes anywhere in src", () => {
    const offenders = designSources()
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => read(path).includes("psdMemoryBytes"))
      .filter((path) => !path.endsWith("static-guards.test.ts"));
    expect(offenders).toEqual([]);
  });

  it("budgets PSD decoding with DESIGN_LIMITS.rasterBudgetBytes", () => {
    expect(read(decoded(`${IMPORT_DIR}/worker/psd-runner.ts`))).toContain(
      "DESIGN_LIMITS.rasterBudgetBytes",
    );
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
      const source = read(decoded(`${IMPORT_DIR}/${name}`));
      expect(source, name).not.toMatch(
        /globalThis\.document|\bdocument\.(createElement|body|head|querySelector|getElementById|documentElement)/,
      );
      expect(source, name).not.toMatch(/\bwindow\b/);
      expect(source, name).not.toMatch(/from "react"/);
      expect(source, name).not.toMatch(/@\/(hooks|components)\//);
      expect(source, name).not.toMatch(/\blocalStorage\b|\bnavigator\b/);
    }
  });

  it("does not import hooks, components or React in any import source", () => {
    for (const path of importSources()) {
      const source = read(path);
      expect(source, nameOf(path)).not.toMatch(/from "react"/);
      expect(source, nameOf(path)).not.toMatch(/@\/(hooks|components)\//);
    }
  });

  it("has one PDF marker finder: the %PDF- literal lives only in sniff.ts", () => {
    const owners = importSources()
      .filter((path) => read(path).includes("%PDF-"))
      .map(nameOf);
    expect(owners).toEqual(["sniff.ts"]);
  });

  it("has one render implementation shared by the ai and pdf handlers", () => {
    for (const name of ["handlers/ai.ts", "handlers/pdf.ts"]) {
      expect(read(decoded(`${IMPORT_DIR}/${name}`))).toContain("renderPdfPageDesign");
    }
    const callers = importSources().filter((path) => read(path).includes("getDocument("));
    expect(callers.map(nameOf)).toEqual(["render-pdf-page.ts"]);
  });

  it("defines DESIGN_IMPORT_MESSAGE exactly once in src", () => {
    const owners = designSources()
      .filter((path) => /\.(ts|tsx)$/.test(path) && !isTestOrFixture(path))
      .filter((path) => /export const DESIGN_IMPORT_MESSAGE\s*=/.test(read(path)));
    expect(owners.map((path) => relative(decoded("src"), path).replaceAll("\\", "/"))).toEqual([
      "lib/shared/design/import/messages.ts",
    ]);
  });

  it("no longer has the removed format-specific modules", () => {
    for (const removed of [
      "src/lib/shared/design/design-import.ts",
      "src/lib/shared/design/import-file.ts",
      "src/lib/shared/design/ai-import.ts",
      "src/lib/shared/design/psd-import.ts",
    ]) {
      expect(existsSync(decoded(removed)), removed).toBe(false);
    }
  });

  it("runs pdf.js and the main-thread canvas only outside the worker files", () => {
    const offenders = importSources()
      .filter((path) => nameOf(path).startsWith("worker/"))
      .filter((path) => /pdfjs-dist|OffscreenCanvas|createImageBitmap/.test(read(path)))
      .map(nameOf);
    expect(offenders).toEqual([]);
  });
});

describe("static guards on the orchestrator hooks (read only)", () => {
  it("names no format in the generic hooks", () => {
    for (const name of ["use-design-import.ts", "use-import-place.ts"]) {
      const path = decoded(`src/hooks/shared/design/${name}`);
      if (!existsSync(path)) continue;
      expect(read(path), name).not.toMatch(/\b(psd|pdf|png|jpe?g|webp)\b/i);
    }
  });
});
