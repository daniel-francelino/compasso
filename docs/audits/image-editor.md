# Audit: Image editor (Photoshop-like scope)

Date of the snapshot: 2026-11-18. Scope: the working tree after phases P1 to P5b2 of [../modules/image-editor.md](../modules/image-editor.md) (design editor, raster core, painting, pixel persistence, migration `20261118100000`). Method: four independent read-only reviews (code review R, security S, standards C, parity research G). Nothing was ever run in a browser; the numbers come from the commands listed in section 6.

## 1. Summary

| Requirement | Status | Evidence |
|---|---|---|
| Tenant isolation of design and media data | 🟡 | RLS unchanged; hidden is a display flag only (S6); `design_assert_media` misses status checks (S4) |
| Storage and quota protection | ❌ | Hidden pixel versions pile up and count in the quota (S1, S2, S8) |
| Pixel history and timeline correctness | ❌ | Desync after budget eviction (R1), undo during a stroke (R5) |
| Memory and render performance | ❌ | R2, R3, R7 |
| Compositing correctness | ❌ | Z-order with adjustments (R4) |
| Permission consistency for painting | 🟡 | Paint gated by `design.update`, flush needs `media.upload` (R6) |
| Documents match the code | 🟡 | C1, C2, C4, C5 (fixed in this change, see section 5) |
| Lint, typecheck, consistency, format, build | ✅ | All pass today |
| Tests | 🟡 | 584 tests in 56 files pass; `raster/pipeline.test.ts` timing bound is flaky (R18); pgTAP not rerun after P5b2 |
| Feature parity with a raster editor | 🟡 | Matrix in section 3 (G) |

## 2. What is right (keep)

- Pure, DOM-free raster core with Vitest (blend math, pipeline, selection, brush, tiles).
- One unified timeline with markers over the document history (invariant tested in `timeline.test.ts`).
- Pixel files go through the normal upload path (`requestUpload`/`confirmUpload`), keys stay opaque, no signed URL stored.
- Document version 3 validated in SQL and zod; `design_save_version` registers pixel and mask files in `media_usages`.
- Migration `20261118100000` was applied to the production project on 2026-11-18 by explicit owner instruction and `database.types.ts` was regenerated. The earlier statement that it was not pushed is outdated.
- Photoshop key table in one place; every command has a menu item.

## 3. Findings

Hypotheses are marked.

### Security

| ID | Severity | Evidence, risk | Recommendation |
|---|---|---|---|
| S1 | High | A flush every 8 s adds a hidden version; no purge; versions count in the organisation quota (`media_storage_used`), are invisible in `listMedia`, and `media_delete_permanently` refuses assets in `media_usages`. A collaborator can exhaust the organisation quota | Flush less often (save, version, export, 60 s idle); purge non-current unreferenced hidden versions in SQL; cap per design; show hidden usage |
| S2 | High | Users without `media.update` create a new hidden asset on every flush (`reuseAssets` is gated by `Media.Update`; the asset map is a `useRef`). Every layer file is named `camada-<8 hex>.png`, so the name-dedup loop in `media_request_upload` becomes O(n^2) | Let `design.update` add versions to hidden assets created by the actor, or use unique names for hidden assets; never fall back to a new asset on a non-transient error |
| S3 | Medium | Pixel versions referenced only by a draft are not in `media_usages`; `media_delete_permanently` and `set_trashed` can remove them | Block deletion of hidden assets outside the design flow or check draft references; audit it |
| S4 | Low | `design_assert_media` does not check `status = available` or `trashed_at is null` | Add both checks |
| S5 | Low | Migrations 20261027 and 20261118 restored the quota default 5120 where 20261019 had 10240 (drift) | Decide the value, fix in a new migration |
| S6 | Low | `hidden` is a display flag only (RLS unchanged, same-brand visibility) | Documented; decide whether hidden assets may be shared or published |
| S7 | Low | No audit for hidden creation or removal | Decide and register an audit action if needed |
| S8 | Low | No total pixel budget per document in zod or SQL (self and same-brand DoS) | Add a budget |
| S9 | Low | `signMedia` batch cap is 60 ids against up to 200 elements; signing needs `media.view` | Check `useSignedUrls` splitting; document the permission |

### Code review

| ID | Severity | Evidence, risk | Recommendation |
|---|---|---|---|
| R1 | High | Pixel history and document timeline desync after budget eviction (`pixel-history.ts` evicts, `use-pixel-history.ts` maps by position); redo applies the wrong patch | Key pixel steps to timeline entries by id; truncate or mark non-undoable on eviction; test with a small budget |
| R2 | High | `RasterStore.release` is never called in production; deleted or replaced layers never free memory; the canvas cache doubles the per-layer cost; `bufferToCanvas` copies | Release when no history references; count the canvas cache |
| R3 | High | `renderStack` allocates page-size canvases per raster layer per call with no cache and runs every frame during strokes when the page has adjustments; the eyedropper "Todas as camadas" recomputes the whole composite on every pointermove | Per-layer cache, dirty region, 1x1 sampling, throttle |
| R4 | High | With adjustments, all raster and adjustment layers draw as one image at the first stack position, so text, shapes and images between rasters render in the wrong z-order | Split into contiguous runs |
| R5 | Medium | Undo/redo during an active stroke corrupts the stroke's before snapshot | Ignore while a stroke is active |
| R6 | Medium | Flush needs `media.upload` but painting is gated by `design.update`; a designer without `media.upload` paints, the flush fails permanently and blocks leaving and saving | Gate paint tools on `Media.Upload` or provide a `design.update`-only path |
| R7 | Medium | `retargetHistory` rewrites the whole history; `flushSync` runs once per layer | Batch |
| R8 | Medium | The asset map is lost on reload, so each session leaks hidden assets | Store the asset id per layer or resolve it from the version |
| R9 | Medium | A 4096 px PNG can exceed `maxImageMb` or the quota; the error is generic | Specific message and size handling |
| R10 | Medium (hypothesis) | `[ ] { }` shortcuts with AltGr on ABNT2 keyboards may never fire | Test on ABNT2; add alternatives |
| R11 | Medium | Eyedropper "Todas as camadas" samples only raster and adjustment layers | Sample the real composite or label the option |
| R12 | Low | No `event.repeat` guard on X and D; X and D apply in every tool | Guard and scope |
| R13 | Low | Brush cursor hidden during Space-pan | Show it |
| R14 | Low | Non-uniform scale makes the cursor circular while the stroke is elliptical | Draw the cursor with the same scale |
| R15 | Low | History panel is read-only, labels "Alteração", index keys | Jump on click (P9), real labels, stable keys |
| R16 | Low | Color chips are below the 44 px touch target | Enlarge the hit area |
| R17 | Low | `rasterizeImage` re-implements brightness and contrast and starts from the Display variant | Reuse the pipeline; start from the original |
| R18 | Low | `raster/pipeline.test.ts` 512x512 benchmark is flaky (3119 ms against a 3000 ms bound under load) | Loosen or remove timing assertions |

### Standards

| ID | Severity | Evidence | Recommendation |
|---|---|---|---|
| C1 | Should fix | `image-editor.md` P5a and P5b1 limitation texts stale after B2 (session-only, visible library media, "masks stored but not rendered") | Fixed in this change |
| C2 | Should fix | Test counts in the docs (284) differ from the full run (584 tests in 56 files) | Fixed in this change |
| C3 | Minor | Unused exports `clampBrushOption`, `RasterPlacement` (`paint.ts`), `TIMELINE_DOCUMENT_LABEL` (`timeline.ts`) | Remove (CODE-11) |
| C4 | Minor | `media-library.md` does not mention hidden assets; `functions.md` row for `media_request_upload` lacks the `design.update` requirement | Fixed in this change |
| C5 | Minor | `getMedia` does not filter hidden | Intentional; documented in this change |

### Parity matrix (G)

| State | Features |
|---|---|
| Done | Move, align, group, snap; 16 blend modes |
| Partial | Workspace; brush, eraser, eyedropper (no pressure, presets, shift-line); layers (no thumbnails, no group tree UI, no clipping toggle); free transform; text (no underline, tracking, stroke); shapes (no stroke); history (read-only); rulers (no guides); export (PNG and JPEG only) |
| Pure library only, not wired | Pixel selections (marquee, lasso, wand, marching ants); fill and gradient; filters; adjustment layers UI (the pipeline renders adjustment elements, nothing creates them); mask creation (the pipeline multiplies a mask, nothing creates one) |
| Missing | Clone, heal, dodge, burn, smudge; crop tool; layer styles; copy and paste; pen tool; PSD; automation; smart objects |

## 4. Plan

1. Documents (C1, C2, C4, C5, this audit): done in this change.
2. New migration, local first: purge policy, `design.update` versioning of hidden assets, per-design cap, status checks in `design_assert_media`, quota default (S1 to S5, S8).
3. P6 Hardening: R1 to R6, R8 to R12, S9, tests, flaky benchmark (R18), C3.
4. Z-order and unified timeline fixed before any new feature (R1, R4).
5. P7 Selections, P8 Fill/gradient/adjustments/clipping/thumbnails, P9 Transform/crop/History jump/copy-paste, P10 Masks, P11 Filters and extras (see image-editor 7b).
6. Rerun pgTAP (`db:verify`, then `supabase test db`) after the migration.

### Review findings after P5b to P11 (2026-11-18)

| ID | Severity | Evidence | Status |
|---|---|---|---|
| N1 | High | In-memory paste shared one `PixelBuffer` between layers | fixed: `insert` clones |
| N2 | High | Pixel history eviction desynced the unified timeline | fixed: `PixelSteps.undo/redo` report success, undo/redo/jump stop at a step that cannot be reverted, `trimLostPixelSteps` drops older document history |
| N3 | Medium | A second mask overwrote the buffer needed to undo "Excluir máscara" | fixed: replacing a leftover mask buffer is recorded as a pixel step (`recordReplace`); only a size change stays unrestorable |
| N4 | Medium | Cancelling a free transform could restore a stale `pixelsVersionId` | fixed: `setPixelsVersions` retargets the transform base too |
| N5 | Medium | "Camada via recorte" cleared before insert | fixed: pre-check before clearing; still two undo steps |
| N6 | Low | Filter dialog stuck on early returns, no `onmessageerror`, cancel by message, no `logError` | fixed: `FilterCancelledError`, `logError` |
| N7 | Low | Run-canvas cache kept entries of the same owner under other keys | fixed in `storeRun` |
| N8 | Medium | Pixel, mask and paste decode without limits | fixed: side, element size, `canAllocate`, 25 MB paste cap, `ImageBitmap` closed in `finally` |
| N9 | Medium | Server: purge ignored other drafts; no size cap on raster refs; hidden version on trashed asset or archived brand | fixed in migration `20261118300000_design_hidden_hardening.sql` (local, not pushed) |
| N10 | Low | Duplicated `ToggleButton`, `fillKey`/`toneKey` | fixed |

## 5. Status of each finding

| ID | Status |
|---|---|
| S1, S2 | client part fixed (2026-11-18, not seen in a browser); SQL part open |
| S1 | fixed in migration `20261118200000_design_hidden_storage.sql` (local, not pushed): `design_purge_hidden_versions` and a cap of 300 live hidden versions per user and brand (`hidden_limit_reached`); the client call is pending |
| S2 | fixed in the same migration: `design.update` adds versions to hidden assets created by the caller |
| S3 | fixed in the same migration: trashing or deleting a hidden asset referenced by a draft (or used by a saved version, for trashing) is refused with `media_in_use`; `media.hidden_removed` audit |
| S4 | fixed in the same migration (`available` and not trashed) |
| S5 | fixed in the same migration: default quota 10240 MB, as documented in media-library.md (the documents agreed; the functions had drifted) |
| S6 to S9 | open (S6 verified accurate in media-library.md) |
| R1, R5, R6, R7, R9, R10, R12, R13, R16, R18 | fixed (2026-11-18, not seen in a browser) |
| R8, R14 | deferred (no schema field for the asset id; cursor ellipse) |
| R2, R3, R4, R11 | fixed (2026-11-18, not seen in a browser) |
| R15, R17 | open |
| C1, C2, C4, C5 | fixed in this change (documents) |
| C3 | fixed (2026-11-18, not seen in a browser) |

## 6. Limits of this audit

- Read-only reviews of the working tree; nothing was run in a browser; no visual, performance or memory measurement.
- Run on the snapshot date: Vitest 584 tests in 56 files passing; lint, typecheck, `check:consistency`, `format:check` and `vite build` pass; `check:docs` fails only on the pre-existing `../CLAUDE.md` link (root `CLAUDE.md` missing). pgTAP was run by the P4 agent via `db:verify` (1310 assertions, 0 failures) but not after P5b2.
- No round trip with the real database or R2 was exercised; S1, S2 and S3 come from reading the SQL and code.
- R10 is a hypothesis.
