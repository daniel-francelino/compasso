# Image editor: file import implementation plan

> Implementation plan for importing design files into the image editor ([image-editor.md](image-editor.md)). Date: 2026-11-18. Status: **Phase A (documents) done; Phase 0 (items 0-1 to 0-17) done in code with the deviations and the NOT proven list recorded in the Phase 0 status tables below and in [image-editor.md](image-editor.md) Implementation status; item 0-16 (build and chunk check) and item 0-18 (visual check) are not done. Next phase: Phase 1 (metadata), docs first: item 1-1 registers `DesignImportColorMode`, `metadata_truncated` and the other Phase 1 names before any code.** This file holds the plan and the work items only; the rules R1 to R12, A3 to A6, the limits and the decisions live in [image-editor.md](image-editor.md) section 8h (GOLD-1, DOC-3), so values are not repeated here and 8h wins on any difference. Names marked "proposed" must be registered before code (DOC-2, GOLD-4). Owner decision 2026-11-18: accept plan recommendations, for Phases A, 0 and 1 (8h.6); the open decisions of Phases 2 to 7 still wait for the owner (DOC-5).

## Decision

The editor imports PSD, AI, PDF pages, PNG, JPEG, WebP, TIFF, AVIF, GIF (first frame), palettes (ASE, ACO, GPL), fonts, SVG (raster, then vector), Sketch, Lottie (first frame), HEIC, CMYK with ICC, and later EPS, Figma and Canva. Imports run on the client. Phases are delivered in order; each phase closes only with an honest "Implementation status" (DOC-4).

| Phase | Delivers | Estimate |
|---|---|---|
| A | Documentation before code: section 8h and the rule changes R1 to R12 (written; the A-11 gate is pending, see Implementation status) | about 1 week |
| 0 | Harden PSD/AI: worker, per-layer decode, memory budget, pdf.js options (8h.4), PDF page 1, PNG/JPEG/WebP as layers | 1.5 to 2 weeks |
| 1 | Structured metadata (layers, text, fonts, colors, dimensions), no AI call | about 1.5 weeks |
| 2 | PDF pages, TIFF, AVIF, GIF, palettes | 2.5 to 3 weeks |
| 3 | SVG rasterized and fonts | about 2.5 weeks |
| 4 | Sketch | about 2 weeks |
| 5 | SVG vector and AI/PDF vector (highest risk) | 4 to 6 weeks |
| 6 | Lottie, HEIC, CMYK/ICC | 3 to 4 weeks |
| 7 | EPS, Figma, Canva (proposals only until unblocked) | 3 to 4 weeks each |

Order of delegation: A, then 0, then 1 sequentially; then phases 2, 3 and 4 as parallel streams that only add handler files, their own hooks and one registry line; then 5, 6, 7. Every phase passes `standards-reviewer` before code (docs first) and after; every parser phase passes `security-analyst`; `test-reviewer` reviews what `test-engineer` writes.

## Part 1 - Phases A, 0 and 1 (docs first, hardening of the PSD/AI draft, structured import metadata)

Date: 2026-11-18. Based on a read of the repository at commit `e65bc90`; nothing in Parts 1 to 3 has been run or tested (see Implementation status). Inputs: `.claude/CLAUDE.md`, `AGENTS.md`, `docs/standards/base.md`, `docs/modules/image-editor.md` (sections 8g, Implementation status), `docs/reference/enums.md` line 82, `docs/reference/error-codes.md` line 173, `docs/standards/ui-glossary.md` line 236, and the draft files `psd-import.ts` (431 lines), `ai-import.ts` (120), `design-import.ts` (122), `import-file.ts` (33), `use-design-import.ts` (96), `filter-client.ts` and `filter.worker.ts` (the existing worker pattern).

### 0. Conventions and corrections found while reading the repository

Phases here are named A, 0, 1. Work item ids are `<phase>-<n>`. "Registry first" means the name is written in `docs/reference/*`, `ui-glossary.md` or the stack table in the same change and BEFORE the code that uses it (GOLD-4, base 9.2). Anything not found in `docs/reference` is marked **proposed, add to registry first**. UI copy is pt-BR only; this document is English (DOC-1).

Corrections to the inputs found while reading the repository (all parts of this plan use them):

1. **The draft is no longer uncommitted.** `git status` at the time of writing was clean and commit `e65bc90 feat: implement AI and PSD file import functionality` already contains `psd-import.ts`, `ai-import.ts`, `design-import.ts`, `import-file.ts`, `use-design-import.ts` and their tests. Consequence: Phase 0 changes tracked files (use `git mv`, history kept) and `package.json` already holds `ag-psd ^34.2.1` and `pdfjs-dist ^6.5.438` while `docs/technical-architecture-v0.1.md` has no row for either (base 9.2 gap that exists today in `main`). The registry rows are therefore a defect fix, not only preparation.
2. **The two `no-nested-if` lint errors named in the plan (psd-import.ts lines 290 and 295) do not exist in the current file** (`leafOf` has one `if`; nothing nests there). Do not "fix" them; item 0-1 re-runs `npm run lint` and fixes only what it reports.
3. **`src/lib/shared/design/errors.ts` does not exist**; server codes live in `src/lib/shared/auth/errors.ts`. Client-only refusals stay `invalid` Result messages in a single catalog `DESIGN_IMPORT_MESSAGE`, moved to `src/lib/shared/design/import/messages.ts` (proposed). Base section 2 row "Result and errors" says "messages in `lib/shared/auth/errors.ts`"; that row is about server error codes. The import messages are not codes. The exception is recorded in base.md section 2, in 8h (R8) and in `error-codes.md` (A-6).
4. `docs/modules/brand-kit.md` does not exist (brand kit = `brands.visual_identity`, `brands.md`). Not needed in these phases.
5. `scripts/check-consistency.mjs` does not compare `DesignImportFormat` (TypeScript-only enum, no SQL column). So nothing mechanically forces enums.md and the TS constant to agree; GOLD-1 does. See decision A-D2.

### 1. Phase A - Documents and registries (docs only, no code)

#### Objective
Make the decision to import all formats a documented, approved rule set BEFORE any code moves (GOLD-3, base 9.1 order: restate in one line, list invalidated documents, change documents first). After Phase A every name used by Phases 0 and 1 exists in a registry and `check:docs` and `check:consistency` pass.

#### Scope
In: writing R1-R12 and A3-A6 in `image-editor.md` (section 4.3 Out, 4.4 Still out and technical limits, section 3 rows D2/SEC-8/ADR-14, 8g pointers, 8h new, header note); registries for the names Phases 0 and 1 use; stack rows for `ag-psd` and `pdfjs-dist`; ADR-14 note; media-library wording of R1; the base.md row of the message catalog (R8); one entry for Phase A in the module's Implementation status.
Out: any code, any migration, any new document besides this plan (decision A6: no new document for Figma, Canva or EPS); registering names for formats with no handler yet (decision A-D2); font, palette, SVG, Sketch, Lottie, EPS, HEIC, Figma, Canva wording beyond one line each in 8h (owned by the other two parts).

#### Prerequisites
- Owner approval of R1-R12 and A3-A6, given on 2026-11-18 (accept plan recommendations) and recorded in 8h.2 and 8h.6. A point that is not approved stays written in 8h as "Proposed, awaiting decision", never as decided.
- No baseline of `npm run check:docs` or `npm run check:consistency` was taken before editing, so a failure cannot be attributed by comparison. The only baseline is the Phase 0 spike (item 0-1): `lint`, `typecheck`, `format:check`, `test` (70 files, 700 tests) and `check:consistency` all passed on the code at `e65bc90`; `npm audit` and `build` were not run.

#### Work items

| Id | Description | Files to create/change | Registry names added FIRST | Owner agent | Depends on |
|---|---|---|---|---|---|
| A-1 | Approval of R1-R12 and A3-A6. Done: the owner delegated it and accepted the recommendations on 2026-11-18; the table is in 8h.2 (wording rebuilt from the plan is listed once under the 8h.2 table). | none | none | owner | none |
| A-2 | Edit `image-editor.md` as listed here: 4.3 Out (print/PDF wording, animation first frame), 4.4 Still out (CMYK/ICC moves to "in scope since 2026-11-18, last phase, editing stays RGB 8-bit"; "AI features" stays out; PSD/AI export stays out), technical limits ("unchanged by 8h"), section 3 rows D2 and SEC-8 (SVG clarification only; SEC-8 itself untouched), ADR-14 row, 8g item 1 menu name and "superseded in part by 8h" pointer, 8g item 4 budget pointer, 7b note "import phases: 8h", header sentence. Do not rewrite 8g history (add pointers). | `docs/modules/image-editor.md` | none | developer | A-1 answered |
| A-3 | Add section "8h. Decisions (2026-11-18, import of all formats)" after 8g with the sections 8h.1 to 8h.6 (entry and kinds, the rules table, the format table, limits and hardening, metadata, decisions of the plan). The format table (8h.3) has rows only for the formats with a handler in Phases 0 and 1 (decision A-D2); later phases append rows in their own change. | `docs/modules/image-editor.md` | none | developer | A-2 |
| A-4 | Registry: `enums.md` row `DesignImportFormat` rewritten (source file `src/lib/shared/design/import/types.ts`, see A-D3; values `psd`, `ai`, `pdf`, `png`, `jpeg`, `webp`; labels "PSD", "AI", "PDF", "PNG", "JPEG", "WebP"); new rows `DesignImportKind` (`document`, `image`; `palette`, `font` are added by the phase that needs them) and `DesignImportNoteKind` (only kinds emitted by Phases 0-1, see list in 0-4). "TypeScript only" for all. `DesignImportColorMode` and `metadata_truncated` are NOT registered here: item 1-1 registers them. | `docs/reference/enums.md` | `DesignImportFormat` (changed), `DesignImportKind`, `DesignImportNoteKind` | developer | A-3 |
| A-5 | Registry: glossary. Replace row "Importar PSD ou AI…" by "Importar…" (menu "Arquivo"); add rows for toast/progress ("Importando arquivo…", "<Formato> importado.", cancel control), one refusal row per situation used in Phases 0-1 (list in 0-4), one row per note kind, "Observações da importação". Phase 1 adds "Metadados da importação" only if decision 1-D1 chooses a visible consumer. Texts are written by the developer; this document names situations only. | `docs/standards/ui-glossary.md` | glossary terms | developer | A-4 |
| A-6 | Registry: `error-codes.md` paragraph at line 173 rewritten: "import adds no code; refusals are `invalid` Results whose texts live in `DESIGN_IMPORT_MESSAGE` at `src/lib/shared/design/import/messages.ts` and in the glossary rows". Add the line "reserved, registered only in Phase 1 with its migration if storage option B is approved: `design_import_metadata_too_large`" as plain text, NOT as a registry row (reserved names are not registry state; GOLD-1). | `docs/reference/error-codes.md` | none (paragraph) | developer | A-3 |
| A-7 | Stack table rows and ADR-14 note: `ag-psd` (MIT) and `pdfjs-dist` (Apache-2.0): version taken from `package-lock.json` and `npm ls ag-psd pdfjs-dist` (the plan says transitive `pako`, the analysis read only `base64-js`; resolve from the lockfile, record both the license and the transitive list actually installed), role, lazy load, bundle note (to be filled by the 0-12 `npm run build` numbers; write "measured in Phase 0" until then, update in 0-12). ADR-14 "Note (2026-11-18): browser-only stays the default; any server exception is per format and blocked". | `docs/technical-architecture-v0.1.md` | stack rows | developer | A-3 |
| A-8 | `media-library.md` section 7: clarify that the media library keeps refusing SVG and design files and that the editor's Design import is a separate path that stores no originals (R1/R3); no allowlist change. | `docs/spaces/media-library.md` | none | developer | A-3 |
| A-9 | Module Implementation status: one entry "Phase A (2026-11-18): documents only" in `image-editor.md` and the Implementation status section at the end of this plan, with the commands actually run (DOC-4, GOLD-6). If `docs/implementation-plan.md` has an import task row, update its status column (base 9.2 "Task finished"); if there is no row, do not invent one. | `docs/modules/image-editor.md`, maybe `docs/implementation-plan.md` | none | developer | A-2..A-8 |
| A-10 | Security review of the security-relevant statements in 8h (SVG not in DOM, pdf.js options, worker, budget, no stored originals, untrusted metadata, font and Figma lines as "blocked/proposed"). Reviewer states what it did not verify. Done 2026-11-18; its findings are applied in the fix round of the same day. | none (review comments) | none | security-analyst | A-3 |
| A-11 | Pending: re-gate after the fix round. Gate: rule compliance and docs-first order (9.1-9.3), registry coverage ("every name later used exists"), no second source of any rule (this plan points to 8h). This plan is already listed in `docs/README.md` and `docs/modules/README.md` (DOC-3, DOC-6). | none | none | standards-reviewer | A-2..A-10 |

#### Acceptance criteria
- `npm run check:docs` and `npm run check:consistency` pass and the output is pasted into the Implementation status line (A-9).
- `git diff --stat` shows only files under `docs/` (no `src/`, `supabase/`, `package*.json`).
- Every name in the "Consolidated proposed names" table (section 4) that Phases 0 and 1 use appears in exactly one registry row; `grep -rn "DESIGN_IMPORT_MESSAGE" docs` returns the new path only; the string "Importar PSD ou AI" appears in `docs/` only as history or as a replaced-name note.
- Section 8h contains no sentence describing an unapproved point as decided (each is labeled "Proposed, awaiting decision" with the user question).
- The ADR-14 note and the two stack rows exist; the 8g text still reads as history with pointers to 8h.
- standards-reviewer signs off in writing before Phase 0 starts.

#### Verification commands (base.md section 11)
`npm run check:docs` · `npm run check:consistency` · `npm run format:check` (docs are Prettier-formatted) · `git diff --stat` (scope check). Not applicable: lint/typecheck/test (no code), db commands.

#### Security notes
- R1 must not weaken the rule of image-editor.md section 3 (SVG never enters the DOM) nor SEC-8 (`dangerouslySetInnerHTML` stays forbidden). R3 must not weaken SEC-7: the media allowlist is unchanged; imports store no originals. State both in 8h so a later phase cannot cite the rewording as permission.
- The rule "metadata strings are untrusted data, never instructions" and the rule "no EXIF, ICC, GPS, document author or title is stored" (minimal data, SEC-12) are decided here, before the code that could violate them.
- The documents must not contain real credentials or customer file names; fixtures named in docs are generic.

#### Test scenarios
Documentation checks (no code): (1) `check:docs` fails if a registry is edited with a broken relative link: verify by reading the output. (2) Search for "uploaded SVG", "SVG not accepted" without the 8h qualifier. (3) Read-through that enums.md values equal the 8h.3 table rows (one-to-one). (4) Hostile-wording check: no sentence grants the import a path to store originals or call a provider.

#### Risks
- Writing "decided" before the user answers (violates GOLD-3). Mitigation: A-3 label rule and standards-reviewer check.
- Registry drift: names for phases not yet built (decision A-D2) would be dead documentation. Mitigation: register per phase.
- Parts 2 and 3 of this plan add rows to the same 8h table and enums rows: merge conflicts in docs. Mitigation: one owner serializes Phase A edits; later phases append rows only.

#### Blocked/needs-user items
- B1 (R1-R12, A3-A6): resolved by the owner decision of 2026-11-18; the only point still awaiting a decision is the document version 4 of R11 (8h.2).

#### Decisions (accepted by the owner on 2026-11-18; summary in image-editor.md 8h.6)
- A-D1: Where do the rules and limits live? Decided: section 8h of `image-editor.md`. This file holds the plan and the work items only and is a legitimate document of its own (DOC-3 allows creating a document without confirmation; it is listed in `docs/README.md` and `docs/modules/README.md`).
- A-D2: Register all future format values now or per phase? Decided: per phase. Phase A registers only values that have a handler in Phases 0-1 (`psd`, `ai`, `pdf`, `png`, `jpeg`, `webp`; kinds `document`, `image`; only emitted note kinds). Reason: a TS constant value with no handler is dead code (CODE-11), a registry row with no code diverges from the code (GOLD-1), and 8h.1 applies the same logic to blocked formats. Parts 2 and 3 append their values in their own change.
- A-D3: Is `DesignImportFormat` moved to `import/types.ts` in Phase 0 or Phase A? Decided: the docs name `import/types.ts` in Phase A and the enums row says that the code moves there in 0-2; the code move happens in 0-2.
- A-D5: R8 wording and base.md. Decided, docs first (base.md 9.1): the base.md row "Result and errors" allows the client-only import message catalog; 8h R8 and `error-codes.md` point to it. Authority chain: the owner's instruction of 2026-11-18 ("se tiver dúvida delega para algum agente verificar e aceita o que ele recomendar") plus the review agent's recommendation of the base.md 9.1 route over a silent exception. Revertible on owner veto. (A-D4 does not exist; the numbering skips it.)

### 2. Phase 0 - Harden PSD and AI, worker, per-layer decode, budget, images as layers, handler registry skeleton

#### Objective
Turn the committed PSD/AI draft into a safe pipeline for untrusted files: bytes are validated before any expensive decode, decoding runs off the main thread and cannot exceed the raster budget (8h.4), `pdf.js` runs hardened, PNG/JPEG/WebP import as layers through the same entry, and the code is shaped as a closed, format-agnostic skeleton (registry of handlers) so later phases only add files and one registry line.

#### Scope
In: PSD two-pass read in a worker with per-layer budget check before allocation; removal of `psdMemoryBytes` (768 MiB); AI/PDF hardening and `.pdf` page-1 import (same renderer, format `pdf`); PNG/JPEG/WebP (EXIF orientation honored, header pre-check); notes become `{kind, count}`; messages catalog and `DesignImportFormat` move; handler registry, `readDesignFile`, worker client/protocol; hook split into orchestrator and placer; menu "Importar…" and picker fix; PSD text/font/color capture is Phase 1 (0-5 only leaves the extraction points); dependency rows verified; tests and gates.
Out: PDF page selection (carousel limit, Phase 2 (item 2-4)), TIFF/AVIF/GIF, palettes, SVG, fonts, Sketch, Lottie, ICC/CMYK profile conversion, any server work, any migration, metadata (Phase 1), vector import, an interaction seam `needs_choice` (decision 0-D1), `palette`/`font` kinds.

#### Prerequisites
- Phase A signed off (A-11), including R8, R9, R10 approvals.
- Baseline commands run and recorded (0-1): `npm run lint`, `typecheck`, `format:check`, `test`, `check:consistency`, `check:docs`. The tests of the draft were never run in the analysis.
- Spike result of 0-1 (below) before 0-6 starts.

#### Target layout (proposed, trimmed to what Phase 0 needs)

```
src/lib/shared/design/import/
  types.ts        ImportedDesign, ImportHandler, ImportKindResult (document | image), DesignImportFormat, DesignImportKind, DesignImportNoteKind (as const objects, z.nativeEnum)
  messages.ts     DESIGN_IMPORT_MESSAGE (one catalog) + note sentences keyed by DesignImportNoteKind
  limits.ts       DESIGN_IMPORT_LIMITS (global): maxPageSide, minPageSide, workerTimeoutMs, maxLayerSide; per-format maxBytes lives in each handler
  sniff.ts        startsWith, extensionOf, importBaseName, SNIFF_HEAD_BYTES
  registry.ts     IMPORT_HANDLERS (one line per format) + derived DESIGN_IMPORT_ACCEPT + format->kind
  read-file.ts    readDesignFile(file, newId): size gate by file.size, head sniff, extension check, handler lookup, run, Result
  worker/protocol.ts, import.worker.ts, worker-client.ts
  handlers/psd.ts (+ psd-decode.ts for the worker side), ai.ts, pdf.ts, image.ts
hooks: use-design-import.ts (orchestrator only), use-import-place.ts (current place())
```

Removed in the same change (CODE-11): `design-import.ts`, `import-file.ts`; `psd-import.ts` and `ai-import.ts` moved with `git mv` under `import/handlers/`.

Dependency direction (base section 2, spaces): handlers never import hooks or components; worker files never import React; `types.ts` imports nothing from handlers.

#### Work items

| Id | Description | Files to create/change | Registry names added FIRST | Owner agent | Depends on |
|---|---|---|---|---|---|
| 0-1 | Baseline and spike. (a) Run the six commands, record verbatim results (the draft tests were never run). (b) Spike in a scratch folder outside the repo, reading `node_modules/ag-psd` types and README sections on untrusted data: confirm the exact option names for structure-only read, whether one layer can be decoded without decoding all (and how), `totalMemoryLimit` semantics, whether `readPsd` runs in a worker without a DOM canvas using `useImageData`. (c) Confirm the installed `pdfjs-dist` 6.5.438 `getDocument` option names (`disableAutoFetch`, `disableStream`, `disableRange`, `enableXfa`, `cMapUrl`, `standardFontDataUrl`, `useWorkerFetch`; the spike of 2026-11-18 found no `isEvalSupported` and no `enableScripting` in `getDocument` of 6.5.438) against its `.d.ts`, and that rendering with `canvas` + `background` still works. (d) Decide fallback for ag-psd (see 0-5) and write the outcome in the Implementation status. The ag-psd 34.2.1 options were verified in the spike and are written in 8h.4. | none in repo (scratch only), Implementation status text | none | developer | A-11 |
| 0-2 | Skeleton and moves: create `import/` folder; `types.ts` (move `DesignImportFormat`, `ImportedDesign`; add `ImportHandler`, `ImportKindResult`); `messages.ts` (move `DESIGN_IMPORT_MESSAGE`, `DESIGN_IMPORT_LABEL` becomes the glossary label, `IMPORT_UPLOAD_REASON` stays); `limits.ts`; `sniff.ts`; `registry.ts`; `read-file.ts`; `git mv` of psd/ai files; delete `design-import.ts` and `import-file.ts`; update imports in `use-design-menus.ts` and the hook. Contract `ImportHandler = { format, kind, extensions: readonly string[], maxBytes, runsIn: "worker" or "main" (proposed field, a closed union, not an enum row), sniff(head), decode(file or bytes, context) }`; `decode` returns `Result`, never throws for expected failures (CODE-15). | `src/lib/shared/design/import/*`, moved files, `use-design-menus.ts` | enums.md rows (A-4) | developer | A-11, 0-1 |
| 0-3 | Extension and sniff rules: type decided by content; extension must be in the handler's `extensions` (so `jpg` and `jpeg` both accepted for `jpeg`); signatures: PSD `8BPS` + version 1 at offset 4 (PSB version 2 refused with the PSB message), PDF `%PDF-` starting before byte 1024 (8h.4), PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `RIFF` + `WEBP` at offset 8, AI also `%!PS-Adobe` start. `ai` and `pdf` share the PDF signature: the extension decides which handler runs (a `.ai` with PDF content is `ai`; a `.pdf` is `pdf`); a `.ai` or `.pdf` whose content is not PDF/PS-Adobe is refused with the existing mismatch message. Ordering in the registry: first match wins, signatures are mutually exclusive except ai/pdf. One shared function finds the PDF start offset: header window 1024 bytes for files starting with `%PDF-` near the start; whole-file scan only for `%!PS-Adobe` files (done by the handler, not by the sniffer); the sniffer and `extractPdfBytes` use the same function (removes the plan's inconsistency, analysis risk 6). | `import/sniff.ts`, `import/registry.ts`, `handlers/ai.ts`, `handlers/pdf.ts` | none | developer | 0-2 |
| 0-4 | Notes as data: `ImportedDesign.notes` becomes `{ kind: DesignImportNoteKind; count: number }[]`; sentences in `messages.ts`. Registry first (A-4/A-5): `DesignImportNoteKind` values used here: `text_as_pixels`, `smart_object_as_pixels`, `layer_style_dropped`, `adjustment_layer_dropped`, `blend_mode_fallback`, `clipping_partial`, `groups_flattened`, `flattened_image_only`, `cmyk_converted`, `depth_reduced`, `first_page_only` (ai/pdf), `downscaled`, `animation_ignored` (animated WebP only). `vector_mask_dropped` is NOT emitted by the draft today; register it only if 0-5 detects it. Refusal situations needing glossary rows in Phase 0: file too large (limit shown), unsupported type, extension/content mismatch, PSB, PSD color mode, PSD/AI/PDF corrupt, encrypted PDF/AI, AI without PDF compatibility, canvas too large, canvas too small, no visible layers, too many layers, layer too large, memory budget exceeded, decode timed out, import cancelled (no toast needed, see 0-10), image corrupt, image too large to decode (declared pixels), "importar exige permissão" (exists). | `import/types.ts`, `import/messages.ts`, mapping in `handlers/psd.ts`, tests | glossary rows, enums rows | developer | 0-2 |
| 0-5 | PSD hardened (two-pass, worker). Main thread, before the worker: `file.size <= maxBytes` (8h.3), head sniff, `readPsdHeader` on the head (dimension and mode checks exist and are correct). Worker pass 1 (options and arithmetic in 8h.4): structure only, no pixel decode, `readPsd` with the 8h.4 option set; walk the layer tree iteratively (no recursion, so a 10 000-deep tree cannot overflow the stack); count layers; reject when (leaf layers) > `editor.page.elements` capacity (`DESIGN_LIMITS.maxElements` minus existing elements, passed in the request) or group depth beyond the data it can flatten; for each layer compute declared pixel bytes with overflow-safe arithmetic (`BigInt` or `Number.isSafeInteger` checks, width and height are uint32 in the file; include mask rectangles, bit depth and channel count, CMYK = 5 channels) and refuse a layer whose side exceeds `DESIGN_IMPORT_LIMITS.maxLayerSide` (8h.4, decision 0-D2) or whose decoded bytes exceed the remaining raster budget. Compute `plannedBytes = sum(min(layer rect, page rect) bytes)` and refuse before any decode when `store.usedBytes() + plannedBytes > DESIGN_LIMITS.rasterBudgetBytes` (existing constant, R10). Worker pass 2 (spike result, 8h.4): `getLayerImageData` / `getLayerMaskImageData` one layer at a time, dropping each `PixelData` before the next; the worker calls `initializeCanvas` with a non-canvas `createImageData`; the pass-1 arithmetic is the only brake because those calls have no memory cap; the exact error `Exceeded memory limit` maps to the memory-budget message. The whole-file `readPsd` with `totalMemoryLimit` fallback was not needed and is not in the code (see the Phase 0 deviations). Crop to page and bake the mask inside the worker, release the source layer data after each layer, transfer each result `ArrayBuffer` back (transferables). Remove `psdMemoryBytes`. The worker returns a plain `WorkerDocument` (layer tree descriptors + buffers; no functions, no element ids); the main thread maps it to elements with the existing mapping code (`psdToDesign` logic: blend table, groups, clipping, naming) so the mapping stays pure and unit-testable and `newId` never crosses the worker boundary. Layer names pass through the existing 80-char cap and control-character strip (0-8 in Phase 1 shares the sanitizer). Capture extraction points for Phase 1 (text, font) but do not store metadata yet. | `handlers/psd.ts`, `handlers/psd-decode.ts` (worker side), `worker/*`, `import/limits.ts` | `DESIGN_IMPORT_LIMITS.maxLayerSide`, `workerTimeoutMs` (code constants; values in 8h.4) | developer | 0-1, 0-2, 0-4 |
| 0-6 | Worker infrastructure following the existing pattern of `filter-client.ts` / `filter.worker.ts` (module worker, transfer buffers, terminate on error). Protocol: zod discriminated union `request { id, format, file (File) or head, limits }`, `response { id, status: progress | result | error }`; the main thread validates every response with zod (`parseOutput`-style), checks that every buffer `byteLength === width * height * 4`, that dimensions respect the limits and that the total re-meets the budget (defense in depth: do not trust the worker's arithmetic). One decode at a time queue; `timeout` (`workerTimeoutMs`, value in 8h.4) terminates the worker and returns the "timed out" message; `cancel()` terminates the worker and rejects with a cancelled marker handled silently by the hook; on `onerror`/`onmessageerror` return a generic read-failed message and `logError` with a fixed context label and the error name or class only (8h.4). A worker is used only where we control the parser (PSD, later TIFF, fonts, Sketch); it is a responsiveness boundary, not a security boundary, so its output is revalidated on the main thread (R6). Pass the `File` to the worker (structured clone, no 100 MB copy on the main thread); the worker reads it. Feature-detect `Worker`; if absent the import is refused with the generic message (no unguarded main-thread decode of PSD). | `import/worker/protocol.ts`, `import.worker.ts`, `worker-client.ts` | none | developer | 0-2 |
| 0-7 | AI and PDF hardened (main thread render, pdf.js's own worker). `getDocument` options exactly as 8h.4 (bytes as data only, never a url; `disableAutoFetch`, `disableStream`, `disableRange`, `enableXfa: false`; `useWorkerFetch` false or unset; no `cMapUrl`, `standardFontDataUrl` or other URL option; `maxImageSize` = `aiMaxImagePixels`; bundled same-origin `workerSrc`; canvas-only render; `stopAtErrors` as stated there; `pdfjs-dist` version floor), accepting the fidelity loss for non-embedded fonts (stated in 8h.4); transfer the PDF bytes instead of a `slice()` copy. Today's `ai-import.ts` is not hardened until this item. Pre-render checks: first page viewport dimensions finite and > 0 (NaN/Infinity/negative refused), `aiRenderSize` result within page limits, planned canvas bytes plus `store.usedBytes()` within the raster budget BEFORE `createElement("canvas")`; time budget: race `task.promise`/render against `workerTimeoutMs` and `task.destroy()` on timeout or cancel; `finally` always `destroy()`; release the canvas (width/height 0) on every path. Encrypted/password PDF refused (existing `PasswordException` check) and, because pdf.js can also raise other exceptions for encryption, add a test for owner-password-only files (they open without a password and are rendered; state it). The PDF with a JavaScript action is rendered as pixels with no script execution (scripting is inert because only `page.render` to a canvas runs); test, do not assume. Native decoders and pdf.js run under their own isolation with the timeout of 8h.4, which abandons the work and discards the result (R6). `pdf` handler = same renderer, page 1 only, note `first_page_only` when the page count > 1 (page selector is Phase 2 (item 2-4)); layer name from the file name. | `handlers/ai.ts`, `handlers/pdf.ts` (shared `render-pdf-page.ts` helper, one implementation, GOLD-2) | none | developer | 0-2, 0-3 |
| 0-8 | PNG/JPEG/WebP handler `image` kind: head sniff; **pre-decode dimension check from the header bytes** (PNG IHDR at offset 16/20, JPEG by scanning SOFn markers over the segments within the bounded window of 8h.4, WebP VP8/VP8L/VP8X headers) so a 65535 x 65535 declared image is refused without decoding; refuse unparseable headers; size check `declared w*h*4` against the raster budget; then `createImageBitmap(file-blob, { imageOrientation: "from-image" })` (in the worker when `OffscreenCanvas` 2D is available, otherwise main thread with the same pre-checks), `getImageData`, close the bitmap. Dimensions are taken AFTER orientation (EXIF 90-degree rotations swap width and height, so check both orders). Larger than the page maximum (8h.4) on a side: downscale with `resizeWidth/resizeHeight` (aspect preserved, note `downscaled`); smaller than the page minimum (8h.4): canvas-too-small message. A header not found or not parsed within its window is refused; after decode the actual size must equal the declared size or the result is discarded (8h.4). No EXIF, GPS, XMP, IPTC, ICC, comment or text chunks or embedded thumbnails are read or stored (R3; only pixels). Names from the file or file name go through the 8h.5 sanitizer. Animated WebP: first frame, note `animation_ignored` (detect the VP8X animation flag). Result kind `image`: placed as one raster layer named after the file (80-char cap); on an empty page the page takes the (clamped) size; on a non-empty page the image is fit inside the page, centered, never upscaled (decision 0-D3). | `handlers/image.ts`, `handlers/image-header.ts` (pure parsers, unit-testable), registry lines | none | developer | 0-2, 0-3, 0-6 |
| 0-9 | Hook split. `use-design-import.ts` becomes the orchestrator: pick file, `readDesignFile`, on `document` and `image` results delegate to `use-import-place.ts` (the current `place()` logic: element capacity, raster budget, `store.set` rollback, `markChanged`, `editor.addImported`). The orchestrator switches over the result kind with an exhaustive `never` check and never names a format. Keep busy state and double-submit guard; add cancel; ignore results that arrive after unmount. `pickFile`: attach the hidden input to the DOM before `click()` and remove it after (iOS/Safari), accept list derived from the registry (not hard-coded `.psd,.ai`). Menu label becomes the glossary term "Importar…" (replaces `DESIGN_IMPORT_LABEL`). History label "Importar <Formato>" uses the enum labels. Permissions unchanged: `design.update` + `media.upload` via `canPaint` and `IMPORT_UPLOAD_REASON`. | `hooks/shared/design/use-design-import.ts`, `use-import-place.ts`, `use-design-menus.ts`, `lib/shared/design/browser.ts` | glossary rows (A-5) | developer | 0-2, 0-6, 0-8 |
| 0-10 | UI for progress, cancel and notes: loading toast with a cancel action while the worker runs; success toast with the notes sentences (today a joined string); decide whether a longer notes panel is needed (glossary "Observações da importação", needs `lost-ui` check first, CLAUDE.md item 10). Keyboard and contrast per tokens; copy pt-BR in the glossary. | components under `src/components/shared/design/` only if a panel is approved; otherwise toast only | glossary rows | ux-ui-designer | 0-4, 0-9 |
| 0-11 | Tests designed: hostile and normal lists (section "Test scenarios"), as programmatic fixtures generated in the test (no downloaded or customer files, no network). | list handed to test-engineer (in the item, not a repo file) | none | test-designer | 0-1 |
| 0-12 | Tests written. Unit (Vitest, node/jsdom): header parsers, sniffers, `readPsdHeader`, structure-pass validation with a stubbed decoder spied for "decode not called", budget arithmetic incl. overflow, mapping from `WorkerDocument` to elements, worker protocol validation (malformed responses), image header parsers, `aiRenderSize` edge values, notes mapping. Worker client with a fake `Worker` (timeout, cancel, error). Real worker, canvas and pdf.js behavior are NOT unit-testable in jsdom: cover with one Playwright e2e per path (`npm run e2e`) using generated tiny fixtures, with request interception proving zero network requests during a PDF import; if e2e cannot run in the environment, report "not tested". | `*.test.ts` next to each new file, `e2e/design-import.spec.ts` (proposed name) | none | test-engineer | 0-3..0-9, 0-11 |
| 0-13 | Independent test review: does each hostile test fail when the guard is removed (mutation check by hand: remove the pre-decode check and see the "decode not called" test fail); are tests tied to the contract and not to the implementation. | review comments | none | test-reviewer | 0-12 |
| 0-14 | Security review (mandatory, parser of untrusted bytes): worker message validation, resource limits arithmetic, pdf.js options effect, timeout/terminate behavior, no storage of originals, no network, error messages not leaking file content, `logError` receives no file bytes or text. | review comments | none | security-analyst | 0-5..0-8 |
| 0-15 | Code review and standards gate: CODE-1/2/5/6/7/11 (no comments, no console, no `any`/`!`, no nested if, files under 600 lines, no dead code after removing `design-import.ts`/`import-file.ts`), GOLD-2 (single message catalog, single PDF renderer, single mapping), dependency direction, `z.nativeEnum`, no loose strings. | review comments | none | code-reviewer then standards-reviewer | 0-12..0-14 |
| 0-16 | Build and chunk check: `npm run build`; record raw/gzip sizes of the main chunk, `ag-psd`, `pdfjs-dist` and the worker chunks, confirm neither library is in the main chunk; update the stack rows (A-7) with the numbers. Chunk-size budget proposal is a user decision (section 5, B3). | `docs/technical-architecture-v0.1.md`, Implementation status | none | developer | 0-9 |
| 0-17 | Module docs: Implementation status (files moved/removed, commands run with verbatim results, e2e run or not, manual browser matrix NOT run, real-device NOT run), 8h item for limits (R10) marked implemented, glossary and enums reconciled with the code (GOLD-1). | `docs/modules/image-editor.md`, registries | none | developer | all above |
| 0-18 | Visual check of the menu item, toasts and any panel against tokens and glossary at 360 px, tablet, desktop (UI-7 context). | review comments | none | design-review | 0-10 |

#### Phase 0 status (2026-11-18; the record is in [image-editor.md](image-editor.md) Implementation status)

| Item | Status | Note |
|---|---|---|
| 0-1 | done | Baseline and spike (ag-psd 34.2.1, pdfjs-dist 6.5.438); baseline on `e65bc90`: lint, typecheck, format:check, test (70 files, 700 tests), check:consistency passed; `npm audit` and `build` not run |
| 0-2 | done | Skeleton, moves and removals as listed in the module entry |
| 0-3 | done | Sniff by content, extension check, PDF marker inside the first 1024 bytes through one function |
| 0-4 | done with deviation | Notes are data; the `.ai` always-on "one layer" note was removed (only `first_page_only` for more than one page) |
| 0-5 | done with deviation | Deviations 1, 2, 3, 4, 5, 6 below |
| 0-6 | done | Worker, client and protocol; real browser behavior not proven |
| 0-7 | done with deviation | Deviation 9 below; real rendering, network and JavaScript-action PDF not tested |
| 0-8 | done with deviation | Deviation 1 and 8 below |
| 0-9 | done with deviation | No `renderHook` (no jsdom); logic exported as plain functions; wrapper and unmount effect not run by tests |
| 0-10 | done | Toast only, with the cancel action; no notes panel |
| 0-11 | done | Scenario lists became programmatic fixtures; no repo file by design |
| 0-12 | done with deviation | Unit tests only (node); e2e were NOT written, by owner decision (CLAUDE.md item 11) |
| 0-13 | not done | No hand mutation check of the hostile tests was run; mutation testing NOT run |
| 0-14 | done | Security review; findings F1 to F10 fixed, F11 accepted, PDF byte copy accepted as residual |
| 0-15 | done | Code review and standards findings fixed (review fixes 1 to 9 in the module entry) |
| 0-16 | not done | `npm run build` NOT run, by owner decision (machine resources); chunk sizes in the stack rows were measured once before that decision and not re-measured; no chunk-size budget (B3 is the owner's) |
| 0-17 | done | Module entry rewritten as one Phase 0 record; registries checked against the code (below) |
| 0-18 | not done | No browser, no 360 px, tablet or desktop check |

Deviations from the items above:

1. Image decode runs on the main thread (`runsIn: "main"`) with a race against `workerTimeoutMs` and the abort signal, not in the worker; a decode already running in the browser cannot be interrupted.
2. The composite fallback is a second structure read with `skipCompositeImageData: false`, because ag-psd keeps `rawCompositeData` only then; tested with a fake engine only.
3. The per-layer peak check charges decoded pixels plus the crop (about 2x for a layer fully inside the page), plus the mask; conservative on purpose.
4. The sanitizer removes U+200D (every `Cf`, `Zl`, `Zp`, `Co` and tag character), so emoji joiner sequences lose the joiner.
5. pdf.js `stopAtErrors` is `false` (render what can be read).
6. The whole-file `totalMemoryLimit` fallback was removed (not needed).
7. The PDF byte copy in `ownedBytes` stays (pdf.js detaches the buffer it receives): accepted residual.
8. For PNG and WebP the EXIF orientation is not parsed; the post-decode size check accepts the planned size or its swapped size.
9. The always-on `.ai` note was removed (see 0-4).

Not proven (need a browser or a real file): module-worker bundling, `ImageData` in the worker, real peak memory and out-of-memory behavior, `destroy` during a render, EXIF agreement with the real decoder, the network log, the jsonb refusal of a lone surrogate, an abandoned image decode after a timeout, the real ag-psd composite fallback, the owner fixtures (B2).

#### Acceptance criteria (verifiable)
1. A PSD file of 100 MiB with a declared 5 000 layers is refused with the "too many layers" message and a spy on the decode function records zero calls (unit test).
2. A PSD with one layer declaring width/height whose bytes exceed the remaining raster budget, and a PSD with a uint32 width x height product above `Number.MAX_SAFE_INTEGER`, are refused before decode (unit tests); the check uses `DESIGN_LIMITS.rasterBudgetBytes` and `store.usedBytes()`; `grep -rn psdMemoryBytes src docs` returns nothing.
3. A PSD import never decodes pixels on the main thread: the main thread only receives validated buffers (test with a fake worker plus code review); cancel terminates the worker (unit test with a fake) and releases no buffers into the store.
4. A malformed worker response (wrong buffer length, extra fields, dimensions above limits) is rejected and nothing is placed.
5. AI/PDF: options of 0-7 present in `getDocument` (unit test on the options object built by a pure function); encrypted PDF refused; PDF with a JavaScript action renders as pixels and no script ran (e2e or manual evidence, reported as such); zero network requests during import (e2e request interception, or "not tested").
6. `%PDF-` detection uses one function for sniff and extraction (grep shows a single implementation, test covers the offsets of 8h.4 for `.pdf`, `%!PS-Adobe` with embedded PDF accepted for `.ai`).
7. PNG, JPEG, WebP happy paths import as a layer; a PNG whose IHDR declares 65535 x 65535 in a 1 KB file is refused without calling `createImageBitmap` (spy); EXIF orientation 6 JPEG imports with swapped dimensions (test of header parser plus e2e/manual evidence); a `.png` file containing JPEG bytes is refused as mismatch.
8. The hook contains no format name (grep for `psd`, `ai`, `pdf`, `png` in `use-design-import.ts` and `use-import-place.ts` returns nothing); the accept list equals the registry's derived list.
9. `design-import.ts` and `import-file.ts` no longer exist; `DESIGN_IMPORT_MESSAGE` has one definition at `import/messages.ts`.
10. `npm run build` output shows `ag-psd` and `pdfjs-dist` outside the main chunk; sizes recorded.
11. All base 11 commands pass or the failure is stated; manual browser matrix and real-device checks are listed as NOT done in the Implementation status.

Acceptance status (2026-11-18):

| AC | Status |
|---|---|
| 1 | proven by unit test (`psd-plan.test.ts` refuses 5000 leaf layers; the decoder spy records zero calls in `psd-runner.test.ts`) |
| 2 | proven by unit test (budget and uint32 overflow cases in `psd-plan.test.ts`); `psdMemoryBytes` appears in `src` only as the string of a static guard test |
| 3 | proven by unit test with a fake worker (`worker-client.test.ts`, `worker-hostile.test.ts`; `validateWorkerDocument` is exercised in `protocol.test.ts`); real worker not proven |
| 4 | proven by unit test (`protocol.test.ts`, `worker-hostile.test.ts`) |
| 5 | options object proven by unit test (`buildPdfOpenOptions`); encrypted refusal proven by unit test with a fake task; the JavaScript-action PDF and the zero-network-request parts are NOT proven (no e2e, no browser) |
| 6 | proven by unit test and static guard (one `%PDF-` finder, offsets 0, 900, 1023 accepted and 1024, 1500 refused, `%!PS-Adobe` for `.ai`) |
| 7 | happy paths, the 65535 x 65535 header refused without `createImageBitmap`, and the mismatch refusal are proven by unit test; EXIF orientation 6 is proven for the header parser only, agreement with the real browser decoder is NOT proven |
| 8 | proven by static guard (`static-guards.test.ts`); the accept list is derived from the registry (`registry.test.ts`) |
| 9 | proven by static guard |
| 10 | NOT proven: `npm run build` was not run, by owner decision; earlier sizes are stale |
| 11 | partly: lint, typecheck, format:check, test, check:consistency and check:docs passed; build and e2e NOT run; manual browser matrix and real devices NOT done |

#### Verification commands (base.md section 11)
`npm run lint` · `npm run typecheck` · `npm run format:check` · `npm run test` · `npm run check:consistency` · `npm run check:docs` · `npm run build` (chunk check) · `npm run e2e` (when fixtures and environment allow). `supabase`/`db:*` commands: not applicable (no SQL change; say so).

#### Security notes
- Trust boundary: file bytes and the worker's response are both untrusted for the main thread's arithmetic (validate again). A worker is a responsiveness boundary, not a security boundary: a parser bug could return inconsistent data.
- Budget before decode, per layer, with overflow-safe math; this is the control for decompression and memory bombs. Time budget and `terminate()` are the control for CPU bombs.
- pdf.js: the options of 8h.4 (no `isEvalSupported` and no `enableScripting` exist in 6.5.438; no auto-fetch, no URL options); keep `pdfjs-dist` patched (version floor and CVE in 8h.4); run `npm audit` and report the real output rather than assuming.
- Originals are never stored or uploaded (R3; the only future exception is an accepted font in Phase 3 under its own SEC-7 change); only re-encoded pixel layers go through the existing flush.
- Never log file names with personal data, file bytes or text; `logError` gets a fixed context label and the error name or class, never the message of an error raised while parsing file content (SEC-12, 8h.4).
- Messages never echo file-derived strings into `invalid` texts (no XSS or injection in toasts; toasts render text, not HTML).
- No `dangerouslySetInnerHTML`; nothing from the file is rendered as HTML (layer names appear as text in the existing layers panel).
- Permission check (menu, `design.update` + `media.upload`) is unchanged; the import adds no server surface, so SEC-1 layers 3 and 4 are unaffected; the placement write goes through the existing autosave, which already validates (document size cap `design_too_large`).
- Residual: a 100 MiB PSD must still be read by the worker (memory = file + decode). Peak memory is not measured here; real-device checks are the user's.

#### Test scenarios (hostile inputs included)
PSD / structure:
- 8BPS signature with 25 bytes (short header); version 2 (PSB); color mode Lab/duotone/multichannel; depth 16/32 (accepted with note); width 0, 63, 4097, 0xFFFFFFFF; height likewise.
- Layer count field 65535 or declared 5000 with a 100 MB body; layer rect 300000 x 300000; layer rect negative origin far outside the page; layer with zero area; layer width x height overflow in 32-bit and above safe integer.
- Group nesting 5 000 deep (iterative walk must not overflow the stack; depth above 8 flattened with the note); duplicate/huge layer names (1 MB name capped to 80, control and bidi characters stripped, a name that looks like `<img onerror=...>` stays inert text); a text layer with a 5 MB string (Phase 1 caps).
- Mask larger than layer; mask with imageData length mismatch (existing null path); clipping on first layer.
- Truncated file at every structural boundary (header, resources, layers, composite); a polyglot PSD+PDF (8BPS first wins); a PSD whose decode throws mid-way (worker error response, state released).
- Decode memory: sum of layers within budget individually but over budget together; existing store already holding 400 MiB.
PDF / AI:
- Encrypted (user password), owner-password-only, JavaScript `OpenAction`, `/Launch`, `/URI` actions (inert); MediaBox 0, negative, 1e9 points, NaN; 100 000 pages (only page 1 touched); page tree cycles; font with corrupt tables; image XObject 100 000 x 100 000 (`maxImageSize` guard); `%PDF-` at the accepted and refused offsets of 8h.4 for a `.pdf`; `%!PS-Adobe` file with no embedded PDF (not-PDF message) and with several `%PDF-` markers; a PDF that never finishes rendering (timeout path with a fake clock); worker destroyed during render (`destroy` always called).
Images:
- PNG IHDR 65535 x 65535 tiny body; PNG with trailing garbage; truncated JPEG; progressive JPEG with SOF after 100 KB of APP segments (found within window) and with SOF beyond the window (refused with the unreadable-header message); CMYK JPEG (decode may fail: image-corrupt message, no crash); EXIF orientation 1-8; animated WebP (first frame, note); WebP with invalid VP8X; `.png` extension with JPEG/PSD/PDF/zero bytes; `.JPG` uppercase extension.
Orchestration:
- Two imports triggered quickly (second ignored while busy); component unmounts during import (result discarded, worker terminated); permission missing (menu disabled with reason); page already near the 200 elements limit; paint stroke consuming budget between check and placement (placement re-checks and rolls back the store, existing `place` rollback behavior retained); cancel before the worker starts and after the first progress message; worker `onerror`.
Docs: A-phase checks of section 1 re-run after Phase 0 (glossary rows equal `messages.ts` keys: 1-to-1 script check or manual review).

#### Risks
- The ag-psd per-layer decode may not exist as an API (0-1 spike). Resolved by the spike: ag-psd has `getLayerImageData` and `getLayerMaskImageData`, so the per-layer decode exists and the whole-file fallback was removed.
- `OffscreenCanvas` 2D inside workers varies (Safari). The image handler needs a main-thread fallback with the same pre-checks; that path is not covered by the worker timeout (documented gap).
- Header parsing for JPEG is bounded by a window; unusual files beyond it are refused (false refusals possible; message says to re-export).
- Scope creep and conflicts with the other two parts: they add handlers/registry lines; this part must finish the skeleton first (it owns `types.ts`, `registry.ts`, `read-file.ts`, `worker/*`, hook, menu). Serialize.
- Bundle/chunk growth from worker code splitting: measured in 0-16, not assumed.
- Mapping behavior must not change silently while moving files: keep existing `psd-import.test.ts` assertions passing unchanged except for note shape (reviewer checks the diff of tests).
- Behavior change for users: `.pdf` and images are new accepted inputs; menu label changes.

#### Blocked/needs-user items
- B2: owner-provided fixtures (PSD RGB/CMYK/text/groups/masks, Illustrator AI, Canva PDF, one CMYK JPEG, one EXIF-rotated JPEG) for the golden comparison and the 20-layer 1080 x 1350 timing check; without them those acceptance checks stay "not tested".
- B3: chunk-size budget numbers and the acceptable import time (the plan's "a few seconds" is a proposal); real-device (iOS Safari, Firefox, Chrome) timing and memory: only the owner/QA can run.
- B1: resolved. R8, R9, R10 and the menu rename ("Importar…") are recorded in 8h (2026-11-18).

#### Decisions (accepted by the owner on 2026-11-18; summary in image-editor.md 8h.6)
- 0-D1: Define the `needs_choice`/`ImportInteraction` seam now or at Phase 2 (item 2-4)? Decided: at Phase 2 (item 2-4). With only `document` and `image` kinds and no consumer, the seam is dead code (CODE-11); the result union is closed and exhaustive, so adding a kind later is one `types.ts` edit plus one `case`. Parts 2 and 3 follow this.
- 0-D2: Layer side and size policy for PSD. Decided: layers are not refused merely because they extend beyond the page; a layer is refused when its declared side exceeds `DESIGN_IMPORT_LIMITS.maxLayerSide` or its decode bytes exceed the remaining raster budget (values in 8h.4); the rest is cropped to the page. The earlier test line "layer larger than page refused" is replaced by "layer larger than budget refused".
- 0-D3: Image larger than the page on a non-empty page. Decided: fit inside the page (contain), centered, never upscale, note `downscaled` when scaled.
- 0-D4: Timeouts. Decided: the time limits of 8h.4, held as `DESIGN_IMPORT_LIMITS` constants and tunable after the timing check.
- 0-D5: Per-format size cap. Decided: the caps of the 8h.3 table (images lower than PSD/AI/PDF).
- 0-D6: PDF render location. Decided: the main thread (pdf.js's own worker parses) with timeout and cancel; moving it needs `OffscreenCanvas` support in pdf.js render, which is not verified.

### 3. Phase 1 - ImportedDesign structured metadata (deterministic, no AI call)

#### Objective
Extend `ImportedDesign` with a validated, size-capped `metadata` object (layer tree, text runs, fonts, colors, dimensions, color mode, source format) produced deterministically from the file, so a later, separately decided feature can use it. No model call, no provider, no network (R5). Strings from files are untrusted data.

#### Scope
In: `ImportedDesignMetadata` type and zod schema with caps and sanitization; extraction for PSD (full), image (dimensions, source format, color mode `unknown` or `rgb`), AI/PDF (page dimensions, page count, source format; text extraction is Phase 2 (item 2-4)); a typed reader; one consumer so the data is not dead (decision 1-D1); A3 is decided (option B): table + function + audit action + client call (items 1-7 to 1-12).
Out: any Claude/provider call or prompt building; sending metadata off the device; PDF text/font extraction; dominant-color analysis of pixels; EXIF/ICC/GPS/PDF document-info fields; retention/purge tooling; versions/templates carrying metadata; vector, font files, palettes.

#### Prerequisites
- Phase 0 merged (skeleton, worker `WorkerDocument`, notes model).
- A3 is decided (option B, 8h.2); items 1-1 to 1-6 do not depend on it.
- Registry names added first (below).

#### Metadata model (proposed names; add to registry first)

`ImportedDesignMetadata` (TypeScript type + `importedDesignMetadataSchema`, file `src/lib/shared/design/import/metadata.ts`):
- `version` (integer, starts at 1)
- `source`: `format` (`DesignImportFormat`), `colorMode` (`DesignImportColorMode`), `bitsPerChannel` (integer or null), `pageCount` (integer or null)
- `dimensions`: `sourceWidth`, `sourceHeight`, `pageWidth`, `pageHeight` (page values after clamp/downscale)
- `layers[]`: `index`, `parentIndex` (or null), `name`, `kind` (closed union local to the metadata, values in 8h.5; not an enum row), `visible`, `opacity`, `blendMode` (source name string, capped), `bounds` (left, top, width, height)
- `textRuns[]`: `layerIndex`, `text`, `fontName` (or null), `fontSize` (or null), `color` (`{r,g,b}` integers or null; not hex strings, to stay clear of the hex ban and to be exact)
- `fonts[]`: `name`, `usageCount`
- `colors[]`: `{r,g,b}`, `source` (values in 8h.5), `count`
- `truncation`: booleans per list (`layers`, `textRuns`, `fonts`, `colors`) and `textCharsDropped` count

Caps are the code constants listed in 8h.5 (the owner can tune them); the whole-JSON cap is also the SQL cap. On overflow: truncate, set `truncation`, emit the import note `metadata_truncated` (decided: kept; registered by item 1-1). Sanitizer (one function, shared with layer names): Unicode NFC, strip C0/C1 controls except newline in text, strip bidi overrides/isolates (U+202A-202E, U+2066-2069) and zero-width characters, collapse nothing else, truncate on code points not UTF-16 units.

#### Work items

| Id | Description | Files to create/change | Registry names added FIRST | Owner agent | Depends on |
|---|---|---|---|---|---|
| 1-1 | Registry and doc: `DesignImportColorMode`, the metadata shape described in 8h.5 (one table of fields and caps), glossary term "Metadados da importação" if 1-D1 chooses a visible consumer, enums rows for `DesignImportColorMode` and for the `metadata_truncated` note kind (decided: kept; also added to `DesignImportNoteKind`). | `enums.md`, `ui-glossary.md`, `image-editor.md` (8h.5) | `DesignImportColorMode`, `metadata_truncated` (optional), "Metadados da importação" | developer | Phase 0 done |
| 1-2 | `metadata.ts`: zod schema (`z.nativeEnum` for enum fields, no `z.enum` literal list), constants for caps, `sanitizeImportText`, `buildMetadata(parts)` that applies caps and sets truncation flags, `parseImportedDesignMetadata(value)` typed reader that returns `Result`. Pure, no DOM, no worker dependency. | `import/metadata.ts` | none | developer | 1-1 |
| 1-3 | PSD extraction in the worker's decode pass: layer tree from the structure pass (names, visibility, opacity, blend mode name, bounds, kind from `layer.text`/`layer.placedLayer`/`layer.adjustment`/vector data/children), text runs from `layer.text` (string, font name and size and fill color from the style runs; exact ag-psd field names to be read from the installed type definitions, not guessed here), colors from text fills and solid-color layer data when present, `bitsPerChannel`, `colorMode`. Everything goes into `WorkerDocument.metadataParts`; the main thread validates with the schema. A metadata failure never fails the import (metadata is best-effort; layers still import; note `metadata_truncated` or none). | `handlers/psd-decode.ts`, `handlers/psd.ts` | none | developer | 1-2, Phase 0 |
| 1-4 | Image and AI/PDF extraction: dimensions, source format, page count (pdf.js `numPages`), `colorMode` `rgb` for decoded images, `unknown` for PDF. No EXIF, ICC, GPS, PDF Info dictionary (title, author, producer) or XMP. | `handlers/image.ts`, `handlers/ai.ts`, `handlers/pdf.ts` | none | developer | 1-2 |
| 1-5 | `ImportedDesign.metadata` attached by `readDesignFile`; orchestrator passes it on. Consumer (decision 1-D1): "Baixar metadados (JSON)" is NOT built; the consumer is the persistence call in 1-10. Text runs are persisted only when a named consumer exists (8h.5); until then layer names and fonts only (no consumer = do not ship, CODE-11). | `use-design-import.ts`, `use-import-place.ts` | none | developer | 1-3, 1-4 |
| 1-6 | Tests designed and written (see scenarios): schema, caps, sanitizer, extraction mapping from fixture `WorkerDocument`, "metadata failure does not fail import", no forbidden fields present. | `import/metadata.test.ts`, handler tests | none | test-designer, then test-engineer | 1-2..1-5 |
| 1-7 | Registry first: `data-model.md` table `design_import_metadata` (proposed: `id`, `design_id`, `brand_id`, `source_format`, `metadata jsonb`, `created_by`, `created_at`; composite FK `(design_id, brand_id)` to `designs`; no update or delete policy; RLS `design.view` and `can_access_brand` on read, never through `portal_*`; `ON DELETE CASCADE` with the design), `functions.md` (`design_record_import`, action `design.update`, audit action `design.import_recorded`, errors), `audit.md` action `design.import_recorded` (metadata in the audit event: format and layer count only, never file text), `error-codes.md` row `design_import_metadata_too_large` -> `invalid` with pt-BR message, glossary message. Retention statement: rows are deleted with their design (`on delete cascade`); `created_by` references `profiles (id)` with no `on delete` action, so deleting a profile that recorded an import is blocked, not cascaded (same as `designs` and `design_exports`); no separate retention job (decision 1-D3, 8h.5); the function keeps only the latest 20 rows of a design (Phase 1 hardening, 8h.5). | reference docs, `audit.md`, `image-editor.md` | table, function, audit action, error code (all proposed) | developer | A3 approved, 1-1 |
| 1-8 | Migration `YYYYMMDDHHMMSS_design_import_metadata.sql` (name pattern per base 4): table, composite FK, RLS, size check on the jsonb (`octet_length`) raising `design_import_metadata_too_large`, function `design_record_import` (`security definer`, like `design_record_export` and the other design functions: `assert_action('design.update')`, loads the design by id and answers `not_found` when the caller has no link to its brand, refuses a trashed design with `design_trashed`; an archived brand is not checked, as in the other design writes), `audit_write` inside the same transaction, grants. `npm run db:types`. Local only; production push needs the owner's explicit instruction (8e item 11). | `supabase/migrations/*`, `supabase/tests/NN_design_import_metadata.test.sql`, generated types | as 1-7 | developer | 1-7 |
| 1-9 | Data review: RLS matrix (viewer, editor without `design.update`, other brand, external roles denied), composite FK integrity, no update/delete policy, cap enforced in SQL, audit event content has no file text, behavior when the design is archived. | review comments | none | data-integrity-auditor | 1-8 |
| 1-10 | Server function `recordDesignImport` (name proposed) in `design.functions.ts`: zod input (design id + metadata validated with the same schema, parsed again on the server, SEC-6), `requireActionServer(design.update)`, calls the RPC, `parseOutput` on the result, errors through `fail`; client call after a successful placement in the orchestrator; a failure of the record never rolls back the placement: a toast says the metadata was not saved, `logError` without file text. Idempotency: not required (append-only rows; double click is prevented by the busy guard). **Status 2026-11-18: done** (server function and client call; the call lives in the orchestrator `use-design-import.ts`, details and what is not tested in [image-editor.md](image-editor.md) Implementation status). | `lib/shared/design/design.functions.ts`, `use-import-place.ts` | function name in `functions.md` (1-7) | developer | 1-8 |
| 1-11 | pgTAP and unit tests for 1-8/1-10; `npx supabase db reset`, `npx supabase test db` (or the PGlite fallback `npm run db:verify`, stating that it is not equivalent). | `supabase/tests/*`, `design.functions` tests | none | test-engineer, test-reviewer | 1-8, 1-10 |
| 1-12 | Security review: untrusted strings into JSON and into SQL (parameterized, no concatenation), prompt-injection posture (strings stored and read as data; the typed reader never concatenates them into instructions; a comment-free doc sentence in 8h.5 that any future consumer must frame them as untrusted), privacy (text may hold personal data: retention equals design life, no export outside the app, no log), size and truncation. Code review and standards gate as in Phase 0. | review comments | none | security-analyst, code-reviewer, standards-reviewer | 1-6, 1-11 |
| 1-13 | Implementation status and docs reconciled; data-model, functions, audit, error-codes rows now match the migration (GOLD-1). | `image-editor.md`, registries | none | developer | all above |

#### Acceptance criteria (verifiable)
1. For a generated fixture PSD (tree with 3 groups, 12 layers, 4 text layers with known strings, fonts and colors) the metadata contains exactly: the same layer count and names, the same text strings, the same font names, the same colors (unit test comparing against the fixture definition).
2. Oversize input (3 000 layers, a 5 MB text string, 500 fonts) yields metadata within every cap, `truncation` flags true, and the whole JSON length under the cap (unit test asserting `JSON.stringify(metadata).length` and the flags).
3. Metadata contains no key outside the schema (strict zod object): no EXIF, ICC, GPS, document title/author, file path or file system data (test with a fixture carrying such fields).
4. Control, bidi-override and zero-width characters are removed from names and text; strings are truncated on code points (test with surrogate pairs at the boundary).
5. An exception thrown inside metadata extraction does not fail the import and does not remove placed layers (test).
6. No import of `fetch`, provider SDKs or `lib/shared/ai` appears in `import/` (grep returns nothing); no network call occurs during import (e2e interception or "not tested").
7. pgTAP proves RLS (authorized insert via the function; direct insert, update and delete denied; other brand denied), the size cap error, the audit event with no file text, and `npm run check:consistency` passes with the new error code and audit action in both TS and docs.
8. The Implementation status states which metadata is stored (layer names and fonts until a text consumer exists) and which is not.

#### Verification commands (base.md section 11)
`npm run lint` · `npm run typecheck` · `npm run format:check` · `npm run test` · `npm run check:consistency` · `npm run check:docs`. If SQL: `npx supabase db reset` · `npx supabase test db` · `npm run db:types` (fallback `npm run db:verify`, reported as non-equivalent). `npm run e2e` for the no-network check when available.

#### Security notes
- Metadata derives from attacker-controlled files: validate with a strict schema on the client AND again on the server (SEC-6); never trust the client-computed object.
- SEC-12: text inside a design file may be personal data. Store the minimum: no EXIF/GPS/author/title/path; audit metadata carries only ids, format and layer count; no logs of strings. Text strings are stored only for a named consumer (8h.5); rows are deleted with their design and by any brand or user deletion path, with no separate retention job.
- Prompt injection: layer names and text such as "Ignore previous instructions" are stored verbatim as data. The only guard in this phase is structural (no AI call, typed reader, documentation). A future consumer needs its own review (provider contract), not covered here.
- Row-level security and brand scope: design id comes from the client; the function must load the design with the caller's rights (SEC-3) and never trust a client brand id.
- No service-role client (SEC-5): the function runs as the caller.
- Size caps in TS and SQL are both enforced so a direct RPC call cannot bypass the client cap.

#### Test scenarios (hostile inputs included)
- Layer name of 1 MB, names with only whitespace, names with RTL override (U+202E) making a filename look reversed, zero-width joiners, null bytes, lone surrogates (invalid UTF-16 must not make `JSON.stringify` throw or produce invalid output; normalize with `toWellFormed` or an equivalent guard, verify availability on the target browsers before relying on it).
- Text layer containing a prompt-injection string, SQL injection text (`'; drop table`), HTML (`<script>`), a `javascript:` URL: stored as inert text; never rendered as HTML (check the consumer in 1-5/1-10 uses text rendering).
- Font name 10 KB; 500 distinct fonts; font name equal to `__proto__` or `constructor` (use `Map`, not plain object keys, so prototype pollution is impossible).
- Color values out of range, NaN, negative, floats (clamped integers 0-255, otherwise the color is dropped).
- Text run count 1 000 000 (stopped early, flags set, memory bounded: extraction must stop iterating, not collect then slice).
- Metadata JSON exactly at, one below and one above the cap; schema with extra keys (rejected by strict mode on the server).
- Concurrent second import with the same file while the first record is in flight (two rows allowed, no uniqueness expected; verifying no error).
- Server function called with a design id of another brand (RLS denies), with a trashed design (existing error), with no `design.update` (denied), with a valid design and oversized jsonb (error code), with a malformed jsonb (zod error with `fields`).
- Extraction failure mid-way (stub throwing) leaves import intact (acceptance 5).

#### Risks
- ag-psd's text API shape and the structure pass may not expose per-run fonts and colors the way the plan assumes; 1-3 reads the installed types first and may deliver less (fonts per layer only). Record what was and was not extractable (honest gap).
- Building the full layer list for 1 000 layers plus text can be expensive in the worker; mitigated by early stop and caps.
- Storage option B holds file-derived text for the life of the design: privacy and retention exposure until a purge policy exists (GOLD-8 forbids deletion; legal/privacy owner decision).
- Metadata decoupled from design versions: restoring an old version does not restore metadata; acceptable because rows record imports, not current state (documented).
- A new table and function is the heaviest part and the only migration in these phases; pushing it to production is a separate owner decision.
- Over-shipping: extraction without a consumer is dead code (1-D1).

#### Blocked/needs-user items
- A3 is decided (option B, 8h.2); items 1-7 to 1-11 can start after Phase 0 and item 1-1.
- B4: production push of the migration (8e item 11): owner instruction only.
- B5: any use of the stored metadata by a model provider: separate decision (provider contract). This part builds nothing toward it beyond the typed reader.
- B2: fixtures for golden comparison of metadata against the owner's real PSDs (generated fixtures cover logic only).

#### Decisions (accepted by the owner on 2026-11-18; summary in image-editor.md 8h.6)
- 1-D1: Consumer of the metadata in Phase 1. Decided: the persistence of option B (append-only table written by `design_record_import`) is the consumer; without it nothing of Phase 1 beyond the schema and its tests ships, because unused data is dead code.
- 1-D2: Text strings. Decided: stored only for a named consumer, within the cap of 8h.5; until a consumer exists, text runs are not persisted (layer names and fonts only).
- 1-D3: Purge path for stored metadata. Decided: no separate retention job; rows are deleted with their design (`ON DELETE CASCADE`) and by any brand or user deletion path (8h.5); revisit with a privacy policy decision.
- 1-D4: Layer `kind` list. Decided: a local closed union documented in 8h.5 (not used outside metadata; an enums.md row would be a second list of kinds next to `DesignElementKind`, GOLD-2).
- 1-D5: Colors from pixels (dominant colors). Decided: out of Phase 1 (only declared colors), because it is a different feature with its own accuracy tests.
- 1-D6: Cap values. Decided: the caps of 8h.5 stay as placeholders until the owner's real files are measured.

### 4. Consolidated proposed names (all "proposed, add to registry first" unless marked existing)

| Name | Kind | Where it must be registered | Phase |
|---|---|---|---|
| `DesignImportFormat` values `pdf`, `png`, `jpeg`, `webp` (existing `psd`, `ai`) | enum | `enums.md` (row exists, source path and values change) | A/0 |
| `DesignImportKind` (`document`, `image`) | enum | `enums.md` | A/0 |
| `DesignImportNoteKind` (values listed in 0-4) | enum | `enums.md`, glossary sentences | A/0 |
| `DesignImportColorMode` | enum | `enums.md` | A/1 |
| `DESIGN_IMPORT_MESSAGE` new path `src/lib/shared/design/import/messages.ts` | catalog (code constant) | `error-codes.md` paragraph, glossary | A/0 |
| `DESIGN_IMPORT_LIMITS.maxLayerSide`, `workerTimeoutMs` | code constants | 8h.6 | 0 |
| Menu "Importar…", toasts, refusals, notes, "Observações da importação", "Metadados da importação" | UI terms | `ui-glossary.md` | A/0/1 |
| `ag-psd`, `pdfjs-dist` rows | stack | `technical-architecture-v0.1.md` | A |
| `ImportedDesignMetadata`, `importedDesignMetadataSchema`, `sanitizeImportText` | code (types) | 8h.5 (shape and caps table) | 1 |
| Table `design_import_metadata`, function `design_record_import`, audit action `design.import_recorded`, error `design_import_metadata_too_large`, server function `recordDesignImport` | data/function (only if A3 = B) | `data-model.md`, `functions.md`, `audit.md`, `error-codes.md` | 1 |
| Existing and reused, not new: `DESIGN_LIMITS` (4096, 200, 512 MiB, name 80), actions `design.update` and `media.upload`, `Result`/`invalid`, `logError`, `RasterStore`, `addImported` | existing | none | 0/1 |

Cross-part dependencies for Parts 2 and 3: they append handler rows to 8h.3, enum values to `enums.md`, one registry line and messages per phase; they must not edit `types.ts`, `registry.ts`, `read-file.ts`, `worker/*`, the hook or the menu without the Phase 0 owner; palette/font kinds and `needs_choice` are added by the phase that first needs them (decision 0-D1).

### 5. Blocked / needs-user (consolidated)

| Id | Needs | Phases affected | What is NOT done meanwhile |
|---|---|---|---|
| B1 | Resolved 2026-11-18 (owner: accept plan recommendations): R1-R12, A3-A6, see image-editor.md 8h.2. Still awaiting: the document version 4 of R11 | A, 1 | Unapproved points stay "Proposed, awaiting decision" |
| B2 | Owner-authorized fixtures (PSD RGB/CMYK/text/groups/masks, AI, Canva PDF, CMYK JPEG, EXIF-rotated JPEG) | 0, 1 | Golden comparison and timing checks are reported "not tested" |
| B3 | Chunk-size budget and import-time threshold; real-device checks (iOS Safari, Firefox, Chrome desktop, memory) | 0 | Only measured sizes are recorded; no performance claim |
| B4 | Production push of any migration | 1 | Migration stays local |
| B5 | Any provider use of stored metadata (provider contract) | beyond 1 | Nothing built |

Validation limits of this plan: nothing described here has been run; ag-psd/pdf.js option names, `OffscreenCanvas` and `createImageBitmap` worker support and the `toWellFormed` availability were not verified; versions and licenses come from the analysis and the lockfile must confirm them; bundle sizes are the analysis' file sizes, not a Vite build.

## Part 2 - Phases 2, 3 and 4 (PDF pages, raster formats, palettes; SVG and fonts; Sketch)

Date: 2026-11-18. Aligned with Part 1 (corrections: the PSD/AI draft is COMMITTED in e65bc90 and the tree is clean; enum values are registered per phase; `needs_choice` is NOT built in Phase 0). Nothing in this part has been run or tested. Inputs: base.md (GOLD-1..8, CODE-12/15, SEC-6/7/8/12, 9.1-9.3, 11), image-editor.md, docs/reference/*, and the committed PSD/AI draft in `src/lib/shared/design/` and `src/hooks/shared/design/` (read only), plus Part 1.

### 0. Shared conventions for this part

#### 0.1 Assumptions (Phases A, 0 and 1 exist)

- Registry layout of Part 1 (Target layout): `src/lib/shared/design/import/{types,messages,limits,sniff,registry,read-file}.ts`, `worker/{protocol,import.worker,worker-client}.ts`, `handlers/<format>.ts`, hooks `use-design-import.ts` (frozen orchestrator) and `use-import-place.ts`.
- The handler contract is part 1's: `{ format, kind, extensions, maxBytes, runsIn, sniff, decode }`; `decode` returns `Result`, never throws for expected failures (CODE-15). Phase 0 has NO `needs_choice`; this part designs and builds it (item 2-0, section 0.4) and must be reconciled with the real `import/types.ts` before 2-0 starts.
- `ImportedDesign` (Phase 1) is a single page: `{ format, width, height, elements, buffers, notes, metadata }`. Multi-page import is NOT assumed (see D2-1).
- Enum registration is PER PHASE (decision A-D2, 8h.6): Phase A/0 register only `psd, ai, pdf, png, jpeg, webp`, kinds `document, image`, and only the note kinds Phase 0 emits (`first_page_only`, `downscaled`, `depth_reduced`, `cmyk_converted`, `animation_ignored`, ...). THIS part registers its own values in the same change as the handler: Phase 2 adds `tiff, avif, gif, ase, aco, gpl`, kind `palette`, note kind `swatch_converted` (proposed); Phase 3 adds `svg, ttf, otf, woff, woff2`, kind `font`, note kinds `vector_rasterized`, `fonts_not_imported`, `DesignFontLicenseClass`; Phase 4 adds `sketch` and note kind `unsupported_node`. `DesignImportFormat` lives in `src/lib/shared/design/import/types.ts` (part 1 moves it there in 0-2). Anything not in `docs/reference` is marked **proposed, add to registry first**.
- Phase 0 outputs this part builds on (part 1): `import/messages.ts` holds `DESIGN_IMPORT_MESSAGE` (the single catalog; there is no design `errors.ts`; refusals are `invalid` Results, not error codes); `design-import.ts` and `import-file.ts` are gone; `use-design-import.ts` is a format-agnostic orchestrator with an exhaustive `never` switch over result kinds and `use-import-place.ts` places `document` and `image` results; handler contract `{ format, kind, extensions, maxBytes, runsIn: "worker" | "main", sniff(head), decode(...) }`; `handlers/pdf.ts` and `handlers/ai.ts` share ONE `render-pdf-page` helper (0-7); `handlers/image.ts` and the pure `image-header.ts` header parsers cover PNG/JPEG/WebP (0-8); Phase 1 provides `import/metadata.ts` with `sanitizeImportText` and `buildMetadata` (reuse it for palette names, font strings and Sketch layer names; do not write a second sanitizer, GOLD-2).
- The `needs_choice` seam, the `palette` result kind and the `font` result kind do NOT exist before this part: Phase 2 builds the seam (item 2-0) and adds `palette`, Phase 3 adds `font`. Each is one `types.ts` edit plus one `case` in the orchestrator (the exhaustive switch makes a missing case a compile error).
- Existing names reused (do not recreate): `DESIGN_LIMITS` (`types.ts`: page 4096, `maxElements` 200, `maxGroupDepth` 8, `rasterBudgetBytes` 512 MiB, `layerNameMax` 80), `DesignFont` (closed enum of 8 curated fonts, `types.ts` line 61), `visualIdentitySchema` (`src/lib/shared/brands/visual-identity.ts`: max 12 colors, name 1-40, hex `#rrggbb`, max 8 fonts, name 1-60), `getDesignBrandKit`, `saveBrand` (needs `brands.update`), actions `design.update`, `media.upload`, `brands.update`, `startFilterJob` worker pattern (`filter-client.ts`).

#### 0.2 Collision rules (parallel streams)

Each handler work item only ADDS files named in the table and ONE registry line per format (separate line, blank line between entries, merged last by the integrator). Shared append-only points: `import/messages.ts` (one block per stream, keyed by format), enum rows in `types.ts` and `enums.md` for the stream's own values, `docs/*` registries. Edits to closed files are limited to two deliberate, serialized changes, each its own work item with its own review: 2-0 (`types.ts` and the orchestrator: `needs_choice` seam and `palette` kind) and 3-8 (`types.ts` and the orchestrator: `font` kind). `read-file.ts` and `worker/*` get no edit from this part (the resume closure lives in orchestrator state; 2-0 confirms this and owns the edit if it proves wrong). Phase 3 and Phase 4 handlers that need the seam must not merge before 2-0.

#### 0.3 Dependency direction (base section 2)

`handlers/*` do not import hooks or components. `worker/*` and worker-side decoders do not import React or the DOM. Dialogs live in `src/components/shared/design/` (check `lost-ui` first, CLAUDE.md item 10). Hooks `use-palette-import.ts` and `use-font-import.ts` only call the orchestrator seam and server functions.

#### 0.4 Seam used by this part

| Need | Used by | Contract (BUILT by this part, not by Phase 0) |
|---|---|---|
| `needs_choice` with "pick one of N labelled options" | PDF page (2-4), Sketch artboard (4-5) | 2-0 defines, in `types.ts`, a result `{ kind: "needs_choice", choice: { title, options: [{ id, label, detail? }] }, resume(optionId) -> Promise<Result<...>> }` (React-free description plus a closure kept on the main thread); the orchestrator exposes `pendingChoice` state and `answerChoice(id)` / `cancelChoice()`; ONE generic dialog (2-5) serves PDF and Sketch (GOLD-2). The closure is released on cancel and on unmount |
| Result kind `palette` | ASE, ACO, GPL | added by 2-0 and 2-10: `{ kind: "palette", swatches, notes }` routed to `use-palette-import.ts`, not to `use-import-place.ts` |
| Result kind `font` | TTF, OTF, WOFF, WOFF2 | added by 3-8: `{ kind: "font", record, bytes }` routed to `use-font-import.ts` |
| Result kind `image` / `document` | PDF page, TIFF, AVIF, GIF, SVG raster, Sketch | existing path through `use-import-place.ts` (Phase 0: budget check, `addImported`, one history step) |
| Worker | TIFF, Sketch, font | the single `import.worker.ts` with zod protocol (Phase 0); handlers declare `runsIn: "worker"` and a worker-side decoder. SVG raster needs the DOM (`Image`) and PDF render uses pdf.js's own worker: `runsIn: "main"`, documented per handler |

#### 0.5 Library facts (verified 2026-11-18 against the public npm registry metadata, `latest` tag; bundle sizes NOT measured, only `unpackedSize` is quoted and it is not a gzip size)

| Package | Version | Licence | Runtime deps | Last publish | Notes |
|---|---|---|---|---|---|
| `utif2` | 4.1.0 | MIT | `pako` ^1.0.11 | 2023-05 | fork of UTIF.js; unpacked 105 KB; stale maintenance (risk accepted with worker and caps) |
| `fflate` | 0.8.3 | MIT | none | 2026-07 | unpacked 797 KB (many builds); tree-shakable ESM; streaming `Unzip` available |
| `fontkit` | 3.0.0 | MIT | `dfa`, `brotli`, `restructure`, `unicode-trie`, `unicode-properties`, `fflate` | 2026-11 | brotli dependency suggests WOFF2 support; browser build and size NOT verified (spike 3-5) |
| `opentype.js` | 2.0.0 | MIT | none | 2026-05 | unpacked 3.6 MB; WOFF2 support NOT verified |
| `DOMPurify` | 3.4.18 | MPL-2.0 OR Apache-2.0 | `@types/trusted-types` | current | NOT needed by this part (refuse-not-rewrite SVG policy) |
| `@sketch-hq/sketch-file-format` | 6.5.0 | MIT | `@types/json-schema` | current | JSON Schema and types; NOT recommended (D4-1) |

Web search was not used; the table comes from registry metadata fetched with `curl`. The stack-table rows must be re-verified by the developer with `npm ls` and the lockfile (R9). ASE, ACO and GPL use own parsers: no dependency, no stack row (CODE-12 satisfied by not adding).

#### 0.6 Names that this part needs and that are NOT in any registry (proposed, add to registry first)

| Name | Kind | Where it goes | Phase |
|---|---|---|---|
| `DesignImportNoteKind` value `swatch_converted`; `DesignImportKind` value `palette`; the `DesignImportFormat` values of each phase | enum values | enums.md, registered by the phase that adds the handler (per-phase rule), source `import/types.ts` | 2, 3, 4 |
| `needs_choice` result kind and its description type (`ImportChoice`, working name); orchestrator names `pendingChoice`, `answerChoice`, `cancelChoice` | closed union member and hook API | image-editor 8h (interaction seam paragraph); no enum row | 2 |
| `DesignFontLicenseClass` (`installable`, `editable`, `restricted`, `preview_print`, `bitmap_only`) | enum | enums.md (already proposed in image-editor.md 8h, conditional on the user choosing to persist license records) | 3 |
| pt-BR refusal and dialog texts of sections 2.9, 3.9, 4.9 | glossary rows | ui-glossary.md + `import/messages.ts` keys | 2, 3, 4 |
| Server function to add palette colors to the brand (`addDesignBrandColors`, working name) | function | functions.md; gated by `design.update` AND `brands.update`; merges into `brands.visual_identity.colors` with the 12 cap | 2 |
| Table for brand font license records and font file storage (`design_brand_fonts`, working name) or hidden-media purpose for fonts | data-model + migration | data-model.md, functions.md, audit action | 3 (blocked, A5) |
| Text element font reference to an imported font (`fontRef`, working name) | document schema field, possibly document version 4 | image-editor document section, `design_assert_document` | 3 (blocked, 3-9) |
| `ImportChoiceDialog`, `PaletteImportDialog`, `FontLicenseDialog` | components | `src/components/shared/design/`; check `lost-ui` first | 2, 3 |
| CSP `img-src` addition of `blob:` (SVG object URL) | config/doc | technical-architecture-v0.1.md line 1029 and the header/config that implements it | 3 |

---

## PHASE 2 - PDF pages, TIFF, AVIF, GIF, palettes (ASE, ACO, GPL)

### 2.1 Objective

Let a designer (a) pick which page of a PDF to import, (b) import TIFF, AVIF and GIF (first frame) as a pixel layer re-encoded to PNG by the existing raster path, and (c) import ASE, ACO and GPL swatch files as a previewed palette that can be added to the brand colors. Everything client-side, nothing stored as an original (R3).

### 2.2 Scope

| In | Out |
|---|---|
| PDF: page count probe, one-page selection, render at up to 2x capped 4096 (same renderer as AI), `first_page_only` note when more pages exist | Multi-page import into several design pages (D2-1), PDF vector or text extraction (Phase 5), PDF forms and annotations |
| TIFF: first page (IFD 0), 8-bit RGB/RGBA/gray/palette, 16-bit reduced to 8 with `depth_reduced`, CMYK TIFF converted naively with `cmyk_converted`, header pre-check before decode | ICC conversion (Phase 6c), tiled or strip exotic compressions beyond what `utif2` decodes (refused with a message), multi-page selection, BigTIFF (refused) |
| AVIF: native decode via `createImageBitmap`, `ispe` box pre-check, feature detection | AVIF animation (`avis`: first frame, `animation_ignored`), HDR/10-bit fidelity, polyfill for old browsers |
| GIF: first frame via native decode, logical-screen pre-check, `animation_ignored` when more than one frame | Animation import (video/motion track) |
| ASE, ACO (v1 and v2), GPL: own parsers, strict caps, preview dialog, add to brand colors | Palette export, ASE swatch groups as structure (flattened with group name prefix), spot color semantics, gradients/patterns in ASE |

### 2.3 Prerequisites

- P-2.0: Phases A, 0, 1 merged; `registry.ts` has `psd`, `ai`, `pdf` (page 1 only, `first_page_only` note), `png`, `jpeg`, `webp`; Phase 1 `metadata.ts` exists.
- P-2.1: Phase 0 item 0-7 delivered the single `render-pdf-page` helper with the hardened `getDocument` options, shared by `ai.ts` and `pdf.ts`. Verify it can render page N and expose `numPages`; if it only renders page 1, widening it is part of 2-4 (one implementation, GOLD-2).
- P-2.2: Phase 0 item 0-8 delivered `image.ts` and `image-header.ts`. GIF and AVIF reuse its bitmap-to-layer step (`createImageBitmap`, downscale to 4096 with `downscaled`, raster budget check before allocation) and follow the style of its pure header parsers. If that step is private, 2-0 exports it (no copy).
- P-2.3: the `needs_choice` and `palette` result kinds do NOT exist; they are built by 2-0 (this phase).
- P-2.4: Phase A glossary rows for the refusal texts below are registered (section 2.9), `utif2` stack row added in the same change as the dependency.
- P-2.5 (BLOCKED, owner): fixture corpus for the golden checks (16-bit TIFF, CMYK TIFF, Canva PDF, multi-page PDF, ASE and ACO exported from Photoshop/Illustrator, an animated GIF, an AVIF). Hostile fixtures are generated in code (no download).

### 2.4 Work items

| Id | Description | Files to create or change | Registry names added FIRST | Owner agent | Depends on |
|---|---|---|---|---|---|
| 2-1 | Registries (per-phase registration): ADD `DesignImportFormat` values `tiff, avif, gif, ase, aco, gpl`, `DesignImportKind` `palette` and note kind `swatch_converted` to enums.md (source `import/types.ts`); describe the interaction seam in image-editor 8h; glossary rows (refusals, page chooser, palette dialog, notes); stack row `utif2` 4.1.0 MIT with transitive `pako` check; 8h.3 table rows for tiff, avif, gif, ase, aco, gpl (sniff, caps, `runsIn`, phase); message keys are appended to `import/messages.ts`, never a new catalog | `docs/reference/enums.md`, `docs/standards/ui-glossary.md`, `docs/technical-architecture-v0.1.md`, `docs/modules/image-editor.md` | all of section 2.9 and `swatch_converted`; function `addDesignBrandColors` (proposed) in functions.md | developer; gate: standards-reviewer | P-2.0 |
| 2-2 | Threat model and limits sheet for PDF page probe, TIFF, AVIF, GIF, palettes (caps in section 2.8 confirmed or changed; worker or main thread per format) | no repo file; output goes into the 2-1 docs change (limits table in 8h.3) | none | security-analyst | 2-1 draft |
| 2-3 | Test design: hostile-fixture list and programmatic fixture builders (TIFF header forger, ISOBMFF `ispe` forger, GIF header forger, ASE/ACO/GPL builders, PDF with N pages) | test plan; builders will live in `import/test-helpers/` (proposed folder) used by 2-12 | none | test-designer | 2-2 |
| 2-4 | PDF pages: edit the existing `handlers/pdf.ts` (no new handler file, no registry change): open the document once, return `needs_choice` (page 1..N, default 1) when `numPages > 1`, render the chosen page through the shared `render-pdf-page` helper; `first_page_only` is no longer emitted for a PDF once the user chose a page (it stays for `ai`, first artboard); options listed capped at 500; the resumed page id is validated as an integer in `[1, numPages]` | `import/handlers/pdf.ts`, `pdf.test.ts` (extend), `messages.ts` block `pdf*` | `messages.ts` keys | developer | P-2.1, 2-0, 2-1 |
| 2-0 | Build the interaction seam (Phase 0 deliberately did not): in `import/types.ts` add the `needs_choice` and `palette` members to the result union and their types; in `use-design-import.ts` add the `needs_choice` case (store `pendingChoice`, expose `answerChoice` and `cancelChoice`, one choice at a time, ignore a choice that resolves after unmount or cancel, release the closure) and a `palette` case that hands over to a callback registered by `use-palette-import.ts` (the orchestrator still names no format); update the orchestrator tests and the exhaustive `never` check; confirm `read-file.ts` needs no edit; export the bitmap-to-layer step if P-2.2 found it private. This is the only edit of closed files in Phase 2 and is serialized before 2-4, 2-5 and 2-9/2-10 merge | `import/types.ts`, `hooks/shared/design/use-design-import.ts`, tests | image-editor 8h seam paragraph (docs first), enums rows via 2-1 | developer; gate: code-reviewer and standards-reviewer | P-2.0, 2-1 |
| 2-5 | UX and component for the generic choice dialog (title, option list, confirm/cancel, a11y, keyboard, pt-BR) reused by PDF (2-4) and Sketch (4-5); verify against `lost-ui` catalog first | `src/components/shared/design/import-choice-dialog.tsx` (proposed), glossary rows | glossary: "Escolha a pagina", "Importar pagina", "Cancelar" | ux-ui-designer (spec), developer (build), design-review | 2-0, 2-1 |
| 2-6 | TIFF handler: sniff (`II*\0`, `MM\0*`; reject BigTIFF `II+\0`/`MM\0+`), ext `.tif`/`.tiff`, `UTIF.decode` for IFD parsing only (no pixel decode), read IFD 0 width, height, bits, samples, compression, photometric; refuse over caps BEFORE `UTIF.decodeImage`; then decode and `toRGBA8`; 16-bit to 8 with `depth_reduced`; CMYK (photometric 5) naive conversion with `cmyk_converted`; extra IFDs counted, `first_page_only`; runs in the worker; bitmap to layer via P-2.2 | `import/handlers/tiff.ts` (+ worker-side decoder `tiff.worker-decoder.ts`, proposed name), `tiff.test.ts`, one registry line | `messages.ts` block `tiff*` | developer | 2-1, 2-2, P-2.2 |
| 2-7 | AVIF handler: sniff `ftyp` with brand `avif` or `avis` (offset 4 `ftyp`, major brand at 8, compatible brands list capped), ext `.avif`; parse `meta > iprp > ipco > ispe` with bounds to read width and height BEFORE decode; cap; `createImageBitmap(blob)` with `imageOrientation: "from-image"`; feature detect by decoding a tiny embedded AVIF at first use, else `avifUnsupported` message; `avis` gives `animation_ignored` | `import/handlers/avif.ts`, `avif.test.ts`, one registry line | `messages.ts` block `avif*` | developer | 2-1, 2-2, P-2.2 |
| 2-8 | GIF handler: sniff `GIF87a`/`GIF89a`, ext `.gif`; read logical screen width and height (bytes 6-9) BEFORE decode; bounded block walker (cap 100000 blocks, stop after the second image descriptor) to count frames; native decode of the first frame via `createImageBitmap`; `animation_ignored` when more than one frame | `import/handlers/gif.ts`, `gif.test.ts`, one registry line | `messages.ts` block `gif*` | developer | 2-1, 2-2, P-2.2 |
| 2-9 | Palette parsers (pure functions, no DOM): `palette-model.ts` (swatch type, naive CMYK/gray/Lab to sRGB hex, name truncation to 40, dedupe, cap), `palette-ase.ts`, `palette-aco.ts`, `palette-gpl.ts` handlers with sniff (`ASEF`; ACO has no magic: u16 version 1 or 2 plus a count consistent with the length; GPL first line `GIMP Palette`), all bounds-checked reads over a `DataView` | `import/handlers/palette-model.ts`, `palette-ase.ts`, `palette-aco.ts`, `palette-gpl.ts` and their tests, three registry lines | `messages.ts` block `palette*` | developer | 2-1, 2-2 |
| 2-10 | Palette UI and apply: `PaletteImportDialog` (swatch grid with names, select up to remaining brand slots `12 - existing`, conversion note, "Adicionar a marca"), `use-palette-import.ts`; server function `addDesignBrandColors` (zod input, merges into `visual_identity.colors` with compare-and-set on `updated_at` or an atomic jsonb update, 12 cap, dedupes by hex, audit through the existing brand update audit action, no new audit action unless the audit module requires one) | `src/components/shared/design/palette-import-dialog.tsx`, `src/hooks/shared/design/use-palette-import.ts`, `src/lib/shared/design/design.functions.ts` (add function) or a sibling file, tests | functions.md row, error codes only if a new one is truly needed (reuse `forbidden`, `invalid`, `not_found`), glossary | ux-ui-designer, developer, data-integrity-auditor (lost-update on the jsonb and `saveBrand` overwrite), design-review | 2-0, 2-9, 2-1 |
| 2-11 | Tests written: all section 2.10 scenarios | `*.test.ts` next to each handler; `import/test-helpers/*` | none | test-engineer | 2-3, 2-4 to 2-10 |
| 2-12 | Independent test review (do tests fail without the guards: pre-decode spy, caps, bounds) | no repo file | none | test-reviewer | 2-11 |
| 2-13 | Security review of parsers, worker messages, dialogs and the brand write | no repo file | none | security-analyst | 2-4 to 2-10 |
| 2-14 | Code review | no repo file | none | code-reviewer | 2-11 green |
| 2-15 | Standards gate, Implementation status of image-editor.md (files, commands, what was NOT tested, DOC-2), remove dead code (9.3) | `docs/modules/image-editor.md` | none | standards-reviewer | 2-12 to 2-14 |
| 2-16 | Manual browser matrix and golden comparisons with owner fixtures | checklist only | none | developer (checklist) + owner executes | P-2.5 |

### 2.5 Acceptance criteria (verifiable)

1. A PDF with 5 pages shows the chooser with 5 options, default page 1; choosing page 3 yields a layer whose pixels differ from page 1; a 1-page PDF imports without a dialog.
2. A TIFF declaring 60000 x 60000 is refused with `tiffTooLarge` and the decode function (`decodeImage`) is never called (spy asserts 0 calls).
3. A TIFF whose estimated working set `w * h * (bytesPerPixel + 4)` exceeds `DESIGN_LIMITS.rasterBudgetBytes` is refused before allocation; a 16-bit RGB TIFF at 1000 x 1000 imports with `depth_reduced`; a multi-IFD TIFF imports IFD 0 with `first_page_only`.
4. An AVIF whose `ispe` declares more than the cap is refused before `createImageBitmap` is called; an AVIF in a browser without AVIF support yields `avifUnsupported`, not an exception.
5. A GIF with 3 frames imports 1 layer with `animation_ignored`; a GIF declaring 65535 x 65535 is refused before decode.
6. ASE, ACO v1, ACO v2 and GPL fixtures produce the expected swatch counts and RGB hex within 1 unit per channel for RGB swatches; CMYK, Lab and gray swatches carry `swatch_converted`.
7. Palette apply never produces more than 12 brand colors, never duplicates a hex, and a user without `brands.update` sees the apply action disabled with a reason text (SEC-1 server check also returns `forbidden`).
8. No handler throws for any hostile input in 2.10 (all return `invalid`); no new `any`, `!`, `as unknown as`, comments, `console` (hook-enforced).
9. Lazy chunks: `utif2` is not in the main chunk (`npm run build` output recorded).

### 2.6 Verification commands (base.md section 11)

- After code: `npm run lint`, `npm run typecheck`, `npm run format:check`.
- After touching SQL or constants: `npm run check:consistency` (only if 2-10 adds a limit constant; no SQL is expected in this phase).
- After documents or registries: `npm run check:docs`.
- Flows: `npm run test` (Vitest, new handler tests), `npm run e2e` (upload flow once fixtures approved).
- `npm run build` to confirm lazy chunks and record chunk sizes (proposal: report gzip size of the `utif2` chunk).
- Report exactly what ran; anything not runnable is listed as unverified (GOLD-6).

### 2.7 Security notes

- Every format: size gate by `file.size` before reading (SEC-7 "stat before reading"), content sniff, extension must agree, pre-decode dimension check from the header where the format allows it (TIFF IFD, AVIF `ispe`, GIF logical screen, PDF MediaBox via `getViewport`).
- TIFF: `utif2` is a stale dependency parsing untrusted bytes; run only in the worker, with a timeout (proposal 20 s) and `terminate()` on cancel or timeout; cap IFD count (<= 64) and strip/tile count read by the pre-pass; refuse compressions other than none, LZW, Deflate/Adobe-Deflate, PackBits and anything the pre-pass cannot classify; refuse BigTIFF. `UTIF.decode` parses IFDs, SubIFDs, EXIF, GPS and maker notes on its own and cannot be capped from outside: as built (2026-11-19), utif2 never sees the original file; a strict pre-pass validates IFD 0 and the strips, and a minimal TIFF rebuilt from the validated tags is the only thing handed to it (see image-editor 8h.3, row `tiff`).
- AVIF and GIF decode run in the browser's native decoders (memory-safe, sandboxed process); the risk is pixel-count memory, hence header pre-checks. Native `createImageBitmap` cannot be cancelled: document the gap (a legitimate-but-large allowed image still costs its memory).
- PDF: reuse the hardened `getDocument` options of P-2.1; `numPages` is attacker-controlled: never allocate per page; page number validated as integer in `[1, numPages]` after the choice returns (the resume value comes from the UI but is validated, SEC-6 spirit); encrypted PDFs stay refused (`PasswordException`).
- Palettes: files are tiny (cap 1 MiB); counts and string lengths come from the file and must be checked against the remaining bytes before any loop or allocation (a count of 4 billion with 10 bytes of data must fail fast); UTF-16BE decode with a length cap; names are untrusted text, rendered by React as text only (SEC-8), truncated to 40 chars (brand schema), control characters stripped.
- Brand write: the server function validates with the existing `visualIdentitySchema` colors shape (SEC-6); brand resolved from the database, never from client ids alone (SEC-3); personal data: swatch names come from files, no logs of names (SEC-12).
- Worker protocol messages are zod-validated in both directions (Phase 0 `worker/protocol.ts`); transferable buffers only.

### 2.8 Limits (proposal, confirmed by 2-2)

| Format | maxBytes | Pre-decode cap | Other caps |
|---|---|---|---|
| PDF | global 100 MiB | page viewport at the chosen scale <= 4096 per side (scale clamped), `numPages` listed up to 500 | render time budget 30 s, then cancel |
| TIFF | 100 MiB | working set `w * h * (bytesPerPixel + 4) <= rasterBudgetBytes`, side <= 32768 declared | IFD count 64, timeout 20 s |
| AVIF | 50 MiB | `w * h <= 67_108_864` (64 Mpx), then downscale to 4096 with `downscaled` | box depth walk <= 16 levels |
| GIF | 50 MiB | `w * h <= 67_108_864` | block walker cap 100000 |
| ASE/ACO/GPL | 1 MiB | swatches <= 1000, name <= 255 chars read (stored 40) | GPL lines <= 5000, line <= 256 chars |

### 2.9 Messages and UI copy to register (pt-BR drafts; the developer finalizes in glossary)

Situations (keys in `messages.ts`, proposed): `pdfNoPages`, `pdfPageInvalid`, `tiffTooLarge`, `tiffUnsupported` (BigTIFF or compression), `tiffCorrupt`, `avifTooLarge`, `avifUnsupported`, `avifCorrupt`, `gifTooLarge`, `gifCorrupt`, `paletteTooManySwatches`, `paletteCorrupt`, `paletteEmpty`, `paletteBrandFull`. Dialog copy drafts: "Escolha a pagina" / "Importar pagina" (PDF), "Importar paleta" / "Cores importadas" / "Adicionar a marca" (palette), "A marca ja tem 12 cores. Remova uma cor da marca para adicionar novas." Note sentences for `first_page_only`, `animation_ignored`, `depth_reduced`, `cmyk_converted`, `swatch_converted` come from Phase A glossary.

### 2.10 Test scenarios and fixtures

Hostile (all generated in code, not downloaded):

| Scenario | Fixture builder | Expected |
|---|---|---|
| TIFF header declaring 60000 x 60000, tiny file | byte forger | refused, `decodeImage` spy not called |
| TIFF with IFD offset pointing outside the file or into itself (loop) | forger | refused, no hang (test has a timeout) |
| TIFF with SubIFD recursion 100 deep | forger | refused by depth cap |
| BigTIFF magic | forger | `tiffUnsupported` |
| TIFF strip byte counts larger than the file | forger | refused |
| AVIF `ispe` 100000 x 100000 | ISOBMFF forger | refused before `createImageBitmap` spy |
| AVIF with truncated `meta` box, box size 0 or overflowing | forger | `avifCorrupt` |
| GIF header 65535 x 65535 with 20 bytes of data | forger | refused |
| GIF with 1 million extension blocks | forger | block cap reached, refused or first frame only, no hang |
| PDF with 100000 declared pages | forged xref or pdf.js mock | list capped, no per-page allocation |
| Encrypted PDF, PDF with JavaScript action, PDF with remote link | fixture generated with a PDF writer in test helper | no network request, no script, refused or imported |
| ASE with block count 4e9 and 20 bytes | builder | `paletteCorrupt` fast |
| ASE name length larger than block | builder | refused |
| ACO v1 count 65535 with 10 bytes; ACO v2 name length beyond file | builder | refused |
| ACO with unknown color space code | builder | skipped with count, or refused if all unknown |
| GPL with 100000 lines, 10 MB single line, non-numeric channels, values 300 or -5 | builder | caps, clamp or refuse, never NaN hex |
| Name with control characters, RTL override, 10 KB | builder | stripped, truncated to 40 |
| Extension/content mismatch (a `.tif` that is a PNG) | forger | `nameMismatch` |
| Same file imported while another import is busy | orchestrator test | queued or refused, one decode at a time |
| Cancel during TIFF worker decode | worker client test | worker terminated, no late result applied |

Happy paths: PDF 1 page and N pages; TIFF 8-bit RGB, RGBA, gray, 16-bit RGB, CMYK; AVIF; GIF static and animated; ASE with RGB, CMYK, Lab, gray and a group; ACO v1 and v2; GPL with comments. Golden: RGB swatch hex equals source export within 1 unit (owner fixtures); CMYK values documented as approximate. Palette color math (naive CMYK, Lab D50 to sRGB, gray) is pure and unit-tested with known vectors. ACO value encodings (CMYK stored inverted, Lab and gray scaling) come from the Adobe Photoshop file format documentation and the analysis; they MUST be confirmed against owner-exported fixtures before 2-9 is closed (not verified here).

Not testable in jsdom/node (manual or e2e, reported as not tested otherwise): real decode in Chrome, Firefox, Safari; AVIF support matrix; worker termination under load; memory behaviour.

### 2.11 Risks

| Risk | Mitigation |
|---|---|
| `utif2` stale (2023) and its `pako` 1.x | worker, caps, pre-pass, timeout; plan replacement; stack row notes maintenance status |
| 16-bit/CMYK TIFF colour looks wrong | notes shown; ICC is Phase 6c; golden tolerance agreed with the owner |
| Header pre-checks diverge from what the decoder really allocates (TIFF planar, tiled) | working-set formula includes intermediate buffers; budget re-checked after IFD decode and after decode; documented gap |
| `createImageBitmap` cannot be cancelled or sized before decode for AVIF/GIF | header caps (64 Mpx) |
| Palette write races with `saveBrand` replacing the whole identity object | compare-and-set in the new function; auditor review |
| Collaborators lack `brands.update` so palette apply is disabled for most designers | clear reason text; D2-3 |
| ACO/ASE reverse-engineered semantics wrong for edge cases | owner fixtures, refuse unknown spaces |

### 2.12 Blocked or needs the user

- Owner fixtures (P-2.5).
- Approval of the new server function `addDesignBrandColors` (new function in functions.md) and of the rule that palette apply needs `brands.update` (D2-3).
- Safari/Firefox/iOS manual runs (owner or QA).
- Approval of the stated caps (64 Mpx, 20 s, 1000 swatches): they are proposals.

### 2.13 Open decisions (one recommendation each, DOC-5)

| Id | Decision | Options | Recommendation |
|---|---|---|---|
| D2-1 | PDF multi-page | single page per run; several pages as several design pages (needs `ImportedDesign.pages`, touches `types.ts`, the orchestrator and the 10-page carousel budget) | Single page per run, repeatable (import again for another page). Keeps `ImportedDesign` and the frozen orchestrator unchanged; multi-page can follow as its own change if the Phase 0 owner adds `pages` |
| D2-2 | TIFF decode cap | fixed 64 Mpx; working-set rule against the raster budget | Working-set rule `w*h*(bytesPerPixel+4) <= rasterBudgetBytes` (R10 consistent) |
| D2-3 | Palette destination | brand colors via new function; document-only swatches; both | Brand colors only, through `addDesignBrandColors`, requiring `design.update` and `brands.update`; disabled with a reason otherwise. No second palette store (GOLD-2) |
| D2-4 | CMYK/Lab/gray swatches | naive formulas with note; ICC | Naive formulas with `swatch_converted` (ICC is Phase 6c) |
| D2-5 | TIFF library | `utif2`; own decoder; server | `utif2` 4.1.0 in the worker, with the pre-pass and caps; revisit if a CVE appears |
| D2-6 | AVIF in browsers without support | polyfill WASM; message | Message only (no WASM decoder, no extra licence surface) |

---

## PHASE 3 - SVG rasterized and fonts

### 3.1 Objective

(a) Import SVG files as one pixel layer by rasterizing through an image element, with a refuse-not-rewrite gate and no DOM insertion. (b) Let a brand import its own fonts (TTF, OTF, WOFF, WOFF2) gated by the OS/2 `fsType` rule with a recorded licence and attestation, usable in text elements and export.

Honest scoping: 3a is self-contained and shippable. 3b is NOT useful until imported fonts can be selected by a text element, and `TextElement.font` is `z.nativeEnum(DesignFont)` (`schemas.ts` line 56) with a closed list of 8 curated fonts. Using an imported font therefore needs a document schema change (item 3-9, possibly document version 4 and a `design_assert_document` change, the heaviest migration kind). 3b is split so that 3a is not held back by it.

### 3.2 Scope

| In | Out |
|---|---|
| SVG: size cap 5 MB, text pre-scan gate, `<img>` rasterization at up to 2x capped 4096, transparent background, `vector_rasterized` note | SVG as vectors (Phase 5), DOMPurify or any rewriting sanitizer, external resources (fonts, images, CSS), SVG animation, SVG in the media library (stays refused) |
| Fonts: TTF, OTF, WOFF, WOFF2 parsing in a worker, name table and `fsType` read, accept/refuse, licence record, attestation dialog, `FontFace` registration from an ArrayBuffer, curated list stays default | Font editing, subsetting, variable axes UI, font collections (`.ttc` refused), icon fonts as glyph import, font storage design beyond the decision below (blocked) |

### 3.3 Prerequisites

- P-3.0: Phases A, 0, 1 and Phase 2 item 2-0 merged (the seam and the result-kind pattern exist); `svg, ttf, otf, woff, woff2`, kind `font` and the Phase 3 note kinds are registered by 3-1 of THIS phase (per-phase rule), not by Phase A.
- P-3.1: R1, R3 and R4 in image-editor 8h.2 (decided 2026-11-18; needed for SVG and fonts respectively).
- P-3.2 (BLOCKED, A4): the user confirms the fsType rule (refuse 0x0002, 0x0004, 0x0200; accept 0x0000, 0x0008; allow 0x0100).
- P-3.3 (BLOCKED, A5): where font files and the licence record live (hidden media with allowlist exception; dedicated table plus private storage; session only).
- P-3.4 (BLOCKED, 3-9): how a text element references an imported font.
- P-3.5: CSP review: the SVG object URL needs `img-src blob:` (technical-architecture line 1029 lists only the media and signed-URL hosts). If CSP is enforced in production, add `blob:` (docs first) or use a `data:` URL (also needs `img-src data:`). Verified by e2e (3-11).
- P-3.6 (BLOCKED, owner): fixtures: an icon set SVG, logo SVGs with gradients and text, fonts covering each `fsType` value (0x0000, 0x0002, 0x0004, 0x0008, 0x0100, 0x0200), WOFF, WOFF2, OTF (CFF), a TTC.

### 3.4 Work items

| Id | Description | Files to create or change | Registry names added FIRST | Owner agent | Depends on |
|---|---|---|---|---|---|
| 3-1 | Registries (per-phase registration): ADD `svg` (3a) and `ttf, otf, woff, woff2` plus kind `font` (3b, registered only when 3-9 and 3-10 are decided), note kinds `vector_rasterized` and `fonts_not_imported`, glossary rows (SVG and font refusals, license dialog, attestation line), `DesignFontLicenseClass` (if the user picks record persistence), stack row for the chosen font library (after 3-5), CSP doc line, image-editor 8h.3 rows for svg, ttf, otf, woff, woff2 | `docs/standards/ui-glossary.md`, `docs/reference/enums.md`, `docs/technical-architecture-v0.1.md`, `docs/modules/image-editor.md` | section 3.9 keys, `DesignFontLicenseClass` | developer; gate: standards-reviewer | P-3.1 |
| 3-2 | Threat model: SVG (parser, img-mode rendering DoS, nested `use`, filters, huge `viewBox`, DOCTYPE/entities, external refs) and fonts (sfnt table bombs, WOFF/WOFF2 decompression bombs, hostile `name` strings, OTS bypass) | output into 3-1 limits table | none | security-analyst | 3-1 draft |
| 3-3 | Test design: hostile SVG list and font forgers | test plan | none | test-designer | 3-2 |
| 3-4 | SVG gate (pure, node-testable): size cap, no NUL bytes, UTF-8 decode, refuse DOCTYPE with internal subset or any `<!ENTITY`, `<?xml-stylesheet`, parse with `DOMParser("image/svg+xml")`, `parsererror` refusal, root must be `svg` in the SVG namespace, element count cap 5000, `use` count cap 50, denylist (`script`, `foreignObject`, `iframe`, `object`, `embed`, `handler`, `listener`, `set`, `feImage`), any attribute starting with `on`, any attribute value containing `javascript:` (case/space-insensitive after entity decode), `href`/`xlink:href` only `#fragment` or `data:image/(png|jpeg|webp|gif);base64,`, `style` and `<style>` text refused if it contains `@import`, `url(` with anything other than `#fragment` or an allowed data URI, `expression(`; refuse, never rewrite | `import/handlers/svg-gate.ts`, `svg-gate.test.ts` | `messages.ts` block `svg*` | developer | 3-1, 3-2 |
| 3-5 | Font spike (scratch only, not in the repo): fontkit 3.0.0 vs opentype.js 2.0.0 vs own sfnt reader: WOFF2 parse, browser/worker build, gzip chunk size, ability to read `name` and OS/2 only without building glyph tables, behaviour on truncated tables; decision recorded in 3-1 | no repo change | none | developer | none |
| 3-6 | SVG rasterization handler: gate (3-4), read intrinsic size from `width`/`height`/`viewBox` (units px only; `%`, `em` refused or fall back to viewBox), compute scale min(2, 4096 / longest), refuse sizes below 64 px or above caps, load via `Image` from a `blob:` URL of type `image/svg+xml` (no `crossOrigin`, no insertion in the DOM), `await img.decode()` with timeout 10 s, `drawImage` into canvas with explicit width and height (Firefox requires an intrinsic size: if the root lacks `width`/`height`, set them with DOM APIs on the parsed document and serialize with `XMLSerializer` after the gate; this is the only rewrite and it is validated again), revoke the URL in `finally`, bitmap to layer via P-2.2, note `vector_rasterized`, `fonts_not_imported` when `<text>` exists | `import/handlers/svg-raster.ts`, `svg-raster.test.ts`, one registry line | `messages.ts` keys | developer | 3-4, P-2.2 |
| 3-7 | Font parse and gate (worker-side, pure where possible): header check (`0x00010000`, `OTTO`, `true`, `wOFF`, `wOF2`; `ttcf` refused), `numTables` cap 64, table bounds checks against length, read OS/2 `fsType` (offset 8 of the OS/2 table; OS/2 missing means refuse because the licence cannot be verified), read `name` ids 0, 1, 2, 4, 13, 14, 16, 17, class by the most restrictive set bit, size cap 10 MiB, name strings length-capped and control chars stripped; output `FontLicenseRecord` (family, style, copyright, licence description, licence URL as text only, fsType, class, SHA-256 of bytes) | `import/handlers/font.ts` (registry loader for ttf, otf, woff, woff2: four lines), `font-parse.ts`, tests | `DesignFontLicenseClass`, messages | developer | 3-5, 3-1, P-3.2 |
| 3-8 | Font dialog and registration: `FontLicenseDialog` (shows family, style, class, licence strings as plain text, attestation checkbox "Tenho licenca para usar esta fonte neste design", confirm), `use-font-import.ts`; registration with `new FontFace(familyKey, arrayBuffer)` (ArrayBuffer source, no URL, no CSP `font-src` change), `await face.load()` failure means refuse (browser OTS is a second validation layer), `document.fonts.add`; family key is generated (`design-brand-font-<id>`), never the file's family name | `src/components/shared/design/font-license-dialog.tsx`, `src/hooks/shared/design/use-font-import.ts`, `import/types.ts` and `use-design-import.ts` (the second and last closed-file edit of this part: add the `font` result kind and its `case`, serialized, reviewed on its own), `src/lib/shared/design/fonts.ts` is NOT edited: a new `brand-fonts.ts` (proposed) holds registration | glossary, enums | ux-ui-designer, developer, design-review | 3-7 |
| 3-9 | BLOCKED DECISION: text element reference to an imported font. Options in D3-3. Output: ADR text in image-editor 8h and, if a document schema change, document version and `design_assert_document` migration plan | docs only first | document section, enums | software-architect, data-integrity-auditor | P-3.3 |
| 3-10 | BLOCKED: font file and licence record storage (A5): migration or hidden-media purpose with MIME allowlist exception (SEC-7), RLS, audit action, tests; `/migration` checklist, local only, production push needs the owner | `supabase/migrations/<timestamp>_*.sql`, `supabase/tests/*.test.sql`, data-model.md, functions.md, `src/lib/shared/media/limits.ts` only if the user picks the media option | data-model, functions, audit action (proposed `design.font_imported`), error codes if needed | developer, data-integrity-auditor, security-analyst | P-3.3, 3-9 |
| 3-11 | Tests: hostile list (3.10), network-log e2e for SVG | `*.test.ts`, `e2e/` spec (path per the existing e2e folder) | none | test-engineer | 3-3, 3-4, 3-6, 3-7 |
| 3-12 | Test review, security review (mandatory, parsers of untrusted bytes), code review, standards gate and Implementation status | docs | none | test-reviewer, security-analyst, code-reviewer, standards-reviewer | 3-11 |
| 3-13 | Manual checks: Firefox/Safari SVG without intrinsic size, WOFF2 and OTF real fonts, rendering of an accepted font on canvas and in export | checklist | none | developer + owner | P-3.6 |

Delivery split: 3a = items 3-1(svg part), 3-2, 3-3, 3-4, 3-6, 3-11(svg), 3-12 (ships alone). 3b = 3-5, 3-7, 3-8, then 3-9 and 3-10 once decided; 3b is not merged to the registry until 3-9 and 3-10 are decided, so no dead handler exists (9.3).

### 3.5 Acceptance criteria

1. An SVG containing `<script>`, `onload`, `<foreignObject>`, `<use href="http://...">`, `<image href="https://...">`, `@import url(http...)`, a DOCTYPE with an entity, or `javascript:` in any attribute is refused with `svgBlockedContent`; none of them reaches `Image`.
2. A benign logo SVG (gradient, paths, embedded `data:image/png`) imports as a layer at 2x capped 4096 with transparent background and the `vector_rasterized` note; zero network requests are made during import (Playwright request log asserts none other than the app's own).
3. SVG over 5 MB is refused by `file.size` before reading; element count over cap is refused; an SVG with no `viewBox` and no size is refused or uses the documented default, never a zero-size canvas.
4. Markup never enters the DOM and `dangerouslySetInnerHTML` is absent (ESLint rule SEC-8 passes; grep of the new files).
5. A font with `fsType` 0x0002, 0x0004 or 0x0200 is refused with the class named in the message; 0x0000, 0x0008 and 0x0100 are accepted; a font with several mutually exclusive bits set is classed as the most restrictive; a font with no OS/2 table is refused.
6. A truncated, table-bomb or oversized (over 10 MiB) font returns `invalid` and never throws; the tab does not freeze (worker terminated by timeout 10 s).
7. An accepted font renders in the canvas and in the PNG export and the licence record (family, style, strings, fsType, attestation user and time) is stored once the 3-10 decision lands.
8. The curated `DesignFont` list is unchanged and remains the default; stack row, glossary rows and enum rows exist before code (check:docs passes).

### 3.6 Verification commands

Same as 2.6, plus: `npm run e2e` for the SVG network-log spec (this is the only way to prove "no external load"; it cannot be a jsdom unit test); if 3-10 lands: `npm run check:consistency`, `npx supabase db reset`, `npx supabase test db`, `npm run db:types`, or the `npm run db:verify` fallback (not a substitute, base 11); `npm run build` for the font library chunk size.

### 3.7 Security notes

- SVG policy: the `<img>` element is the isolation boundary (scripts do not run and subresources are not loaded in image mode). The gate is defense in depth and refuses rather than rewrites, so there is no sanitizer-bypass class of bug (no DOMPurify). The single rewrite (adding `width`/`height`) uses DOM APIs on the already gated tree and is gated again.
- Rendering DoS is real and uncancellable on the main thread (huge filters, deeply nested `use`, giant blur radii): element and `use` caps, refuse `feImage`, cap the output pixels before `drawImage`, `decode()` timeout only prevents waiting, not CPU. Residual risk accepted and documented; an alternative is rendering inside a sandboxed iframe (cost: complexity, CSP), not recommended now.
- DOCTYPE/entities: refuse any internal subset so entity expansion bombs never reach the parser.
- SVG text uses system fonts in image mode: fidelity note, not a security issue.
- Fonts: parse only in the worker; bounds-check every offset and length against the buffer (sfnt directories are attacker-controlled); decompression of WOFF/WOFF2 table data has an output cap of 32 MiB per font; the browser OTS sanitizer inside `FontFace.load()` is a second validation but not the licence gate. `fsType` is a technical flag, not the legal licence: the attestation and record are required for every accepted font.
- Licence strings and family names are untrusted text (they can contain URLs, markup, prompt-like text): displayed as plain text only, never as HTML or links without the SEC-8 link rule (`https` only, `rel="noopener noreferrer"`), capped to 1000 chars each, never fed to a model as instructions (R5).
- Personal data (SEC-12): licence strings may name a person or company; stored only per the 3-10 decision with the design's lifetime and retention stated; not logged.
- The font file persistence option needs SEC-7: allowlist MIME (`font/ttf`, `font/otf`, `font/woff`, `font/woff2`) with real-content verification, private bucket, opaque keys, signed URLs; originals of designs are otherwise never stored.

### 3.8 Limits

SVG: 5 MB file, 5000 elements, 50 `use`, scale min(2, 4096/longest), min side 64 px. Fonts: 10 MiB file, 64 tables, 32 MiB decompressed, name strings 1000 chars (family and style 80), parse timeout 10 s, brand font count follows `visualIdentitySchema.fonts` max 8 (names) unless the 3-9 decision changes it.

### 3.8a Threat model (item 3-2, written 2026-11-18 by the Phase 3 developer; owner decision 2026-11-18: accept plan recommendations; the security-analyst review of 3-12 has NOT been done)

SVG (3a, decided and implemented):

| Threat | Control | Residual |
|---|---|---|
| Script execution, event handlers, `javascript:` | The `img` element is the isolation boundary (no script, no subresource in image mode). Defense in depth: the gate refuses `script`, `foreignObject`, `iframe`, `object`, `embed`, `handler`, `listener`, any element whose name starts with `animate`, `set`, `discard`, `feImage`, `parsererror`, any attribute named `on*`, and `javascript:` or `vbscript:` after the DOM decoded the entities and the gate removed whitespace and control characters | Browser behavior in image mode is NOT proven here (no browser run) |
| External load (network, tracking) | `href` and `xlink:href` accept only `#fragment` or `data:image/(png|jpeg|webp|gif);base64,`; every `url(` in an attribute, `style` attribute or `style` element must be `#fragment` or an allowed data image; `@import`, `expression(`, `image-set(`, `src(`, `element(`, `cross-fade(`, a backslash (CSS escape) and `xml:base` are refused. The gate never rewrites to fix a violation | Network silence is provable only by the e2e network-log spec (not written) |
| Entity expansion (billion laughs), external DTD | Any `<!ENTITY`, `<!ELEMENT`, `<!ATTLIST`, `<!NOTATION` or a DOCTYPE with `[` is refused on the text before the parser runs; a plain DOCTYPE without subset is accepted (common in exported files; the parser does not load the DTD) | none known |
| Parser DoS, element bombs | File 5 MiB by `file.size` before reading, 5000 elements, depth 64 (iterative walk, no recursion), 50 `use`, style text 100 000 characters, NUL bytes and invalid UTF-8 refused | The parse itself is on the main thread; a 5 MiB file is bounded but not measured |
| Render DoS (huge filters, nested `use`, blur) | The count of 50 `use` elements does NOT bound the expansion (10 levels of 5 `use` is 50 elements and about 9.7 million instances), so the gate refuses any `use` whose target subtree contains a `use` (this also refuses a self reference) and refuses when the elements plus the sizes of all `use` targets exceed 5000 (security review F2, 2026-11-19); `feImage` refused, output at most 4096 on the longest side and raster budget checked before the canvas exists, decode raced against 10 s and the cancel signal | A heavy filter can still block the main thread until the browser finishes: accepted, documented residual risk (an iframe sandbox is not recommended now) |
| Huge or hostile size (`width="1e9"`, negative, NaN, `%`) | Only finite pixel values from 1 to 1 000 000 are used, otherwise the `viewBox` is used, otherwise the file is refused (`svgNoSize`); the rendered side must be 64 to 4096 | none known |
| Gate and renderer reading different text (XML `encoding` declaration) | The Blob is typed `image/svg+xml;charset=utf-8` and a declaration with an encoding other than UTF-8 is refused (F4) | Not proven in a browser |
| Embedded raster bomb (`data:image/png` declaring 30000 x 30000) | The head (256 KiB) of every embedded `data:image` URI is decoded, its header read with the same readers as the file import, and the declared pixels must fit the 67 108 864 cap; an unreadable header is refused (F5) | The browser still decodes small embedded images inside the SVG; their total is bounded by the 5 MiB file |
| Markup reaching the page DOM | The SVG text is parsed into a detached document and drawn from a `blob:` URL; no `innerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `document.body`, `object`, `embed`, `iframe` or CSS use; a static guard test reads the SVG sources | none known |
| Personal data and names | The layer name comes from the file name through the existing sanitizer; `title`, `desc` and `metadata` elements are never read; metadata is built by `buildMetadata` with no text | none |

Fonts (3b, threat model only; no font bytes are stored by this change):

| Threat | Control (design) | State |
|---|---|---|
| sfnt table bombs (huge `numTables`, offsets or lengths past the file, overlapping tables, `offset + length` wrap) | Own bounds-checked reader of the table directory (`numTables` at most 64, every range checked against the buffer, range sums with no overflow) that reads only `OS/2` and `name`; no glyph table is built | Parser written and unit tested (`handlers/font-parse.ts`), NOT registered |
| WOFF and WOFF2 decompression bombs | WOFF (zlib) tables are inflated with an output cap of 32 MiB per font, checking the declared `origLength` first; WOFF2 (Brotli plus transforms) is NOT parsed by the own reader | WOFF2 refused until the 3-5 library spike decides |
| Hostile `name` strings (control characters, bidi, 1 MB strings, surrogates, URLs, prompt-like text) | Strings are decoded (UTF-16BE, Mac Roman as Latin-1), cut at 1000 characters (family and style 80), sanitized by `sanitizeImportText`, displayed as plain text only and never fed to a model (R5) | Done in the parser |
| Browser parser bugs | `FontFace` from an `ArrayBuffer` passes the browser OTS sanitizer; `face.load()` failure means refusal | NOT built (3-8) |
| Licence bypass | `OS/2.fsType` rule A4 (refuse 0x0002, 0x0004, 0x0200; accept 0x0000 and 0x0008; allow 0x0100; most restrictive bit wins; no `OS/2` means refuse); attestation and record for every accepted font | Class computed in the parser; attestation and record NOT built |
| Storing untrusted bytes | A5: a dedicated licence-record table plus the existing media upload path with a new hidden purpose. This is a SEC-7 change | BLOCKED, proposed text below |

Proposed SEC-7 change (NOT applied; needs the owner): "Fonts are an allowed upload purpose `brand_font` only: MIME allowlist `font/ttf`, `font/otf`, `font/woff` (and `font/woff2` only after the 3-5 decision), 10 MiB limit; the server verifies the real content (sfnt or wOFF header, the `OS/2` `fsType` class computed server side with the same parser, never trusted from the client) before the object is kept; private bucket, opaque key, signed URL, `Content-Disposition: attachment`; the record (family, style, class, `fsType`, SHA-256, attester user and time, strings as text capped at 1000 characters) is append-only like `design_exports`; audit action `design.font_imported` (proposed); one brand can hold at most 8 fonts (`visualIdentitySchema.fonts`). The media library stays closed to fonts for every other purpose." Also blocked before any registry line: 3-9 (how a text element references the font, document version 4) and the 3-10 migration.

### 3.9 Messages and UI copy to register (pt-BR drafts)

Keys (proposed): `svgTooLarge`, `svgBlockedContent`, `svgInvalid`, `svgNoSize`, `svgRender`, `fontTooLarge`, `fontCorrupt`, `fontNoLicenseInfo`, `fontRestricted` (names the class, adds "peca uma licenca de edicao ao fornecedor"), `fontCollectionUnsupported`, `fontLimitReached`. Dialog: "Licenca da fonte", "Tenho licenca para usar esta fonte neste design", "Fonte importada.", "Fonte da marca" (Phase A). Notes: `vector_rasterized` and `fonts_not_imported` sentences from Phase A.

### 3.10 Test scenarios and fixtures

| Scenario | Fixture | Expected |
|---|---|---|
| SVG with script, `onload`, `onclick`, `foreignObject` with HTML | string builders | `svgBlockedContent`, `Image` never constructed (spy) |
| `javascript:` hidden with entities (`&#106;avascript:`), tabs, case changes in `href` | builder | refused |
| External `<image href>`, `<use href="http">`, CSS `@import`, `url(https:...)`, `feImage` | builder | refused |
| DOCTYPE with `<!ENTITY lol "...">` nested (billion laughs) | builder | refused before parse |
| `<?xml-stylesheet href=...?>` | builder | refused |
| 5001 elements, 51 `use`, 6 MB file, NUL bytes, invalid UTF-8, BOM variants | builder | refused or handled, no throw |
| SVG with `viewBox` only, with `width="100%"`, with 1e9 `width`, negative, NaN | builder | documented size rule or refuse |
| Benign SVG with `data:image/png` and gradient | builder | imports (browser e2e) |
| Playwright: SVG referencing a local test server image | e2e + request interception | zero hits on the test server |
| Font: truncated at each table boundary, `numTables` 65535, table offset beyond file, overlapping tables, `length` overflow (offset + length wraps) | forger | `fontCorrupt`, no throw |
| Font: `fsType` for each mask and combinations (0x0006, 0x000e, 0x0102) | forger | class per the rule |
| Font: no OS/2, `name` table with 1 MB strings, UTF-16 surrogate garbage, control chars | forger | refused or sanitized |
| WOFF with zlib bomb table, WOFF2 with oversized `origLength` | forger | decompression cap, `fontCorrupt` |
| `ttcf` collection, 11 MiB font, wrong extension | forger | refused |
| Same family imported twice, 9th brand font | unit | dedupe / `fontLimitReached` |
| Cancel and timeout in worker | worker client test | terminate, no late result |

Not testable here: real FontFace load in all browsers, glyph rendering in export, SVG rendering fidelity across browsers, CPU DoS behaviour.

### 3.11 Risks

| Risk | Mitigation |
|---|---|
| SVG render DoS blocks the main thread | caps, refuse `feImage`, accepted residual risk, optional iframe isolation later |
| Firefox needs intrinsic size for SVG `drawImage` | explicit size rewrite (gated), manual test 3-13 |
| `blob:` blocked by CSP | P-3.5, e2e |
| WOFF2 support in the library unverified | spike 3-5 decides; fallback own sfnt reader for TTF/OTF plus refuse WOFF/WOFF2 until supported |
| Font work delivers no value without 3-9 | split delivery; 3b not registered before 3-9 and 3-10 |
| `fsType` is not the legal licence | attestation, record, owner/counsel review (Open decision D3-1) |
| Brand font cap 8 names vs files | follow the schema cap |
| Document schema change (3-9) forces a migration and an upgrade path for saved versions | architect decision, data-integrity-auditor, owner approves production push |

### 3.12 Blocked or needs the user

R1, R3 and R4 are decided (8h.2); A4 (fsType rule), A5 (storage), 3-9 (text reference); legal/counsel view on `fsType` 0x0004 Preview and print (recommended refuse); owner fixtures; CSP production config access; production migration push (8e item 11).

### 3.13 Open decisions (one recommendation each)

| Id | Decision | Options | Recommendation |
|---|---|---|---|
| D3-1 | Font `fsType` rule | refuse 0x0004; accept after attestation; display-only | Refuse 0x0002, 0x0004 and 0x0200; accept 0x0000 and 0x0008; allow 0x0100; attestation and record for every accepted font (8h.2, A4 and A5) |
| D3-2 | Font library | fontkit 3.0.0; opentype.js 2.0.0; own sfnt reader | fontkit 3.0.0 lazy-loaded in the worker if the 3-5 spike confirms WOFF2, name/OS/2 reads and an acceptable chunk; otherwise own bounds-checked sfnt reader for TTF/OTF and defer WOFF/WOFF2 |
| D3-3 | How a text element references an imported font | widen `font` to `DesignFont` or a brand font id (document version 4); keep the enum and store brand fonts only in the font picker of new texts mapped to a second field; defer fonts entirely | Add an optional `fontRef` (brand font id) next to `font` (which stays a curated fallback), one document version bump and `design_assert_document` update, decided and approved before 3-7 merges; if the user declines, defer 3b (do not ship dead font handlers) |
| D3-4 | Font storage and licence record (A5) | hidden media with allowlist exception; dedicated table plus private storage; session only | Dedicated table for the licence record and file reference (append-only like `design_exports`) plus the existing media upload path with a new hidden purpose; session-only fonts break reopen and export and are not acceptable for brand fonts |
| D3-5 | SVG sanitization approach | refuse-not-rewrite gate plus img; DOMPurify rewrite | Refuse-not-rewrite plus img; no DOMPurify, no new dependency, no stack row |
| D3-6 | SVG with text | accept with `fonts_not_imported`; refuse | Accept with the note |

---

## PHASE 4 - Sketch

### 4.1 Objective

Import a `.sketch` file (ZIP of JSON plus assets) into the editor: the user picks one artboard, and bitmaps, basic shapes and text of that artboard become pixel layers with names and order, with honest fidelity notes. Hard limits protect against zip bombs and path tricks. Client-side, in the worker.

### 4.2 Scope

| In | Out |
|---|---|
| ZIP safe reader: entry cap, declared and actual inflated byte caps, ratio check, name validation, only `document.json`, `meta.json`, `pages/*.json`, referenced `images/*` read | Sketch Cloud, libraries, `.sketchpalette`, `.sketchstyle`, Sketch versions older than the file-format schema supports (refused with message) |
| Zod subset schema of the layers actually used (not the full official schema) | Full vector fidelity, editable text, boolean operations, masks, blurs, shadows, gradients, patterns (dropped with notes) |
| Artboard chooser (`needs_choice`), layers mapped: `bitmap` to raster layer, `rectangle`, `oval`, `shapePath` (solid fill, simple border dropped) to canvas-drawn raster, `text` drawn as pixels with a fallback font, groups flattened or limited to the 8 depth, `symbolInstance` resolved one level without overrides | Nested symbol overrides, prototyping, exports slices, hotspots |
| Layer names, visibility, opacity, order, frame position/size, rotation and flips for bitmaps | Smart rounding, resizing constraints |

### 4.3 Prerequisites

- P-4.0: Phases A, 0, 1 and Phase 2 items 2-0 (seam) and 2-5 (generic choice dialog) merged; the P-2.2 bitmap-to-layer step is exported.
- P-4.1: stack row for `fflate` 0.8.3 (MIT, no dependencies) added in the same change as the dependency (R9).
- P-4.2: Phase A glossary rows for zip-limit and Sketch refusals.
- P-4.3 (BLOCKED, owner): 3 real `.sketch` files (authorized, not customer files) to confirm schema subset and the acceptance "same layer count and names"; at least one with symbols and one with bitmaps. Zip-bomb fixtures are generated in tests.
- P-4.4: the zero-spike check below (4-3) confirms `fflate` can stop streaming inflate at a byte budget in a worker.

### 4.4 Work items

| Id | Description | Files to create or change | Registry names added FIRST | Owner agent | Depends on |
|---|---|---|---|---|---|
| 4-1 | Registries (per-phase registration): ADD `sketch` to `DesignImportFormat` and note kind `unsupported_node` (other note kinds used are already registered by Phases 0 and 3) to enums.md; `sketch` row in 8h.3 (sniff `PK\x03\x04`, ext `.sketch`, 256 MiB uncompressed, `runsIn: worker`), stack row `fflate`, glossary messages; note kinds `layer_style_dropped`, `groups_flattened`, `text_as_pixels` come from Phase 0, `fonts_not_imported` from Phase 3 (if Phase 3a has not merged, 4-1 registers it) | docs only | section 4.9 keys | developer; gate: standards-reviewer | P-4.1, P-4.2 |
| 4-2 | Threat model: zip structure (EOCD tricks, overlapping entries, duplicate names, zip64, encrypted flag, data descriptors lying about sizes, nested archives), JSON (depth, size, duplicate keys, `__proto__`), image entries (hostile PNG sizes), path traversal | limits table into 4-1 | none | security-analyst | 4-1 draft |
| 4-3 | Safe unzip: own pre-pass over the central directory (EOCD located within the last 64 KiB, entry count and offsets bounds-checked, names validated: reject `..`, leading `/` or `\`, drive letters, NUL, backslashes, names over 255 chars, duplicates; refuse encrypted flag and zip64 beyond caps), then streaming inflate (`fflate` `Unzip` with `UnzipInflate`) of only the allowlisted entries, with a running byte counter that aborts at the per-entry and total caps regardless of declared sizes (declared sizes lie), ratio check per entry | `import/handlers/sketch-zip.ts`, `sketch-zip.test.ts` | messages | developer | 4-1, 4-2 |
| 4-4 | Schema subset in zod (`sketch-schema.ts`): meta (`version`, `appVersion`), document (`pages` refs), page (`layers`), layers with `_class` discriminated union of the supported kinds and a catch-all `unsupported` variant that keeps only `_class`, `do_objectID`, `name`, `frame`; strict string caps, array caps, depth walked iteratively (no recursion beyond 8 levels), numbers finite, frame within sane bounds; not `@sketch-hq/sketch-file-format` (D4-1) | `import/handlers/sketch-schema.ts`, tests | messages | developer | 4-3 |
| 4-5 | Sketch handler: sniff, run unzip and parse in the worker, `needs_choice` of artboards (label = name, detail = size; cap 100 listed), after choice build `ImportedDesign` (page size = artboard frame clamped to 64..4096 with `downscaled` when larger; layers within the element cap 200 else `tooManyLayers`; one raster layer per supported leaf; bitmap decoding of `images/*` via `createImageBitmap` in the worker with a per-image pixel cap and the raster budget check BEFORE allocation) | `import/handlers/sketch.ts`, `sketch.test.ts`, one registry line | messages | developer | 4-3, 4-4, P-2.2, 2-5 |
| 4-6 | Minimal renderer of the supported shapes and text into `OffscreenCanvas` (rectangle with corner radius, oval, simple closed path from `points` straight and curve data, fill solid color and opacity; text via `fillText` with a fallback sans font; unsupported styles dropped with notes, no silent drop) | `import/handlers/sketch-render.ts`, tests with pixel assertions | none | developer | 4-4 |
| 4-7 | Tests (zip-bomb fixtures generated in the test, never downloaded) | tests, `import/test-helpers/zip-builder.ts` (proposed) | none | test-designer then test-engineer | 4-2, 4-3 to 4-6 |
| 4-8 | Reviews: test-reviewer, security-analyst (mandatory), code-reviewer, standards-reviewer; Implementation status | docs | none | test-reviewer, security-analyst, code-reviewer, standards-reviewer | 4-7 |
| 4-9 | Fixture acceptance with the 3 owner files: same layer count and names for supported kinds; list of dropped features per file | checklist | none | developer + owner | P-4.3 |
| 4-10 | UI review of the artboard chooser and import notes panel | glossary | none | ux-ui-designer, design-review | 4-5 |

### 4.5 Acceptance criteria

1. A zip bomb (a 1 MB archive declaring or actually inflating beyond 256 MiB, or one entry inflating 1000:1) is refused and never allocates more than the stated cap (instrumented counter in test); declared sizes that lie (central directory says 100 bytes, stream inflates 1 GiB) are stopped by the running counter.
2. An archive with 2001 entries is refused before any inflate; entries named `../x`, `/x`, `C:\x`, `a\..\b` are refused as a whole archive (not skipped silently).
3. Only `document.json`, `meta.json`, `pages/*.json` and `images/*` are read; any other entry (including nested `.zip`) is never inflated.
4. A Sketch file with 3 artboards shows the chooser; the chosen artboard's supported layers appear with the same names and order; unsupported layers produce `unsupported_node` counts in the notes, nothing is dropped silently.
5. More than 200 resulting layers (minus existing elements) are refused with `tooManyLayers`; an artboard larger than 4096 px is downscaled with `downscaled`.
6. No exception escapes; a malformed JSON or a layer failing the schema yields `sketchCorrupt` with no partial import.
7. `fflate` and the Sketch handler are lazy chunks (not in the main chunk, `npm run build` recorded).

### 4.6 Verification commands

As 2.6 (`lint`, `typecheck`, `format:check`, `test`, `check:docs`, `check:consistency` if a limit constant is added, `build` for chunk size). `npm run e2e` only if the upload flow spec covers Sketch with the owner files.

### 4.7 Security notes

- Zip: validate before inflating, enforce limits on bytes actually produced (declared sizes are untrusted), ratio per entry, entry count, total cap (R6: 2000 entries, 256 MiB); never extract to paths (no file system; entries are keyed in a `Map` after name validation); duplicate names refused (parser differential tricks); refuse archives where a local header disagrees with the central directory name.
- JSON: parse only inflated bytes of allowlisted entries within a per-entry cap (proposal 32 MiB for pages, 4 MiB for `document.json` and `meta.json`); reject `__proto__`/`constructor` keys by zod `.strict()`/strip into plain objects; depth limit by an iterative walk before zod.
- Images referenced by `_ref` are validated against names in the archive, not used as paths; decoded in the worker with a pixel cap per image and the raster budget check before allocation (R10); `image/*` sniff on bytes (PNG, JPEG, TIFF are used by Sketch; unknown refused per layer with a note).
- Text strings and layer names are untrusted data, length-capped (`layerNameMax` 80), shown as text; stored only as part of `ImportedDesign.metadata` per Phase 1 rules; never instructions (R5).
- Worker protocol zod-validated; terminate on cancel and on a 30 s timeout.

### 4.8 Limits

All Sketch and ZIP limits (entries, inflated bytes, ratio, name length, JSON depth, pixels, timeout) were accepted on 2026-11-18 and live only in [image-editor.md](image-editor.md) 8h.4 and in `SKETCH_LIMITS` (`import/limits.ts`).

### 4.9 Messages and UI copy to register (pt-BR drafts)

Keys (proposed): `sketchNotZip`, `sketchCorrupt`, `sketchUnsupportedVersion`, `sketchNoArtboards`, `zipTooManyEntries`, `zipTooLarge`, `zipRatioExceeded`, `zipUnsafePath`, `zipEncrypted`. Dialog: "Escolha a prancheta", "Importar prancheta". Notes reuse Phase A kinds.

### 4.10 Test scenarios and fixtures

| Scenario | Fixture | Expected |
|---|---|---|
| Classic zip bomb (a few KB inflating to GBs) built with `fflate` in the test | zip builder | counter aborts under the cap |
| Central directory declares small sizes, stream inflates large | forged zip | aborted by running counter |
| 2001 and 100000 entries; EOCD count lying (65535) | builder | refused before inflate |
| Path traversal, absolute, drive, backslash, NUL, overlong, duplicate names, case-variant duplicates | builder | archive refused |
| Encrypted flag, zip64 oversized, multi-disk | builder | refused |
| Nested `.zip` inside `images/` | builder | not inflated, note or ignored |
| `pages/x.json` with 100000-deep nesting, 100 MB string, `__proto__` keys, NaN/Infinity frames, negative sizes | builder | `sketchCorrupt`, no stack overflow |
| `_ref` pointing to a missing or traversal path | builder | layer skipped with `unsupported_node` or refused |
| Bitmap entry with PNG header declaring 60000 x 60000 | builder | refused before decode |
| Artboard 10000 x 10000 | builder | `downscaled` |
| 300 layers | builder | `tooManyLayers` |
| Symbol instance referencing itself (loop) | builder | depth 1, no hang |
| Unknown `_class` values | builder | catch-all, `unsupported_node` |
| Supported subset: rectangle with radius, oval, bitmap, text | builder plus pixel assertions | expected pixels |
| Owner files | real | layer count and names match (manual acceptance) |

Not testable here: fidelity against Sketch app rendering (golden requires owner exports), OffscreenCanvas availability on Safari, memory behaviour.

### 4.11 Risks

| Risk | Mitigation |
|---|---|
| Vector fidelity gap makes imports disappointing | explicit acceptance subset (logos, UI mockups with bitmaps), honest notes, vector path is Phase 5 |
| Sketch format changes (new `_class`, new versions) | catch-all variant, version check with message, schema subset is small |
| `fflate` streaming API differences or its cap enforcement | spike inside 4-3 (read-only experiment first), fallback to own central-directory reader plus `inflateSync` with output cap per entry |
| `OffscreenCanvas` 2D text rendering differs across browsers; fonts differ from the designer's | fallback font, `fonts_not_imported`, `text_as_pixels` notes |
| 200-element cap makes many Sketch artboards unimportable | refuse with a clear message; flattening option is a later decision |
| Hidden-version limit (300) with many raster layers | existing `hidden_limit_reached` behaviour; layer count caps |

### 4.12 Blocked or needs the user

Owner Sketch fixtures (3 files); approval of caps; Phase A R-rows for dependencies; nothing else.

### 4.13 Open decisions (one recommendation each)

| Id | Decision | Options | Recommendation |
|---|---|---|---|
| D4-1 | Schema validation | `@sketch-hq/sketch-file-format` 6.5.0 (JSON Schema, needs a JSON-schema validator and adds size); zod subset | zod subset of the kinds actually mapped plus a catch-all, no new dependency beyond `fflate`; revisit if the subset grows past ~15 kinds |
| D4-2 | Multiple artboards | import one chosen artboard; all artboards as pages; flatten page | One chosen artboard per run (consistent with D2-1) |
| D4-3 | Symbols | resolve depth 1 without overrides; resolve fully; ignore | Depth 1, no overrides, `unsupported_node` note for overrides |
| D4-4 | Zip reader | `fflate` with own central-directory pre-pass; JSZip; own full reader | `fflate` plus own pre-pass (MIT, no dependencies, streaming; JSZip adds weight and a heavier inflate API) |
| D4-5 | Text | draw as pixels with fallback; skip text; editable text elements | Pixels with fallback font and notes (editable text depends on the font decision D3-3) |

---

## Cross-phase summary

### Registry lines (one per format, merged last)

Phase 2: `tiff`, `avif`, `gif`, `ase`, `aco`, `gpl` (the `pdf` entry is unchanged: 2-4 edits `handlers/pdf.ts` in place). Phase 3: `svg`; `ttf`, `otf`, `woff`, `woff2` (only after 3-9 and 3-10). Phase 4: `sketch`.

### New dependencies (each with stack-table row in the same change, R9)

`utif2` 4.1.0 (Phase 2); font library per 3-5, expected `fontkit` 3.0.0 (Phase 3b); `fflate` 0.8.3 (Phase 4). No dependency for palettes, SVG or GIF/AVIF.

### Order and parallelism

Phase 2 items 2-4, 2-6/2-7/2-8 and 2-9/2-10 are independent streams after 2-1 and P-2.x. Phase 3a runs parallel to Phase 2 (needs only P-2.2). Phase 3b waits for A4, A5 and 3-9. Phase 4 needs 2-5 (choice dialog) and P-2.2, otherwise parallel.

### Edits of closed Phase 0 files (complete list)

2-0 (`types.ts`, `use-design-import.ts`: `needs_choice` and `palette`), 2-4 (`handlers/pdf.ts`, a handler, not a skeleton file), 3-8 (`types.ts`, `use-design-import.ts`: `font`). Nothing in `read-file.ts`, `worker/*`, `registry.ts` beyond one added line per format, `use-import-place.ts`.

### What was not verified in this document

Nothing here has been run or tested in a browser. Library versions and licences come from npm registry metadata; bundle sizes, WOFF2 support in `fontkit` and `opentype.js`, fflate streaming abort behaviour, ACO/ASE value encodings and `createImageBitmap` behaviour for animated GIF and AVIF on each browser are NOT verified and are assigned to spikes or fixtures. Legal conclusions on `fsType` are not legal advice. The `needs_choice` and result-kind shapes are DESIGNED here (2-0), not assumed from Phase 0; they must be reconciled with the actual `import/types.ts` produced by Phase 0 before 2-0 starts.

## Part 3 - Phases 5, 6 and 7 (vectors, late formats, blocked integrations)

Date: 2026-11-18. Plan only; nothing in this part has been executed. Aligned with Part 1: the PSD/AI draft is already committed (e65bc90) and the tree is clean; `DESIGN_IMPORT_MESSAGE` lives in `src/lib/shared/design/import/messages.ts` (no design `errors.ts` exists); `DesignImportFormat` values are registered per phase together with their handler, so `heic` (6b) and `lottie` (6a) are added by their own change and `eps`, Figma, Canva are never pre-registered; `design-import.ts` and `import-file.ts` are removed in Phase 0 and the hook is a format-agnostic orchestrator over a handler registry; the `needs_choice` seam is introduced in Phase 2 (this part does not use it: vector-or-raster is decided automatically, 5.D1). Assumes Phases A to 4 exist (registry and 8h decisions, import skeleton under `src/lib/shared/design/import/`, PSD/AI/PDF/raster/palette/SVG-raster/font/Sketch handlers, `ImportedDesign` with notes and metadata).

Reading rule for names: a name that appears in `docs/reference` or in the Phase A handoff as already registered is written plainly. Anything else is marked **(proposed, add to registry first)** and must be added to the registry in the same change, BEFORE code (GOLD-4, base 9.2). Effort numbers are engineering estimates, not measurements. Nothing here was validated in a browser.

Facts checked in the repo for this part (read only):

- `src/lib/shared/design/schemas.ts`: the document is `version: 3` with `designDocumentV3Schema`; `designDocumentSchema` is a union that reads v1 and v2 and transforms them to v3 (only v3 is written). Element kinds in the union today: text, image, rect, ellipse, line, raster, adjustment, group.
- `supabase/migrations/20261118100000_design_document_v3.sql`: `design_assert_document` accepts versions 2 and 3 only, has a per-version kind list (`v_kinds`), a per-version element cap (`v_max`: 100 for v2, 200 otherwise), the 256 KiB / 10 pages guard (`design_too_large`); `design_upgrade_document` rewrites drafts from older versions. A new kind or a version 4 therefore needs a new migration touching both functions.
- `DESIGN_LIMITS` in `types.ts`: `maxElements` 200, `maxBytes` 262144, `maxPageSide` and `maxRasterSide` 4096, `rasterBudgetBytes` 512 MiB, `maxGroupDepth` 8, `maxCoordinate` and `maxSize` 20000.
- 39 files under `src` mention `DesignElementKind`; a new kind will cascade (renderer, thumbs, export, layers, history, arrange, resize copy). TypeScript exhaustiveness plus a grep is the work list (item 5-4).
- `token-crypto.server.ts` exists in `src/lib/shared/social/` (encrypted connection tokens, used by `lib/shared/jobs`); it is the existing pattern R7 refers to. SEC-5 restricts the service-role readers of stored tokens, so a design-import integration cannot just reuse that reader (see 7.3).
- Not verified by me: CSP headers of the deployment (the search for `unsafe-eval` did not finish; the developer must check the deployed headers before 6a), pdf.js operator-list behavior, `ag-psd` raw CMYK access, any third-party license not already listed in the analysis.

---

### Phase 5 - SVG and AI/PDF as vectors

#### Objective

Let a designer import logos, icons and simple illustrations as **editable vector shapes** (move, resize, recolor, restyle) instead of pixels, without opening an XSS, resource-exhaustion or document-model hole. Acceptance subset is **logos and icons**, not full illustrations (Phase 5 warning: long tail, 4 to 6 weeks, riskiest).

#### Scope

In:

- A new element kind `path` (vector shape) and document version 4, with reader, SQL validation, upgrade of drafts, renderer on canvas and in export, layer row and thumbnail, properties panel (fill, stroke), flatten to raster ("Rasterizar camada", reuse of `rasterize.ts` ideas).
- SVG vector import through an own sanitizing parser (`DOMParser` with `image/svg+xml` on a detached document, never inserted in the DOM (image-editor.md section 3), never `dangerouslySetInnerHTML` (SEC-8)) with element and attribute allowlists.
- AI and PDF vector import from the pdf.js operator list for the same subset, with raster fallback.
- Caps so a vector import never breaks the 200-element and 256 KiB limits.

Out:

- Node editing (Bezier handles, pen tool, boolean path operations): editing limits below.
- Filters, masks, patterns, embedded images, `foreignObject`, animation (SMIL, CSS animation), `use` across files, fonts embedded in SVG, mesh gradients, blend modes inside the SVG.
- Per-subtree rasterization and "raster plus vector overlay" (rejected: whole-file fallback only, see decision 5.D1).
- PDF text as outlines (depends on spike 5-S2; default out).
- Any server processing. Any change to the 4096 px page cap.
- Vector export (SVG/PDF/AI export stays out, 4.4).

#### Prerequisites

1. Phase A decisions R1 (SVG wording), R11 (vector subset, `path` kind may need version 4) approved by the user, and 8h item 8 rewritten from "cost recorded" to "decided" (this phase flips it, docs first, GOLD-3).
2. Phase 3 SVG raster handler exists and is the fallback target; Phase 2 (item 2-4) pdf.js path exists.
3. Spikes 5-S1 and 5-S2 (below) done before items 5-9 and 5-10 start.
4. `data-integrity-auditor` available for the migration (document version change is a gate in plan section 3).
5. Baseline commands green (record output): `npm run lint`, `typecheck`, `test`, `check:consistency`, `check:docs`.

#### Design

**Element shape (all names proposed, add to registry first).** `DesignElementKind.Path` value `path`, pt-BR label "Vetor" (enums.md and ui-glossary). Own fields on top of the base element (`id`, `kind`, `x`, `y`, `width`, `height`, `rotation`, `opacity`, `locked`, `parentId`, blend, mask, clip fields as every kind):

| Field | Meaning and limit |
|---|---|
| `d` | One normalized path string in **box-local units**: the importer converts the source to absolute `M L C Q Z` commands only (arcs become cubics, relative to absolute, `H V S T A` expanded), coordinates translated so the shape bounds start at 0,0 and the element `width`/`height` equal the bounds. Max 16384 characters per element (proposed `DESIGN_LIMITS.maxPathData`), allowed characters `MLCQZ0-9.eE+-` and space and comma only, no more than 3000 commands. Scaling the box scales the path (the renderer applies `scaleX = width / pathWidth`; the original bounds are stored as `viewWidth`, `viewHeight`) |
| `viewWidth`, `viewHeight` | The bounds the `d` was normalized to (numbers 1 to 20000). Resizing changes `width`/`height` only, so the shape stays editable and non-destructive |
| `fill` | `null` or a paint: `{ kind: "solid", color }` or `{ kind: "linear" \| "radial", stops[] , x1,y1,x2,y2 or cx,cy,r }` with coordinates in 0..1 of the box, 2 to 8 stops `{ offset 0..1, color }`, colors `#rrggbb` plus per-stop alpha 0..1 (proposed `DesignPathPaint`, `DesignPathPaintKind`: `solid`, `linear`, `radial`) |
| `stroke` | `null` or `{ paint (solid only in v1), width 0.1..100 (in page px, not scaled by the box), cap butt\|round\|square, join miter\|round\|bevel, miterLimit 1..20, dashed boolean }` |
| `fillRule` | `nonzero` or `evenodd` |

Rationale: one path element with several subpaths in one `d` keeps the element count low (a logo with 40 same-colored pieces is one element). Colors stay user data in the document (UI-9 is about app source, image-editor 5.2). No `href`, no `style`, no free-text attributes are carried: the document stores only numbers, enums and hex colors, so a hostile SVG cannot smuggle anything through the model.

**Version decision (5.D2).** Recommended: **document version 4** (new migration), not an additive kind inside v3. Reasons: `design_assert_document` already keys its kind list and cap by version; an old browser tab or cached client reading a v4 document fails the zod union loudly instead of silently dropping or mis-rendering an unknown kind (silently dropping a layer inside an autosave is data loss); the v3 precedent (`design_upgrade_document`, v2 schema transform) gives a tested pattern. Cost: a migration (checklist `/migration`: RLS untouched, functions replaced, pgTAP, `supabase db reset` local only; production push needs the owner's explicit go-ahead, 8e item 11), `designDocumentV4Schema`, v3 to v4 transform in the reader, `emptyDocument` writes 4, all `version: 3` literals and tests updated, saved versions stay v3 (immutable, GOLD-8) and are read through the transform. The upgrade of drafts is a version number change only (no element rewrite), so it is cheap and reversible in data terms. Alternative (additive v3) is cheaper by about half a week but weaker as a safety gate.

**Limits (all proposed values, owner can adjust):**

- Elements: path elements count toward the existing 200. An import may add at most `200 - current elements` and, to protect the 256 KiB cap, at most `maxVectorImportBytes` = 128 KiB of `d` data in total (proposed `DESIGN_LIMITS.maxVectorImportBytes`); an import that does not fit **falls back to the raster handler for the whole file** with note `vector_rasterized` (registered by Phase A) and the reason `vector_limit_reached` **(proposed note kind, add to registry first)**. Never partially import and silently drop.
- Merge policy before counting: consecutive siblings with identical paint, stroke, opacity and no transform difference merge into one element with concatenated subpaths; groups of the source become one `group` element (existing kind) with path children only if the source has real structure worth keeping (cap: one nesting level in v1), otherwise flat.
- Parse caps (before any element is built): SVG file 5 MB (Phase 3 cap), 5000 nodes, 200 path commands per second of CPU is not a limit, so enforce a **wall time budget of 2 seconds** in the worker and abort with a message; nesting depth 32; `use` expansions 200 total, same-document only; gradient stops 8; numeric values must be finite and within -1e6..1e6.
- Page fit: the artwork is fit inside the page with `fitInside`-style scaling (existing helper `fitInside` in `document.ts`), never beyond `maxCoordinate`/`maxSize` 20000.

**Editing limits (what the user can and cannot do with a `path` element; document it in image-editor.md and the glossary):**

| Can | Cannot (in this phase) |
|---|---|
| Move, resize, rotate, flip (via negative scale is NOT used: add `flipX`/`flipY` booleans proposed or reuse the image approach; decide in 5-5), opacity, blend mode, lock, hide, group, duplicate, delete, layer mask (existing), clip to below (existing), reorder, align and distribute | Edit nodes, add or delete points, boolean operations, convert text to outlines, change individual subpaths separately, edit a gradient on the canvas (gradient is edited by stops in the panel: number of stops, color, offset) |
| Change fill (solid or gradient stops), stroke color, width, cap, join, dashed | Per-subpath different colors (the import keeps different colors as different elements) |
| "Rasterizar camada": convert to a raster layer at the current size and page scale (reuses the raster path; one history step); irreversible except through undo | "Converter raster em vetor" (tracing): out |
| Pixel tools on a vector layer: not directly; the existing rule for shapes applies: the tool offers "Rasterizar" first | Non-uniform resize distorts stroke width? No: stroke width is in page px and not scaled; the shape distorts as any scaled shape does |

Keyboard and accessibility (UI-8): the layers list is the accessible alternative; a `path` element gets the same arrow-key move and resize as other elements; an optional `alt` is **not** added in v1 (decorative vectors are named through the layer name, max 80 characters, existing field); open decision 5.D5.

**Renderer.** Konva `Path` (data, fill, gradient props, stroke, dash) inside the existing element node switch (`design-element-node.tsx`), same node used by the offscreen export stage so screen and export stay equal (image-editor 2.3 determinism). Hit area: `hitStrokeWidth` of at least 8 screen px for thin strokes so selection works. Thumbnails (`design-layer-thumb.tsx`) draw through the same node. The flatten path draws with `Path2D` from the same normalized string (the allowed alphabet makes `Path2D` safe). No `eval`, no external references.

**SVG parser design (own, allowlist).**

- Parse: `new DOMParser().parseFromString(text, "image/svg+xml")` in the worker where available. If a worker has no `DOMParser` (workers do not), parse on the main thread with the time budget and a node cap, OR use a tiny own XML tokenizer in the worker. Recommendation: **own minimal XML tokenizer in the worker** (no DTD, no entities beyond the five predefined, no processing instructions executed, reject `<!DOCTYPE` and `<!ENTITY` outright, which kills XXE and billion-laughs by construction) feeding the allowlist. This also removes the question of `DOMParser` in workers. Honest cost: about 400 lines to own and test; spike 5-S1 compares it with DOMPurify plus DOMParser on the main thread (DOMPurify is MPL-2.0 OR Apache-2.0, per the analysis; its SVG profile is a sanitizer, not a converter, so we would still need our own element walker).
- Element allowlist: `svg`, `g`, `defs`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`, `linearGradient`, `radialGradient`, `stop`, `use` (fragment id inside the same file only), `title`/`desc` ignored. `text`/`tspan`: **not in v1** (fallback), see 5.D3. `clipPath`: **not in v1** (fallback), see 5.D3.
- Attribute allowlist per element: geometry (`x y width height cx cy r rx ry x1 y1 x2 y2 points d`), `transform` (translate, scale, rotate, skewX, skewY, matrix; composed to a matrix and baked into the path coordinates), `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`, `stroke-dasharray` (presence only), `fill-rule`, `opacity`, `fill-opacity`, `stroke-opacity`, `viewBox`, `width`, `height`, `id`, gradient attributes (`offset`, `stop-color`, `stop-opacity`, `gradientUnits`, `gradientTransform`, `x1..`, `cx cy r fx fy`, `href` fragment only). `style="..."`: parse only the declaration names above; any `url(` other than `url(#id)` to a gradient in the same file, any `expression`, `javascript:`, `@import`, `image-set` rejects the file to fallback. A `<style>` element with simple `.class`, `#id` or tag selectors (Illustrator exports this way) is parsed into the same declarations; combinators, pseudo-classes, `@` rules, attribute selectors reject to fallback.
- Anything unsupported (`filter`, `mask`, `pattern`, `image`, `foreignObject`, `script`, `animate*`, `on*` attributes, `href`/`xlink:href` not starting with `#`) is a **file-level fallback** to the Phase 3 raster handler (the browser renders it through `<img>`, which stays safe because scripts and external loads are blocked in that mode) with note `unsupported_node` (registered) and the first offending element name in the note detail. A hostile file with `script`/`onload`/external `href` is treated the same way as in Phase 3 (pre-scan refusal or raster), see test scenarios.
- Units: user units and `px` only; `%`, `em`, `mm`, `pt` converted with fixed factors or fallback; invalid number grammar falls back.
- Transform and arc math: all in own pure functions (matrix compose, arc to cubic, bounds of cubics) with unit tests; no DOM.

**AI/PDF vector design.**

- Source: pdf.js `page.getOperatorList()` with the same hardened `getDocument` options as Phase 0 (8h.4), page 1 or the user's selected page, CTM tracking through `save/restore/transform`, `constructPath` (move, line, curve, rectangle, close), `fill`, `eoFill`, `stroke`, `fillStroke`, color operators. The pdf.js `OPS` enum is exported by the package, but the operator list shape is **not a stable public contract** (pdf.js treats it as internal): pin the version, write generated-PDF tests, and expect to adjust on upgrade. This is risk R5-3.
- Colors: pdf.js color operators arrive already converted to RGB hex in the operator list (this is my understanding, **not verified**; spike 5-S2 confirms). CMYK sources are therefore approximated (note `cmyk_converted`, registered); proper ICC is Phase 6c and does not apply to vector fills in this phase.
- Supported: fills, strokes, solid colors, simple axial/radial shadings only if the operator list exposes them in a way spike 5-S2 shows to be convertible; otherwise fallback. Not supported: clipping other than the page rectangle (`W n` with a non-page path falls back, because AI/PDF files use clips constantly, so the fallback rate may be high: acceptance is stated for the logo/icon subset only), patterns, soft masks, transparency groups with blend, images (drawn as raster layers separately is **not** shipped, see 5.D1), text.
- Text (5.D3): PDF text is glyph drawing with embedded font subsets. Converting to editable `text` needs a font match (curated or brand fonts) and string recovery; converting to outlines needs glyph path access that pdf.js does not offer as public API (**unknown**, spike 5-S2). Default: a page that contains text operators falls back to the raster handler for the whole page unless text is absent. Honest consequence: most AI layouts with type will import as raster; vector AI import is for icons and logos with outlined type.
- Output reuses the same `path` element, the same merge policy and caps.

#### Work items

| Id | Description | Files to create or change | Registry names added FIRST | Owner agent | Depends on |
|---|---|---|---|---|---|
| 5-0 | Docs first: rewrite 8h item 8 as a decision (vector subset, version 4), new section for the `path` element in 5.2, editing limits table, 4.4 scope line, SVG D2 wording stays as Phase A; new glossary rows; stack rows (none new unless 5-S1 picks DOMPurify) | `docs/modules/image-editor.md`, `docs/reference/enums.md`, `docs/reference/data-model.md` (document shape note), `docs/standards/ui-glossary.md`, `docs/reference/error-codes.md` (paragraph: no new code) | `DesignElementKind.Path` ("path", "Vetor"); `DesignPathPaintKind` (solid, linear, radial); import note kind `vector_limit_reached`; `DESIGN_LIMITS.maxPathData`, `maxVectorImportBytes`; glossary: "Rasterizar camada" (check if it already exists, reuse), vector notes, "Vetor" layer name prefix | developer, then standards-reviewer gate | Phase A, user approval of R11 |
| 5-S1 | Spike (scratch, not repo): SVG parser choice. Compare own tokenizer in a worker vs DOMParser plus walker on the main thread vs DOMPurify. Measure with 30 icons and 5 hostile fixtures: correctness, time, bundle bytes. Result unknown until run | scratch only; report in the spike note, then 8h text | none | developer, security-analyst reviews the threat model | 5-0 |
| 5-S2 | Spike: pdf.js operator list on 10 owner-provided AI/PDF files (logos, icons, outlined type, live type). Questions: are colors RGB in the list, are shadings reachable, can glyph outlines be obtained without internal API, how often does a clip force a fallback. Result unknown until run; if the fallback rate on owner files is above 50 percent, recommend cutting 5-10 | scratch only | none | developer | Phase 2 (item 2-4), owner fixtures |
| 5-1 | Document model: `pathElementSchema`, `designDocumentV4Schema`, v3 to v4 transform in the union, `emptyDocument` version 4, `DESIGN_LIMITS` additions, `types.ts` kind, `createPath` helper in `document.ts` with clamps | `src/lib/shared/design/types.ts`, `schemas.ts`, `document.ts` (check the 600-line CODE-13 limit: `document.ts` is 754 lines today, so put path helpers in a new `path.ts`), `document-v3.test.ts` renamed/extended | as 5-0 | developer | 5-0 |
| 5-2 | Migration: `design_assert_document` accepts version 4, kind list adds `path`, validates each path element (types, `d` length and alphabet regex, paint shape, numeric ranges, `viewWidth/viewHeight`), per-document vector bytes; `design_upgrade_document` v3 to v4 version bump; draft rewrite statement; `design_create`, `design_save_draft`, `design_save_version`, `design_restore_version`, `design_set_template` re-checked for hard-coded version lists | `supabase/migrations/<timestamp>_design_document_v4.sql` (timestamp after the last migration, name rules by hooks), `supabase/tests/*` | `docs/reference/functions.md` note on the changed functions; no new error code (invalid shape answers `invalid_input`, size `design_too_large`, both exist) | developer, data-integrity-auditor (mandatory gate) | 5-1 |
| 5-3 | Path geometry library (pure, no DOM): path normalizer (relative to absolute, `H V S T A` to `M L C Q`), arc to cubic, matrix compose, bounds, merge, validator of the allowed alphabet, `Path2D`-safe serializer | `src/lib/shared/design/vector/path-data.ts`, `matrix.ts`, tests | none (internal) | developer | 5-1 |
| 5-4 | Renderer and consumers: element node, offscreen export stage, layer thumb, layer row icon, properties panel (fill, gradient stops, stroke), flatten to raster action, align/distribute/resize-copy/duplicate/group behaviors, history merge keys; work list is every file from `grep -rl DesignElementKind src` plus TypeScript exhaustiveness errors | `design-element-node.tsx`, `design-layer-thumb.tsx`, `design-layer-row.tsx`, new `design-path-properties.tsx`, `design-properties-panel.tsx`, `rasterize.ts`, `arrange.ts`, `layers.ts`, others found by the compiler | glossary rows for panel labels (fill, "Contorno", "Gradiente", cap/join names) added in 5-0 | developer, ux-ui-designer (panel), design-review | 5-1, 5-3 |
| 5-5 | Flip, hit area and keyboard decisions closed (flip fields or none), selection of thin strokes, arrow-key behavior test | element node, tests | glossary if a flip label is added | developer, ux-ui-designer | 5-4 |
| 5-6 | SVG tokenizer and allowlist walker per 5-S1 outcome; style subset; gradients; transform baking | `src/lib/shared/design/import/handlers/svg-vector.ts`, `svg-xml.ts`, `svg-style.ts` | none new beyond 5-0 | developer | 5-S1, 5-3 |
| 5-7 | Vector import orchestration: caps, merge policy, whole-file fallback to `svg-raster` / `pdf` raster with notes, time budget, `ImportedDesign` of kind document with `path` elements, registry line in `registry.ts` (`svg` handler now offers vector first, raster fallback; one handler decision documented) | `registry.ts` (one line), `use-import-place.ts` (placement of vector results, budget check, one history step), `messages.ts` (append keys) | glossary: refusal and note sentences (vector too complex, unsupported feature fallback, time budget) | developer | 5-6 |
| 5-8 | Security pass on SVG: threat model (XXE, entity expansion, `use` recursion, huge coordinates, path data bombs, CSS injection, `href` schemes), hostile fixtures generated in tests | tests and review notes | none | security-analyst, then test-designer | 5-6 |
| 5-9 | AI/PDF vector converter from the operator list with CTM, clip detection, caps, fallback | `src/lib/shared/design/import/handlers/pdf-vector.ts` (or extend `pdf.ts`), tests with PDFs built as strings in the test | none new | developer | 5-S2, 5-7 |
| 5-10 | Cut decision gate: if spike 5-S2 shows a fallback rate above 50 percent on owner files, ship 5-6 and 5-7 only and record AI/PDF vector as not delivered (open decision, not silent) | image-editor.md status | none | standards-reviewer | 5-S2 |
| 5-11 | Tests: unit (geometry, caps, migration pgTAP), hostile inputs, document round trips (v3 read, v4 write, undo), export golden check on one fixture (manual compare), a11y of the new panel | `*.test.ts`, `supabase/tests/`, Playwright only if the project already has an editor e2e (check) | none | test-designer, test-engineer, test-reviewer | 5-4, 5-7 |
| 5-12 | Reviews and closure: code-reviewer, standards-reviewer, data-integrity-auditor re-check, module Implementation status (files, migration, commands, not tested) | `docs/modules/image-editor.md` | none | code-reviewer, standards-reviewer, data-integrity-auditor | all |

#### Acceptance criteria

1. A v3 document (saved version and draft) opens, and after a draft save is stored as v4; a v4 document with a `path` element round-trips through `designDocumentSchema`, `design_save_draft` and `design_save_version`; saved v3 versions are byte-identical afterwards (immutability trigger, GOLD-8).
2. `design_assert_document` rejects a path element with: `d` containing a letter outside the alphabet, `d` over 16384 characters, `viewWidth` 0 or non-numeric, gradient with 1 or 9 stops, a color not `#rrggbb`, more than 200 elements, over 256 KiB (`design_too_large`).
3. A 6-icon fixture set (owner SVG icons, simple paths and gradients) imports as editable `path` elements, each element recolors and resizes, and the exported PNG matches the on-screen render within 1 px edge tolerance (manual compare, reported honestly).
4. A hostile SVG (script, `onload`, external `href`, `foreignObject`, `<!DOCTYPE ... <!ENTITY`, `use` loop) never executes anything, performs zero network requests (Playwright request log or manual network panel; jsdom cannot prove this) and ends as a raster fallback or a refusal with the pt-BR message, never as a half-imported vector.
5. An import that exceeds the element or byte cap falls back to raster for the whole file with the note; no partial vector import occurs.
6. Time budget: a 5 MB SVG of nested groups aborts within 2.5 s with a message and the tab stays responsive (worker terminated).
7. Flatten to raster produces a raster layer of the same bounds in one undo step, and undo restores the path element.
8. For AI/PDF: a generated PDF of a logo (rectangles, curves, solid fills) imports as paths with fill colors equal to the source within 1 per channel; a PDF with live text or a non-page clip imports through the raster path with the note, no error.
9. No file in `src` over 600 lines (CODE-13), no comments in `src` (CODE-1), no `any` (hooks), no new `eval`/`Function`.

#### Verification commands (base.md section 11)

- After code: `npm run lint`, `npm run typecheck`, `npm run format:check`.
- After SQL and constants: `npm run check:consistency`, `npx supabase db reset` (local only), `npx supabase test db`, `npm run db:types`; fallback without Docker `npm run db:verify` (does not replace `supabase test db`).
- After documents and registries: `npm run check:docs`.
- Flows: `npm run test`; `npm run e2e` only if an editor e2e exists; `npm run build` to confirm vector handlers are lazy chunks and to record sizes.
- Report exactly what ran. Not runnable here, to be reported as not tested: real browser rendering and export equality, Safari/Firefox behavior, worker abort behavior under load, network-log zero requests, production migration push.

#### Security notes

- Principle: the **document model is the sanitizer**. Nothing from the source file except numbers, enums and hex colors enters the document; no string from the file reaches the DOM or a stylesheet. Layer names come from `id` or element names, truncated to 80 characters, rendered as text only.
- XML: no DTD, no entities, no external resources, enforced by the own tokenizer (spike 5-S1 may change this; the property must hold whichever parser wins).
- Resource exhaustion: node, depth, `use` expansion, command, gradient, byte and time caps all enforced **before** building elements; abort terminates the worker.
- Path strings are re-serialized from parsed numbers, never copied from the source, so `Path2D` and Konva only see the allowed alphabet.
- pdf.js: hardened options of Phase 0, no network, refuse encrypted, no XFA, no JavaScript actions executed (pdf.js does not run them; still assert in a test with a PDF that has one).
- Server side: `design_assert_document` is defense in depth against a modified client (SEC-6 second validation); zod on the server function remains.
- SEC-8 unchanged: no `dangerouslySetInnerHTML`; D2 wording scope was clarified in Phase A.
- SEC-12: file text and names are not stored beyond layer names; `ImportedDesign.metadata` rules of Phase 1 apply.

#### Test scenarios (hostile inputs included)

SVG: valid icon with gradient; `viewBox` offset negative; transform chains with skew; arc commands (large-arc and sweep flags permutations); `H V S T` relative forms; `fill="none"` with stroke; `use` of a fragment (valid) and `use` referencing itself (loop, rejected), `use` with an external URL (rejected); 10 000 nested `g` (depth cap); 50 000 `path` nodes (node cap); a path with 1 000 000 commands (byte cap); coordinates `1e308`, `NaN`, `Infinity`, `-0`; `<!DOCTYPE>` with an entity bomb; `<script>`, `onload`, `javascript:` in `href`; `style` with `url(http://...)`, `@import`, `expression(`; `foreignObject` with HTML; CSS class soup; gradient referencing a missing id (falls back to no fill with a note, or file fallback: decide and test one); gradient stop offsets unsorted or out of range; BOM and UTF-16 files; truncated XML; wrong extension for the content; zero-size `viewBox`; a 4 MB file of whitespace.
Document and DB: v3 draft upgrade; v4 with unknown kind; `path` in a v3 document rejected by the v3 branch; resize copy ("Redimensionar") of a design with paths; template copy; restore of a saved v3 version into a v4 draft; undo/redo around a vector import; autosave size near 256 KiB.
PDF: generated PDF with rectangle fill, bezier, stroke, even-odd; non-page clip; transparency group; text; image; encrypted; JavaScript action; 5000 paths; operator list with unbalanced `save/restore`.
Edge: import into a page that already has 190 elements; import of an SVG larger than the page; two imports in a row (one history step each).

#### Risks

| Id | Risk | Mitigation |
|---|---|---|
| R5-1 | Long tail of SVG and PDF features; users expect Illustrator-level fidelity | Acceptance subset is logos and icons; explicit fallback with a pt-BR note; no silent loss |
| R5-2 | Version 4 cost: 39 files touch element kinds; migration on production | Compiler-driven work list; local migration only until owner go-ahead; additive alternative recorded in 5.D2 |
| R5-3 | pdf.js operator list is not a stable public API | Pin version; generated-PDF tests; isolate in one file; allowed to break on upgrade with a failing test, not silently |
| R5-4 | Own XML tokenizer bugs | Spike compares with DOMParser; fuzz-style generated tests; fallback path remains the safe browser `<img>` raster |
| R5-5 | Stroke and gradient fidelity differs between Konva and the SVG renderer | Golden compare on owner icons; document known differences in a note; gradients limited to 8 stops |
| R5-6 | Editing expectations (node editing) | Documented "cannot" list and "Rasterizar camada"; node editing is a separate future decision |
| R5-7 | 200-element cap with real logos (hundreds of pieces) | Merge policy plus whole-file raster fallback; raising the cap is a separate decision, not part of this plan |
| R5-8 | Memory/time of parsing large files in the main thread if no worker is possible | Worker-only parse (own tokenizer); time budget |

#### Blocked or needs the user

- Approval of R11 wording and the **decision to bump to version 4** (5.D2) and to run the migration on production later (separate owner instruction).
- Owner-provided fixtures: 6 to 10 SVG icons and logos, 3 hostile SVGs may be generated by tests, 5 to 10 AI/PDF logos and layouts (needed for spike 5-S2 and acceptance 3 and 8).
- Visual sign-off of fidelity (a human must compare exports): cannot be validated by tests alone.

#### Open decisions (one recommendation each, DOC-5)

| Id | Question | Recommendation |
|---|---|---|
| 5.D1 | Mixed imports (vector paths plus raster images inside one SVG/PDF) | Whole-file fallback to raster; no hybrid. Reason: hybrid doubles the matrix of cases and the history/undo semantics |
| 5.D2 | Version 4 or additive kind in v3 | Version 4 (explicit gate, matches the v3 precedent); cost about half a week more |
| 5.D3 | Text and `clipPath` in v1 | Both out: file falls back to raster. Revisit text after spike 5-S2 shows whether outlines are reachable, and a single rectangular `clipPath` later |
| 5.D4 | Gradients in v1 | In (linear and radial, 8 stops, solid stroke only); logos use them constantly |
| 5.D5 | `alt` text on vector elements | Not in v1; layer name is the label; add `alt` with images' 300-character limit only if design-review asks for it |

---

### Phase 6 - Static Lottie, HEIC, CMYK with ICC

Three independent tracks. They may run in parallel after their own prerequisites; 6b is blocked on counsel; 6c begins with a spike whose result is unknown.

#### 6a - Lottie, first frame, no `eval`

##### Objective

Import a Lottie JSON as one static picture (first frame) so a designer can reuse an illustration, without running expression code and without needing `unsafe-eval`.

##### Scope

In: `.json` Lottie (not `.lottie` zip), parse and validate with zod, refuse anything containing expressions, render frame at `ip` (first frame) to a canvas through a renderer that cannot evaluate JavaScript, import as one raster layer (default) with note `animation_ignored` (registered). Optional later: convert frame shapes to `path` elements (Phase 5), see open decision 6.D1.

Out: animation playback or export (belongs to the video/motion track, video-editor.md), `.lottie` (dotLottie zip), image layers with external URLs, embedded fonts, text layers (text layers fall back to omitted with a note unless the renderer draws them without fonts: see test), expressions of any kind, 3D layers, audio.

##### Prerequisites

R12 approved. Phase 3 raster path (`import-place`) available. License of any candidate renderer verified from its published license file (the analysis did NOT verify `lottie-web`'s license). The deployment CSP checked by the developer: if it forbids `unsafe-eval`, any renderer that uses `new Function` fails at runtime and the spike must detect it.

##### Work items

| Id | Description | Files | Registry names FIRST | Owner | Depends on |
|---|---|---|---|---|---|
| 6a-S1 | Spike (scratch): evaluate three options for rendering one frame without eval: (a) `lottie-web` light/canvas build without the expression module, (b) a WASM/own-engine player (for example dotLottie/ThorVG-based, license and size to be verified), (c) own converter of a Lottie shape subset into Canvas 2D calls. Criteria: license, size, no `eval`/`new Function` in the built chunk (grep the built output), works under a test page served with a CSP without `unsafe-eval`, fidelity on 5 owner files. Result unknown until run | scratch | none | developer, security-analyst | R12 |
| 6a-0 | Docs first: stack row only for the library chosen; glossary refusals; 8h item 9 updated to the spike result | image-editor.md, technical-architecture stack table, ui-glossary | `DesignImportFormat` value `lottie` registered in this change (values are registered per phase, with their handler, CODE-11; not before); refusal messages (proposed: expressions present, too large, unsupported Lottie version); note kind `unsupported_node` reused | developer, standards-reviewer | 6a-S1 |
| 6a-1 | Validator: JSON size 5 MB, depth cap, layer cap 500, shape cap 20 000, allowed layer types (shape, solid, precomp, null), refuse any property object whose `x` key is a string (expression), refuse layer `ef` effects, refuse asset `u`/`p` pointing to URLs and `e:1` embedded images in v1 | `import/handlers/lottie.ts`, `lottie-validate.ts` (zod) | none beyond 6a-0 | developer | 6a-0 |
| 6a-2 | Frame render in a worker (OffscreenCanvas when available, otherwise main thread with a time budget), canvas size from `w`,`h` clamped to 4096 and the raster budget, hand to the raster placement | `handlers/lottie.ts`, `worker` registration line | none | developer | 6a-1 |
| 6a-3 | Tests and security review | tests | none | test-designer, test-engineer, security-analyst, test-reviewer | 6a-2 |

##### Acceptance criteria

1. A Lottie with an expression (`"x": "var $bm_rt..."`) is refused with the pt-BR message before any renderer is loaded (spy on the dynamic import).
2. The built chunk of the renderer contains no `eval(` or `new Function` (grep result recorded), and the first-frame import works in a page served with a CSP lacking `unsafe-eval` (manual or Playwright header test; reported as not tested if not run).
3. A simple shape Lottie (3 layers) imports as one raster layer of the right aspect, note `animation_ignored` shown.
4. A 5 MB nested precomp Lottie aborts within the time budget with a message.

##### Verification commands

Same as Phase 5 list; plus `npm run build` and the grep of the built chunk for `eval(`/`new Function` (record output). Not testable here: real CSP behavior in production headers, visual fidelity.

##### Security notes

Expressions are JavaScript executed with `eval` in `lottie-web` (analysis, cites the CertiK write-up of incidents): the pre-scan refuses them BEFORE loading the renderer, and the renderer must not be able to run them even if the scan is bypassed (light build or own renderer). No `unsafe-eval` is ever added to a CSP for this feature. Image asset URLs are refused (no network fetch, SSRF/privacy). JSON is untrusted: `JSON.parse` depth and size capped before zod. If the spike finds no option that satisfies the criteria, **do not add it** (R12) and keep Lottie unsupported with a message that asks for PNG/SVG.

##### Test scenarios

Expression in a transform, in a text document, in a nested precomp; `ef` effect with expression; `"x"` string at depth 40; asset with `u: "http://..."`; asset with `e:1` base64 image (refused); 10 MB file; layer count 100 000; keyframes with NaN; missing `w`/`h`; `ip` after `op`; version field absent; BOM; truncated JSON; `.lottie` zip renamed to `.json` (sniff rejects); huge canvas `w: 100000`.

##### Risks

| Risk | Mitigation |
|---|---|
| No renderer meets the no-eval criterion | Own subset renderer (cost 2 to 3 weeks, unknown) or leave Lottie unsupported; user decision |
| License unknown for candidates | Verified in 6a-S1 before any dependency; otherwise blocked |
| Fidelity of first frame often an "empty" frame (animations start from nothing) | Open decision 6.D1: use the middle frame instead; R12 says first frame, so a change goes through 9.1 |

##### Blocked or needs the user

R12 approval; 5 owner Lottie files; a decision on the first-frame-versus-poster-frame question (6.D1).

##### Open decisions

| Id | Question | Recommendation |
|---|---|---|
| 6.D1 | Which frame | Keep R12 literal (first frame `ip`), but offer later a frame choice only after real files show empty first frames; do not widen scope now |
| 6.D2 | Raster layer or `path` elements | Raster layer in this phase (independent of Phase 5); conversion to paths is a later optimization |

#### 6b - HEIC/HEIF (blocked on counsel)

##### Objective

Import phone photos in HEIC/HEIF, using the browser's native decoder when it exists and a **separately loaded, replaceable** WASM decoder otherwise, only after legal sign-off.

##### Scope

In: HEIC/HEIF still images (primary image only), EXIF orientation applied, 8-bit sRGB output as a raster layer through the existing path, note when 10-bit or wide gamut was reduced (`depth_reduced`, registered). The registry values `heic` and the format row are added **at unblock time inside the same change** (Phase A decision: no value for blocked formats).

Out: HEIF image sequences, Live Photos motion, depth maps, auxiliary images, HEVC video, server-side conversion, HEIC export, storing the original.

##### Prerequisites (all required; the work does not start without them)

1. Counsel sign-off on **LGPL-3.0 libheif** (and its HEVC decoder, commonly libde265, also LGPL) per the checklist in Phase 7 section 7.0, recorded in the module doc (decision, who, date).
2. Counsel sign-off on **HEVC patent licensing** (H.265 is covered by patent pools; copyright license compliance is not patent clearance). The analysis did not cover this; flagged here as a separate question for counsel. If counsel will not clear it, ship native-decode only (below).
3. A verified `libheif-js` build layout: whether it ships the `.wasm` as a separate file or embeds it in JS (unverified: spike 6b-S1).
4. Phase 2b raster handler pattern (`createImageBitmap`) and the worker skeleton.

##### Design

- Sniff: ISOBMFF `ftyp` box brands `heic`, `heix`, `hevc`, `mif1`, `heif`, `msf1` (own parser, bounds-checked); extension `.heic`/`.heif` must agree.
- Pre-decode size check from the `ispe` box dimensions (own parse) against the 4096 cap and the 512 MiB budget **before** any WASM decode; reject if there is no `ispe` or it is inconsistent.
- Order: (1) native `createImageBitmap` on a typed Blob (Safari, and any browser/OS that supports HEIC; feature detection by attempting decode, not by user agent); (2) if native fails and the feature is legally cleared, dynamic `import()` of the replaceable WASM module in the worker; (3) otherwise the pt-BR message that says to convert to JPEG (the iOS "Most Compatible" setting or export from Photos).
- Replaceability design (to be confirmed by counsel, not assumed to satisfy LGPL): the decoder lives in its own file(s) under a stable path (for example `public`-served or an emitted asset, never merged or minified into the app chunks), the app talks to it only through a narrow, documented interface (`decode(bytes) -> { width, height, rgba }`) behind a worker message boundary, the unmodified upstream license text and a pointer to the corresponding source and build instructions ship with the product (a "Licenças de terceiros" page or file), and swapping the file requires no rebuild of the app. Whether an application bundler that fingerprints file names meets "relinkable" for counsel is an explicit question in the checklist.
- Bundle: not in the main chunk; the WASM binary size is not known here (spike), plan on loading only when a HEIC file is chosen and native decode failed.

##### Work items

| Id | Description | Files | Registry FIRST | Owner | Depends on |
|---|---|---|---|---|---|
| 6b-0 | Counsel package: license texts, linking model description, patent question, the interface sketch; recorded sign-off (outside the repo as a document the owner provides; the repo records only decision, date, name of approver, and scope) | `docs/modules/image-editor.md` 8h update | none | developer prepares text; the owner obtains sign-off | none |
| 6b-S1 | Spike: package layout of `libheif-js` and a candidate build, size, memory, decode time on a 12 MP and a 48 MP HEIC, support for iPhone HEIC with HDR gain map, behavior on corrupt files. Result unknown | scratch | none | developer | 6b-0 |
| 6b-1 | Registry: `DesignImportFormat` value `heic`, labels "HEIC", glossary refusal rows (unsupported by this browser, convert to JPEG, too large, damaged), stack row (license, version, role, size, lazy), third-party licenses page entry | enums.md, ui-glossary.md, technical-architecture stack table | `heic`; messages (proposed names, add first) | developer, standards-reviewer | 6b-0 |
| 6b-2 | Handler: sniff, `ispe` pre-check, native attempt, replaceable decoder load in worker, EXIF orientation, memory release, tests | `import/handlers/heic.ts`, `heic-box.ts`, worker decoder file | one registry line | developer | 6b-1, 6b-S1 |
| 6b-3 | Licensing artifacts shipped and linked from the product | licenses file/page | none | developer, standards-reviewer | 6b-2 |
| 6b-4 | Tests, security review | tests | none | test-designer, test-engineer, security-analyst, test-reviewer, code-reviewer | 6b-2 |

##### Acceptance criteria

1. Without counsel sign-off recorded in the module doc, no `heic` value exists in the code (verifiable by grep).
2. On Safari (native), a HEIC imports without loading the WASM chunk (network panel; manual).
3. With the WASM path, a 12 MP HEIC imports within the raster budget; a HEIC declaring 60000 x 60000 in `ispe` is refused before the WASM module is requested (spy on the dynamic import).
4. The built application chunks contain no libheif code (grep of `dist` chunks for a distinctive symbol; record output); the decoder is a separate emitted file.
5. EXIF rotation is applied; a 10-bit file is reduced with the note.

##### Verification commands

Phase 5 list plus `npm run build` and the chunk grep. Not testable here: real iPhone files, Safari native support, HEVC decode on Windows/Chrome (may depend on OS codecs, unverified), memory on real devices, legal conclusions.

##### Security notes

Untrusted binary parser in WASM: run only in a worker with a time budget and terminate on cancel; dimension and byte caps from our own box parse before the decoder; refuse files with grid-tile counts above a cap (grid images compose many tiles; cap 1000 tiles, proposed); never load the decoder from a CDN (supply chain and CSP): self-hosted asset only, integrity pinned by the lockfile; patched versions (libheif has had memory-safety CVEs historically; track advisories and report `npm audit` output, do not assume).

##### Test scenarios

Valid HEIC; HEIF with no `ispe`; `ftyp` brand mismatch with `.jpg` name; truncated `mdat`; grid with 100 000 tiles; `ispe` 65535 x 65535; two primary items; rotation transforms (`irot`, `imir`); depth/auxiliary image present; Live Photo; corrupt decoder output size; cancel mid-decode (worker terminated, memory freed); native decode fails and WASM chunk missing (message, not a crash).

##### Risks

| Risk | Mitigation |
|---|---|
| Counsel refuses LGPL bundling or HEVC patents | Native-only mode plus message "converta para JPEG"; zero code of libheif shipped |
| Browser/OS HEVC support is inconsistent and cannot be tested here | Feature detection by attempt; matrix to be run by the owner on real devices |
| WASM size and memory on iOS | Native path on Safari (iOS uses native); WASM only on others; budget and spike numbers |
| Replaceability claim is wrong | It is a counsel question, listed explicitly; do not market it as compliant before sign-off |

##### Blocked or needs the user

Counsel sign-off (LGPL, HEVC patents), owner HEIC samples (iPhone, Android HEIF), real-device checks. Honest status: **blocked**.

##### Open decisions

| Id | Question | Recommendation |
|---|---|---|
| 6.D3 | Ship native-decode only first | Yes: implement native decode plus the "convert to JPEG" message after counsel or even without counsel (no third-party code), and add the WASM chunk only after sign-off. Native-only needs the `heic` registry value, which is safe (no license issue) |
| 6.D4 | Where the decoder file is hosted | Same origin emitted asset, not a CDN |

#### 6c - CMYK with ICC (spike first)

##### Objective

Convert CMYK (and gray) sources with an embedded ICC profile to sRGB at import with a defined rendering intent, instead of the SWOP approximation, and tell the user when no profile was embedded.

##### Scope

In: CMYK JPEG (Adobe APP14, ICC in APP2 segments), CMYK TIFF (tag 34675), CMYK PSD (ICC image resource 1039, raw channels) and the PDF `ICCBased` fills if cheap (not required). Output: 8-bit sRGB RGBA, then the existing raster path. Rendering intent relative colorimetric with black point compensation (default) with the profile's own intent as a documented alternative (open decision 6.D5).

Out: soft proofing, editing in CMYK, keeping the profile in exports (export stays sRGB PNG/JPEG, 4.4), Lab, duotone, multichannel, 16-bit editing, ICC conversion of RGB profiles other than sRGB (browsers handle PNG/JPEG; TIFF/PSD RGB with wide-gamut profiles is a follow-up, 6.D6), spot colors.

##### Prerequisites

1. R5 approved: "CMYK with ICC conversion enters scope" and image-editor 4.4 text updated first (the analysis said "revisit with the owner before any ICC work").
2. Owner-provided fixture set with **reference outputs** (for example the same file converted in Photoshop to sRGB with a stated intent): without references the accuracy criterion cannot be checked, only "looks plausible".
3. Phase 2b TIFF handler (UTIF, worker) and Phase 0 PSD two-pass exist.
4. Spike 6c-S1 complete.

##### Work items

| Id | Description | Files | Registry FIRST | Owner | Depends on |
|---|---|---|---|---|---|
| 6c-S1 | Spike (scratch). Questions with unknown answers: (1) do Chrome/Firefox/Safari already convert CMYK JPEG with an embedded profile when decoded natively (compare with the reference), (2) can `ag-psd` give raw CMYK channels (`useRawData`), (3) does a WASM CMS (LittleCMS-based, license and maintenance to be verified) or an own transform (CLUT A2B tetrahedral interpolation plus Lab to sRGB plus BPC) meet the accuracy and speed targets on 4096 x 4096. Measure: CIEDE2000 mean and p95 against references, time and peak memory in a worker, bundle size. Targets proposed for owner agreement: mean DeltaE00 <= 2 and p95 <= 5 relative to the reference on the fixture set; 4096 x 4096 in <= 10 s on a mid laptop (not measured) | scratch | none | developer, security-analyst (parser review) | R5 approval, fixtures |
| 6c-0 | Docs first: scope text (4.4 "CMYK and color profiles" split: import conversion in, everything else out), tolerance agreed with the owner, stack row of the chosen engine, glossary notes | image-editor.md, technical-architecture stack table, ui-glossary | note kinds `cmyk_converted` (registered), `cmyk_approximated` for no profile (proposed, add first), `icc_profile_invalid` (proposed) | developer, standards-reviewer | 6c-S1 |
| 6c-1 | ICC reader: header validation (size, signature `acsp`, version, class, color space `CMYK `/`GRAY`, PCS), tag table bounds, only the tags we use (`A2B0`/`A2B1`, `chad`, `wtpt`, `bkpt`), strict limits (profile <= 4 MiB, CLUT grid <= 33^4 entries, tag count <= 100), extraction from JPEG APP2 chunks (sequence and count validation), TIFF tag, PSD resource | `src/lib/shared/design/import/color/icc-profile.ts`, `jpeg-icc.ts` | none | developer, security-analyst | 6c-0 |
| 6c-2 | Transform engine in a worker: CMYK to sRGB with intent and BPC, tiled with progress and cancel, output into the raster budget (CMYK buffer 4 B/px plus RGBA 4 B/px: 128 MiB at 4096 x 4096, checked before decode) | `color/cmyk-transform.ts`, worker registration | none | developer | 6c-1 |
| 6c-3 | Integration: JPEG CMYK path (own CMYK extraction since the browser may convert or fail: decision after spike), TIFF CMYK path, PSD CMYK path replacing the SWOP approximation when raw channels and a profile exist, notes and metadata (`colorMode`, `profileName`) | handlers `image.ts`, `tiff.ts`, `psd.ts` (edits are allowed here only because this item is the integrator; serialize with other streams) | none | developer | 6c-2 |
| 6c-4 | Tests with generated profiles (a synthetic tiny CMYK profile built in the test) plus owner references; hostile profiles; golden tolerance test marked as owner-fixture dependent | tests | none | test-designer, test-engineer, test-reviewer | 6c-3 |
| 6c-5 | UX: import notes wording (profile applied versus approximated), no dialog unless 6.D5 chooses an intent selector | glossary, notes panel | glossary rows | ux-ui-designer, design-review | 6c-3 |
| 6c-6 | Review and closure | status doc | none | code-reviewer, standards-reviewer | all |

##### Acceptance criteria

1. With the owner reference set: the agreed DeltaE00 tolerance holds (numbers reported, including failures; do not round up).
2. A CMYK JPEG with no profile imports with the SWOP-like approximation and the note `cmyk_approximated`; with a profile it imports with the profile and the note names it (name truncated, text only).
3. A CMYK source declaring 65535 x 65535 is refused before allocation; the budget check includes the CMYK source buffer.
4. A malformed ICC profile (bad signature, tag offset beyond end, CLUT size overflow, 1 GiB declared) is refused with a message and never crashes the worker or the tab; the file then falls back to the approximation or is refused (decide in 6.D7; recommendation: fall back to approximation with the note).
5. Cancel terminates the worker; no pixels remain in the raster store.
6. Display P3 narrowing and 16-bit reduction notes are unchanged.

##### Verification commands

Phase 5 list; plus the accuracy script run (scratch, outputs pasted in the status). Not testable here and reported as not tested: perceptual match without owner references, behavior on real devices, speed on low-end hardware.

##### Security notes

ICC profiles are binary structures with offsets and sizes: every offset and length is bounds-checked against the buffer, integer overflows are guarded (multiplication of grid points, tag counts), no recursion, all allocation sizes computed and capped before allocating; profile text (description tags) is untrusted, truncated and shown only as text. JPEG APP2 reassembly validates sequence numbers and total length. The engine runs in a worker with a time budget. If a WASM CMS is chosen: license and maintenance verified in the spike, no network loading, integrity through the lockfile.

##### Test scenarios

CMYK JPEG with Adobe APP14 transform 0 and 2, inverted channels, multi-segment ICC (out of order, missing segment, duplicate sequence), profile with `A2B0` only, with `A2B1` only, with a 3-D RGB profile in a CMYK file (mismatch), gray profile, Lab PCS versus XYZ PCS, 8-bit versus 16-bit LUT, `mAB ` versus `mft1/mft2` types, CLUT grid 2 versus 33, tag offsets overlapping, truncated profile, 4096 x 4096 stress, all-black and all-white and out-of-gamut pixels (clipping behavior), PSD CMYK with layers, TIFF CMYK with alpha (extra samples), TIFF with ink set other than CMYK (refused).

##### Risks

| Risk | Mitigation |
|---|---|
| The spike finds no engine meeting accuracy and speed | Keep the approximation, record the result, do not ship 6c; this is a valid outcome |
| Reference ambiguity (Photoshop settings) | The owner states intent and BPC used to make the references |
| Performance at 4096 x 4096 in a worker | Tiling, progress, time budget; cap CMYK sources at a smaller side if needed, note downscale |
| Maintenance burden of an own ICC engine | Prefer a maintained WASM engine if its license and size pass; otherwise limited own implementation covering only `mft1/mft2/mAB` CMYK tables |
| Scope drift into color management (soft proof, export profiles) | The Out list; additions through 9.1 |

##### Blocked or needs the user

R5 approval, fixtures with references, agreed tolerance, device checks.

##### Open decisions

| Id | Question | Recommendation |
|---|---|---|
| 6.D5 | Intent | Relative colorimetric with black point compensation, no UI selector in v1 |
| 6.D6 | RGB wide-gamut profiles in TIFF/PSD | Out of this phase; separate follow-up once the engine exists (it reuses the same transform for matrix/TRC profiles) |
| 6.D7 | Damaged profile behavior | Fall back to approximation with a note, not a refusal |
| 6.D8 | Build the engine at all | Decide after spike 6c-S1 with real numbers; no commitment before |

---

### Phase 7 - EPS, Figma API, Canva Connect (proposal sections and unblock checklist only)

Phase 7 produces **no code and no registry values**. Each section below is a proposal with a recommendation. Implementation tasks start only when the checklist of 7.0 for that item is complete and the user approves in writing (GOLD-3).

#### Objective

Record, for each remaining format request, what it would take, what it costs, and a clear recommendation, so the owner can decide once and the plan does not drift.

#### Scope

In: proposals, recommendations, the unblock checklist, the documents to be written at unblock time. Out: any implementation, any credential handling, any registry value for these three (Phase A rule: a value without a handler is dead code, base 9.3), any ADR-14 change before the decision.

#### Prerequisites

Phases A to 4 delivered; PDF import (2a) in production use, because it is the recommended path for two of the three.

#### Work items

| Id | Description | Files | Registry names | Owner agent | Depends on |
|---|---|---|---|---|---|
| 7-1 | Write the three proposal sections in a single decision-record document: **one document per topic (DOC-3)**; the user must confirm creating it (the hook asks for confirmation). Recommended placement: new `docs/modules/design-import-integrations.md`, or as sections of image-editor 8h if the user prefers no new file | proposed new doc, image-editor.md pointer | none | software-architect writes, developer commits docs, standards-reviewer gates | Phase A |
| 7-2 | EPS: add a pt-BR message "EPS nao e aceito; exporte como PDF" for the sniffed EPS (`%!PS-Adobe` and DOS EPS binary header `C5D0D3C6`) so the refusal is helpful; this is a refusal of a sniffed type, not support, and needs no enum value if handled as an unsupported-type message with a hint | `import/sniff.ts` (a sniffer that returns a hint), `messages.ts`, ui-glossary | glossary message (proposed, add first); no `eps` enum value | developer, test-engineer | 7-1 |
| 7-3 | Unblock tracking: a checklist table in the document (section 7.0) with owner, date, evidence pointer; updated by the person who unblocks the item | the 7-1 document | none | developer | 7-1 |
| 7-4 | After the user unblocks a specific item: a new plan phase with the proper registry, migration, security review (not part of this plan) | n/a | n/a | software-architect | unblock |

#### 7.0 Unblock checklist (exact, per item; all boxes required)

Common to all three:

- [ ] The user states the decision in one line and approves the wording of the rule change (GOLD-3, base 9.1): documents updated FIRST, then code, then dead code removed (9.3).
- [ ] Secrets and credentials: **OAuth client id and client secret live only in the deployment secret store (for example the hosting provider's encrypted environment variables), never in files, commits, documents, logs or chat** (SEC-4, GOLD-7). The repository documents only the variable **names** and where they are configured, never values. The assistant does not read, print or edit `.env*` files; the owner sets values in the dashboard and in the local untracked environment file by hand. Names are proposed and must be registered first (for example `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `INTEGRATION_TOKEN_KEY` if a new key is required, **proposed, add to the env registry first**; check whether the existing token-crypto key can be reused or whether a separate key per integration is cleaner (key separation limits blast radius; recommendation: separate key)).
- [ ] Privacy review (SEC-12): what personal or client data leaves to the third party (file content, names, comments, user id), retention at the provider, data-processing terms, whether the client's contract allows it, the privacy notice text, a statement of what Aura stores (token only, no file copy). Signed off by the owner, recorded in the document.
- [ ] Security review by `security-analyst` of the specific design (OAuth flow, token storage, SSRF on returned URLs, logging, revocation).
- [ ] Fixtures or sandbox accounts supplied by the owner (not customer files); recorded fakes in tests are labeled as fakes and never reported as live behavior.

EPS-specific:

- [ ] Decision on option (a) commercial Artifex license, (b) AGPL WASM in the browser, (c) not supported (recommended).
- [ ] If (a) or (b): counsel sign-off on **AGPL-3.0 Ghostscript**: whether browser-side WASM distribution triggers AGPL obligations for the application, the corresponding-source offer for the exact build used, notices, and whether the isolated worker interface is enough to keep the rest of the application outside the copyleft (a counsel question; do not assume). If (a), a purchased license and its terms.
- [ ] If server-side conversion is ever wanted: **ADR-14 amendment** (technical-architecture-v0.1.md) written first: why browser-only is insufficient, which host (function limits, CPU/memory, a worker host), data handling, cost; plus infra owner decision. EPS conversion would make the server process user files, which is exactly what ADR-14 avoids.

Figma-specific:

- [ ] Figma developer app created by the owner (client id/secret in the secret store, redirect URI registered per environment), decision on scopes (minimal; the file-read scope name and whether PKCE is supported must be verified in Figma's current documentation at implementation time, not assumed).
- [ ] **ADR-14 amendment** limited to "server may fetch and relay third-party renders and store encrypted tokens; no image processing on the server"; the server never decodes images.
- [ ] Rate limit and plan constraints understood (Figma API access depends on the user's plan and seat; unverified here).
- [ ] New server functions, error codes, action catalog entry, audit actions, data-model rows (token table), routes (OAuth callback) registered first; `base.md` section 2 "social platforms" row clarified (not a social integration).

Canva-specific:

- [ ] Canva Connect integration created by the owner; check whether the integration may be used by users outside the owner's team without Canva's review/approval (unverified here: Canva may require a review for public integrations), and the Canva account plan needed.
- [ ] Verify Canva's current export format list and job semantics from its own documentation at implementation time (the analysis got the list only from a third-party aggregator).
- [ ] Same ADR-14 amendment, token storage, registries and privacy review as Figma.

LGPL libheif (HEIC) - repeated here because it is a Phase 6b blocker: counsel sign-off on LGPL-3.0 libheif plus its HEVC decoder dependency and on HEVC patent licensing, the linking and replaceability model of 6b, the licenses page, and the corresponding-source offer.

#### 7.1 EPS proposal

What it needs: a PostScript interpreter. pdf.js cannot read EPS. Ghostscript is AGPL or commercial (analysis). Client WASM builds are AGPL and carry distribution duties; server use conflicts with ADR-14 and moves user files to a server.
Costs: legal (counsel or paid license), a large WASM payload (size not measured here), memory, a long tail of PostScript features, and security exposure (Ghostscript has a history of sandbox escapes through PostScript; running it in a browser worker limits impact but not CPU/memory abuse).
Value: low and declining. Illustrator and most tools can save or export PDF; a modern EPS is typically also available as PDF-compatible AI.
**Recommendation: do not support EPS. Detect EPS by signature, refuse it with a pt-BR message that tells the user to export as PDF (or AI with PDF compatibility), which Phases 0 and 2a already import.** Re-open only if real user demand is recorded and counsel plus the owner choose option (a).
Cost of changing the recommendation: license purchase or AGPL compliance work, 3 to 4 weeks of implementation, a spike on memory and speed, a new security review.

#### 7.2 Figma proposal

Facts from the analysis: no public `.fig` spec (community parsers are reverse engineered and fragile: do not build on them); the REST API gives the node tree JSON and renders (PNG, JPG, SVG, PDF) for nodes with a token (the analysis cites the `file_content:read` scope; verify at implementation); the token must stay on the server (SEC-4); it is a new integration that sends user design data to a third party (SEC-12).
What it would provide beyond manual export: pick a frame by link and import it without the user downloading a file, optionally with text and layer names for the import metadata.
Value versus the alternative: the user can already export a Figma frame as PNG, PDF or **SVG**; PDF imports through 2a, PNG through the raster path, and after Phase 5 an exported SVG imports as editable vectors. The API saves a manual step; it does not unlock new fidelity unless the node tree is mapped to editable layers, which is a Phase-5-sized mapping project on its own.
Design if approved (sketch, not decided): `lib/shared/integrations/figma/` (R7 placement) with zod-validated functions: connect (OAuth code flow, state parameter, PKCE if supported, redirect URI per environment), `importFigmaFrame` (fetch a render URL for a node id, validate that the URL host is on an allowlist before fetching, follow no redirects off the allowlist, enforce a byte cap while streaming, relay the bytes to the browser or let the browser fetch if CORS allows, then decode in the browser as an ordinary PNG/PDF/SVG through the existing pipeline), disconnect with token revocation at Figma. Tokens encrypted at rest with the existing token-crypto approach, but note SEC-5: the readers of stored tokens are restricted modules, so this integration needs its own allowed reader module or an ESLint rule update, which is a decision to record. Every call authorized by an action (proposed `design.integration.manage`, **proposed, add to action catalog first**), audit actions (proposed `design.figma_connected`, `design.figma_imported`, `design.figma_disconnected`, **proposed**), error codes (proposed `figma_not_connected`, `figma_rate_limited`, **proposed**), a token table with brand/organization scope and RLS (data-integrity-auditor gate), routes for the OAuth callback (**proposed**, routes.md first).
Risks: rate limits and plan constraints (unverified), URL expiry of renders, SSRF through returned URLs, provider API changes, privacy and contract exposure for client designs, token theft consequences, support burden.
**Recommendation: do not build the Figma integration now.** Ship the manual path with a short in-product hint ("No Figma: Arquivo > Exportar > PDF ou SVG") after Phases 2a and 5. Reopen when (a) Phase 5 is delivered, (b) at least a few real users ask for it, (c) the owner has the developer app and the privacy approval. Then build only "import a frame as an image/PDF/SVG by link", not a node-tree mapper.
Cost of changing: about 3 to 4 weeks after unblock, one table, one OAuth route, one ADR-14 amendment, ongoing maintenance.

#### 7.3 Canva Connect proposal

Facts: Canva Connect exposes an export job (create, poll, download) after OAuth (analysis; format list from Canva's docs to verify). A Canva user can already download PDF/PNG/SVG-class exports manually, which the existing import accepts (Canva PDFs are named in the analysis as a main use case of Phase 2 (item 2-4)).
Design if approved: the same shape as Figma (integration folder, OAuth with PKCE as Canva's docs require, encrypted tokens, allowlisted download host, job polling with a server-side timeout and no long-lived function, zod, audit, errors).
Risks beyond Figma's: possible Canva review for third-party use (unverified), job polling inside serverless time limits (needs a design: client-driven polling of a short status endpoint instead of a long function), export links expiring, brand-template and design-id mapping.
**Recommendation: do not build the Canva integration.** The manual export (PDF) already imports through Phase 2 (item 2-4) and the value of the API is one fewer download. Revisit only with demonstrated demand and after the Figma decision, since both would share the same OAuth and token infrastructure; building the shared infrastructure for one of them first is the cheaper order if the owner wants either.
Cost of changing: about 3 to 4 weeks after unblock plus the review uncertainty.

#### Acceptance criteria (Phase 7)

1. The decision-record document (or the 8h subsection) exists, is English, has one recommendation per item, the checklist 7.0 with unchecked boxes and no invented registry values, and `npm run check:docs` passes.
2. An EPS file (both signatures) is refused with the pt-BR hint and no decoder is loaded (test); no `eps`, `figma`, `canva` value exists in enums, error codes, actions or audit actions (grep returns nothing).
3. No file in the repo contains a credential, client id, secret or token for these services (secret scan hook, `grep` of the names only in docs as variable names).
4. standards-reviewer confirms DOC-3 (one document per topic) and DOC-5 (open decisions with a recommendation).

#### Verification commands

`npm run check:docs`, `npm run check:consistency`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run test` (for 7-2 only). Nothing else is meaningful: no live call to Figma, Canva or Ghostscript is possible or permitted here, and none will be claimed.

#### Security notes

No credentials are requested from the user in chat or files; the owner places them in the deployment secret store. Third-party URLs returned by APIs are untrusted (SSRF): host allowlist, https only, no redirects off the list, byte cap while streaming, no internal address resolution. Tokens: encrypted at rest, scoped minimal, revocable, never in logs or audit metadata beyond ids (SEC-12). Prompt-injection note: layer names and text pulled from third-party files are untrusted data, never instructions, when they later reach any AI feature. EPS recommended refusal removes the largest parser attack surface (PostScript interpreter) from the product.

#### Test scenarios

EPS: `%!PS-Adobe-3.0 EPSF-3.0` text, DOS EPS binary header, a PDF renamed `.eps` (sniff wins, imports as PDF or refuses by the extension rule: test the extension-mismatch message), a 0-byte `.eps`, an `.eps` that is actually a PNG. Documents: link check, registry grep for forbidden names. Hostile inputs for the future integrations (to be written at unblock, listed now so the design accounts for them): render URL on an internal IP, redirect to another host, response larger than the cap, content type not matching, expired token, revoked token, replayed OAuth state, callback with a foreign state, token present in an error message.

#### Risks

| Risk | Mitigation |
|---|---|
| Scope creep: stakeholders read Phase 7 as promised work | The phase title and every section say proposal, recommendation is "do not build" for all three |
| Registry pollution by speculative names | Rule: no value without a handler; proposed names live only in the proposal document |
| Legal blockers unnoticed | Checklist 7.0 is a gate; implementation tasks cannot be created while a box is open |
| Vendor changes (Figma, Canva APIs and plans) | Verify docs at implementation time; do not freeze this text as fact |

#### Blocked or needs the user

Everything functional in this phase is blocked by design: Figma and Canva developer apps and privacy approval; counsel for AGPL Ghostscript (and LGPL libheif, HEVC patents for 6b); infrastructure and ADR-14 amendment if any server work is ever wanted; real-account validation of OAuth flows (impossible without owner credentials, and not simulated).

#### Open decisions

| Id | Question | Recommendation |
|---|---|---|
| 7.D1 | EPS | Not supported; refuse with an "export as PDF" hint |
| 7.D2 | Figma API | Not now; document manual export (PDF or SVG); reopen on demand after Phase 5 |
| 7.D3 | Canva Connect | Not now; manual PDF export already works |
| 7.D4 | Where the proposal text lives | New `docs/modules/design-import-integrations.md` only if the user confirms the new document (DOC-3); otherwise a subsection of image-editor 8h |
| 7.D5 | Token key for any future integration | Separate key per integration, kept in the deployment secret store, name registered first |

---

### Cross-phase notes

#### Order and parallelism

Phase 5 (5-0, 5-S1, 5-S2 in parallel) then 5-1, 5-2, 5-3 (sequential on the document model), 5-4 and 5-6 in parallel, then 5-7, 5-8, 5-9. Phase 6a, 6b, 6c are independent of Phase 5 except that 6c-3 edits the PSD/TIFF/image handlers that earlier phases own (serialize that edit; registry and `use-import-place.ts` are closed files after Phase 0 per the Phase A collision rules, so Phase 5 touching `use-import-place.ts` is a documented exception to be coordinated with the Phase 0 owner). Phase 7 documents can be written any time after Phase A.

#### Review gates (same rules as plan section 3)

standards-reviewer before code (docs-first order and registry coverage) and after; test-reviewer on tests written by test-engineer; security-analyst mandatory for 5, 6a, 6b, 6c; data-integrity-auditor mandatory for 5-2; code-reviewer after tests are green; ux-ui-designer and design-review for the path properties panel and the notes wording; check `lost-ui` before building any panel or dialog (CLAUDE.md item 10).

#### Effort (rough developer-weeks, estimates not measurements)

Phase 5: 4 to 6 (SVG about 2.5, AI/PDF about 2 with a real chance of being cut at 5-10, migration and consumers about 1.5). Phase 6a: 1 to 2 (up to 3 if an own renderer is needed). 6b: 1.5 to 2 after sign-off (0.5 for native-only). 6c: 3 to 4 including the spike, with a real chance that the spike ends the work. Phase 7: 0.5 for the document and the EPS hint.

#### What cannot be validated without real devices or accounts

Visual fidelity of vector import and CMYK conversion (needs human comparison and owner references), Safari/Firefox/iOS worker, memory and native HEIC behavior, production CSP behavior for the Lottie no-eval check, network-silence proofs of SVG/PDF import (need a real browser request log), Figma and Canva OAuth flows and API behavior (need owner developer apps and accounts), any legal conclusion. These are reported as "not tested" in each phase's Implementation status (DOC-2, GOLD-6).

## Implementation status

**Phase A (2026-11-18): documents and registries written, no code (this block records the state at the end of Phase A). A-10 (security review) done; no record of an A-11 re-gate exists in the documents.** Phase 0 was done afterwards (see "Phase 0" below). Phases 1 to 7 are not started; the next phase is Phase 1, docs first (item 1-1).

Files changed: `docs/modules/image-editor.md` (sections 3, 4.3, 4.4, 7b, 8g pointers, new 8h, Implementation status), `docs/reference/enums.md`, `docs/reference/error-codes.md`, `docs/standards/ui-glossary.md`, `docs/standards/base.md` (section 2, row "Result and errors"), `docs/technical-architecture-v0.1.md` (stack rows, ADR-14 note), `docs/spaces/media-library.md` (section 7), this plan, `docs/README.md` and `docs/modules/README.md` (links). No `src/`, `supabase/` or `package*.json` file was touched.

Baseline: none was taken before editing. The only baseline is the Phase 0 spike (0-1) on the code at `e65bc90`: `lint`, `typecheck`, `format:check`, `test` (70 files, 700 tests) and `check:consistency` all passed; `npm audit` and `build` were not run.

Validation performed after the fix round (2026-11-18), real output:

```
npm run check:docs
Docs consistent: links, error codes, actions, audit actions and notification kinds.

npm run check:consistency
check:consistency OK: 63 actions, 87 raised error codes, 104 audit actions, 31 CHECK lists.

npm run format:check
Checking formatting...
All matched files use Prettier code style!

git diff --stat
 docs/README.md                      |   2 +-
 docs/modules/README.md              |   1 +
 docs/modules/image-editor.md        | 113 ++++++++++++++++++++++++++++++++----
 docs/reference/enums.md             |   4 +-
 docs/reference/error-codes.md       |   4 +-
 docs/spaces/media-library.md        |   2 +-
 docs/standards/base.md              |   2 +-
 docs/standards/ui-glossary.md       |   5 +-
 docs/technical-architecture-v0.1.md |   4 +-
 9 files changed, 120 insertions(+), 17 deletions(-)
```

Phase 0: see the status tables in section 2 of this plan (items, deviations, acceptance criteria) and the single Phase 0 entry of [image-editor.md](image-editor.md) Implementation status.

This plan file is untracked, so `git diff --stat` does not list it. Not applicable: lint, typecheck, test, db commands (no code or SQL).

Not done or not verified:

- A-11 (standards-reviewer gate): no record of the re-gate exists in the documents; Phase 0 went ahead on the owner's delegation of 2026-11-18.
- The wording of the rules listed once under the 8h.2 table (R1, R2, R5, R6, R12) was rebuilt from this plan because the original rule text was not in the repository; the owner should read it once. R4 and A5 (storage path) are "Proposed, awaiting" the Phase 3 threat model and the SEC-7 change; R7 is blocked and Proposed.
- Decisions A-D5 and the others rest on the owner's instruction of 2026-11-18 to accept what a review agent recommends; A-D5 is revertible on owner veto.
- The document version 4 of R11 (plan 5.D2) is still "Proposed, awaiting decision".
- The registries named values that the code got only in Phase 0; since Phase 0 item 0-17 they match the code (`enums.md`, `ui-glossary.md`, checked by `glossary-sync.test.ts`).
- The pdf.js and ag-psd option names come from the Phase 0 spike (pdfjs-dist 6.5.438, ag-psd 34.2.1) and are in the code since Phase 0; `npm audit`, bundle sizes (item 0-16, stale) and real worker behavior are unverified.

Phase 0 validation (2026-11-18, real output; details in the module entry): lint, typecheck and format:check clean; `npm run test` 93 files, 968 tests passed (twice by the test-engineer, once by the developer); check:consistency and check:docs passed. NOT run, by owner decision (CLAUDE.md item 11, base.md section 11): `npm run build` and e2e (none written); the chunk sizes of item 0-16 were measured once before that decision and not re-measured. NOT done: manual browser matrix, real devices, `npm audit`, mutation testing, items 0-13 and 0-18. NOT proven: module-worker bundling, `ImageData` in the worker, real peak memory, `destroy` during render, EXIF agreement with the real decoder, network log, jsonb surrogate refusal, abandoned image decode after a timeout, real ag-psd composite fallback, owner fixtures (B2).
