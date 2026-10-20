# Content publication and storage clean-up

> **Status: decided on 2026-10-20 (P1 to P4); first delivery implemented and applied to the linked project, see section 12.** It adds a `published` editorial state to a content and a manual clean-up that keeps only the previews of what was published, to save storage. It also records how the previews learn the real size of the files and what is and is not verified about each platform's accepted ratios. It extends [content.md](content.md), [approvals.md](approvals.md) and [../spaces/media-library.md](../spaces/media-library.md); it does not replace them. Names below are proposals: per GOLD-4 they enter the registries ([../reference/README.md](../reference/README.md)) in the same change that implements them.

## 1. Objective

1. Let the team say "this content went out" at the content level, not only per channel row, so the work has a clear end (`published`).
2. When that happens, **free the storage** that production left behind (planning files, art files, files of old versions) and keep **only the preview** of what was published.
3. Give the internal screens the same file size the portal already receives, so the team sees the post as the client saw it (end of the 4:5 fixed frame on the editor and the internal approval screen).

## 2. Where we are today

| Topic | Today |
|---|---|
| Editorial status | Ends at `approved` ([content.md](content.md), statuses and transitions). `cancelled` is the other end |
| Publication | Per channel row: `unplanned → planned → published_manually`, recorded by `content.publish_manual` only when the content is `approved`. The content itself never becomes "published" |
| Files kept per content | Planning images (`plan_media`, and the media of each plan version); art files (`working_media`, and the media of each art version); every version of an asset (`media_versions`: original `storage_key`, `thumb_key`, `display_key`) |
| Protection | A version used by a revision cannot be deleted or overwritten (`restrict` foreign key; media-library and r2-storage rules). Versions and their media rows are immutable by trigger (DATA-6) |
| Reopening | `approved → in_production` is refused once any channel row is published |
| Previews | The thumbnail and the display copy are generated in the browser at upload (2 MiB cap each); a video has a cover (poster) generated in the browser |

## 3. The `published` state

| Item | Proposal |
|---|---|
| Status | `EditorialStatus.Published` = `published`, UI label "Publicado" (added to the `CHECK`, the constant, `enums.md`, the label map and the status badge together, DATA-8) |
| Transition | `approved → published`, **manual only**, by a person with a new action (the existing `content.publish_manual`, button "Marcar como publicado"); nothing sets it automatically, not even when every channel row is published |
| Precondition | Every channel row that is not `cancelled` is `published_manually` (error code proposal `channels_not_published`). See decision P1 |
| Terminal | After `published` the content is read-only: no new version, no reopening (`content.reopen` is already refused once a row is published; this makes it explicit), no new files |
| Clean-up | The same transaction records the event and enqueues the clean-up of section 4 (decision P2) |
| Audit | One event in `audit_events` through `audit_write` (`content.published`, metadata: ids and the number of files queued, SEC-12); the removal itself is not a separate audit event |
| Board and calendar | A new "Publicado" column on the board; the calendar already shows published rows, no change |
| Portal | The client sees "Publicado" in the decisions list; the previews remain (section 4) |

## 4. What the clean-up keeps and removes

**Keep, always:** the database rows (content, channel rows, versions, revision media rows, decisions, comments, audit). GOLD-8 stays true: history is preserved; only heavy **objects in the bucket** are removed.

**Keep as "the preview of what was published":** for each file of the **approved art version**, the **display copy** and the **thumbnail** (`display_key`, `thumb_key`); for a video, its **cover**. The preview screens keep working from these.

**Remove (objects only):**

| Object | Rule |
|---|---|
| Originals (`storage_key`) of the art files | Removed |
| Files of the planning stage (images of the plan versions) | Removed, including their display copies and thumbnails (the plan is context, not the post) |
| Files of art versions that were superseded or got changes requested | Removed completely |
| Videos | The original video is removed **only after** its reduced copy exists (decision P3); the cover stays too |
| Evidence files of manual publication | **Kept** (they prove the publication) |

**Never remove a version that something else uses.** Library files are shared: another content, the site (public derivatives) or a collection may use the same asset. The clean-up removes an object only when the **only** usages of that version are this content's revisions (decision P4). Otherwise it is skipped and reported ("N arquivos mantidos porque estão em uso em outro lugar").

**Data change needed** (migration, DATA-12): `media_versions` gets a purge marker (proposal `original_purged_at timestamptz`); `storage_key` stays (the row keeps pointing at the key, the object is gone) so the `restrict` foreign keys and the immutable triggers are untouched; the storage quota (`media_storage_used()`) ignores purged originals; the signed-URL functions refuse a purged original with a clear error (proposal code `file_purged`, "O arquivo original foi removido depois da publicação."). Revision media rows are **not** edited (they stay immutable); only the media version gets the marker, through one `security definer` function (proposal `purge_content_media(p_item)`), never an update from the client.

**Irreversible.** The confirmation dialog says so before it runs: "Depois de marcar como publicado, os originais e os arquivos do planejamento são apagados. Ficam só as prévias. Não dá para desfazer." Downloading the original is no longer possible; the library shows the file as "Original removido".

**Reduced video copy (decision P3).** A new derivative key on `media_versions` (proposal `preview_video_key`) holds an MP4 (H.264 when the browser can encode it, otherwise WebM) of at most 720 px on the long side and about 1.5 Mbit/s, capped at 25 MiB, validated by the server like the other derivatives (content and size). It is produced in the browser when the person confirms "Marcar como publicado" (a progress bar shows it; encoding runs close to real time, so a one-minute video takes about a minute) and uploaded through the same presigned flow. If the browser cannot encode, the video keeps its original and the dialog says so. This step is delivered after the first one (section 11).

## 5. Reading the preview after the clean-up

Impact analysis (2026-10-20). Every place that signs a file for a preview asked for `display_key ?? storage_key`, so a purged original would have produced a signed URL for a missing object. What changed:

| Where | Before | Now |
|---|---|---|
| `portal_media_urls` (portal approval, list cards, calendar entry) | Returned `storage_key` always | Returns `storage_key` as `null` once the original is purged (migration `20261020150000_purged_originals_fallback.sql`); the preview keeps working from `display_key` |
| `signPortalMedia`, `signPortalPreviewMedia` | Fell back to the original | Ignore a `null` key; no URL for that file |
| `getMedia` and `signMedia` (library, editor, internal approval) | Used `storage_key` when the display copy was missing | Treat a purged original as absent: no preview fallback to it and no download link (the "Baixar" button is hidden) |
| `publish_content` | Queued every candidate | A version kept as preview is queued only if it **has a display copy**; otherwise its original stays (it is the only copy) |
| Preview components (`ChannelPreview`, `RevisionView`, portal request card, portal calendar entry, editor) | A missing URL showed the loading skeleton for ever | `PreviewMedia.unavailable` (from `mediaUnavailable(urls, id)`, true when the URLs loaded and this file has none) shows "Prévia indisponível" |

What the client sees after a publication: the art keeps its preview (display copy), the planning images of the old plan version show "Prévia indisponível", and "Abrir arquivo" on an original has nothing to open. A published content does not allow "Abrir arquivo" on the original; the button is replaced by "Ver prévia" (not built: the original button simply has no URL for now).

Not covered: the public share link (`public-share.functions.ts`) still builds its download from `storage_key`; a purged version is never shared in practice (versions in use elsewhere are not purged), but the case is untested.

## 6. Real file size on every preview (internal screens)

Today only the portal passes `width` and `height` of the first file to the shared preview, so on Instagram "Post" and "Carrossel" the frame follows the real ratio there but the editor and the internal approval screen still show 4:5.

Proposal: add `width` and `height` to the file DTOs the team receives (`FileItem` in the editor, the revision media of the internal approval detail, the portal calendar entry) by reading them from `media_versions` in the same queries. No new column: `media_versions` already stores width and height. The shared `PreviewMedia` already accepts them. Acceptance: the same content shows the same frame in the editor, the internal detail and the portal.

## 7. Accepted ratios per platform (what is verified)

`previewFrameRatio` clamps the first file's ratio to a per-platform range. Today only Instagram has a range.

| Platform | Frame today | What is known | Verified? |
|---|---|---|---|
| Instagram feed (Post, Carrossel) | Real ratio, clamped to 4:5 … 1.91:1 | Most 2026 size guides give 1.91:1 (landscape) to 4:5 (portrait); some say the feed also accepts 3:4 since 2025; guides disagree on whether out-of-range images are cropped or get borders | **Not verified against Meta's own pages.** The 4:5 … 1.91:1 range is the consensus of third-party guides ([Metricool](https://metricool.com/instagram-image-size/), [Inro](https://www.inro.social/blog/instagram-post-size), [Postfa.st](https://postfa.st/sizes/instagram/feed)) |
| X | Fixed frame | 1:1 and 1.91:1 appear in a guide as in-feed sizes | **No.** Single third-party source ([Buffer](https://buffer.com/resources/social-media-image-sizes/)) |
| Facebook, LinkedIn, Threads | Fixed frame | No feed range found; the sources only give common sizes and link-preview sizes | **No** |

Decision P5: keep the fixed frames for every platform except Instagram until someone checks each platform's **official** help page and records the link and the date here. Until then no new range is added (a wrong range would make the client see a post differently from the real one). When checked, the range goes into `FEED_RATIO_RANGES` in `src/lib/shared/preview/platforms.ts` with a test, and this table is updated in place.

## 8. Rules touched (what changes if this is accepted)

| Rule or document | Effect | Cost |
|---|---|---|
| GOLD-8, DATA-6 (history preserved, revisions immutable) | Kept: rows and decisions stay, revision media rows are not edited. What changes is that a **file object** can disappear after publication | Wording in [content.md](content.md) and [../spaces/media-library.md](../spaces/media-library.md): "a file used by an approved revision cannot be permanently deleted" becomes "its **original** can be purged after the content is published" |
| [../spaces/r2-storage.md](../spaces/r2-storage.md) rule 4 (`remove` never for files referenced by approved revisions) | One explicit exception: the purge function, after `published` | The storage interface gets no new method; the purge uses `remove` on the keys the function returns |
| Content status list | One new status and one transition | `CHECK`, constant, labels, badge, board column, tests |
| Permissions | None new: the existing `content.publish_manual` covers it | Documented only |

## 9. Acceptance criteria

- [ ] "Marcar como publicado" appears only for an `approved` content whose non-cancelled channel rows are all published, only to people with the action.
- [ ] After it, the content is `published`, read-only, and cannot be reopened.
- [ ] The originals and the planning files of that content are gone from the bucket; the display copies, thumbnails and video covers of the approved art remain and still render in the portal and the internal screens.
- [ ] A version used by another content, the site or a collection is **not** purged, and the result says how many were kept.
- [ ] Requesting a purged original returns `file_purged` and never a signed URL.
- [ ] The storage bar drops by the removed bytes; reconciliation ("Verificar com o bucket") does not report the purged objects as missing.
- [ ] One audit event per publication and one per clean-up, with ids and counts only.
- [ ] An external user of brand B cannot see or trigger anything of brand A; `anon` cannot call the functions (pgTAP).
- [ ] The editor, the internal approval screen and the portal show the same frame for the same content.

## 10. Open decisions (with a recommendation)

| ID | Question | Recommendation |
|---|---|---|
| P1 | May the person mark as published while some channel rows are still not published? | **Decided 2026-10-20: no.** Every non-cancelled row must be published (`channels_not_published`) |
| P2 | Clean up in the same click or later? | **Decided 2026-10-20: a job, if it fits the free plans.** It fits: the transaction marks the content and the files as pending; the server function tries the removal right after the commit (best effort, no new infrastructure) and the **existing daily Vercel Cron route** (Hobby allows one run a day, the project already has `/api/cron/due-notifications`) retries whatever is still pending. No queue, no Supabase function, no paid service |
| P3 | Keep the original video? | **Decided 2026-10-20: keep a reduced-quality video, not only the cover.** Neither free plan runs a transcoder (no ffmpeg on Vercel Hobby functions, none on Supabase free), so the reduction happens **in the browser** of the person who publishes (re-encode at a lower resolution and bitrate, then upload as the preview copy, the same way thumbnails and covers are already produced in the browser). Until a video has that reduced copy its original is **not** purged and the result reports it (section 4). Target size and format are in section 4 |
| P4 | Purge an asset used elsewhere? | Never. Skip it and report it (section 4) |
| P5 | Per-platform ranges | Verify with official pages before adding (section 7) |
| P6 | Offer a "download everything before publishing" shortcut? | Yes, as a later improvement; not needed for the first delivery |

## 11. Plan (small steps, each with its documents)

1. Decisions P1 to P4 are made (this document updated). The action name and the new names enter `enums.md`, the catalog of actions, `functions.md`, `error-codes.md` and `audit.md` in the change that implements them.
2. Migration: status and transition, `original_purged_at`, `purge_content_media`, the `published` function (`publish_content`), audit actions, error codes; pgTAP.
3. Server functions, route guard, `nav-config` if needed, board column, dialog, badge, glossary copy.
4. Removal of the objects (best effort after the commit plus the daily cron retry), quota and reconciliation adjustments.
4b. Reduced video copy in the browser (P3); until then videos keep their original.
5. Width and height in the internal DTOs (section 6).
6. Official-source check of the platform ranges (section 7), then the ranges and tests.

## 12. Implementation status

2026-10-20, first delivery (steps 1 to 4 of section 11, without 4b). Migration `20261020140000_content_published.sql` (status and transition, `publish_content`, `media_purge_pending`, `media_purge_confirm`, purge columns on `media_versions`, adjusted `content_item_save`, `content_item_is_ready`, `dashboard_attention`, `media_storage_used`, `media_storage_keys`, `content.published` in `audit_write`); TS: `EditorialStatus.Published`, label "Publicado", status style, transitions, board column, `AuditAction.Content.Published`, error `channels_not_published`, `publishContent`, `purgePublishedMedia`, the cron route, the editor button and confirmation, the banner. Documents: registries (`enums`, `data-model`, `functions`, `error-codes`), `audit.md`, `content.md`.

Differences from the proposal: the action is the existing `content.publish_manual` (no new action); there is no `content.media_purged` event; videos are **not** purged yet (step 4b pending); the removal runs right after the commit and again in the existing daily `media-cleanup` cron (no new cron).

Validation performed: `npm run db:verify` (917 assertions, 0 failures; 17 new in `supabase/tests/21_content_published.test.sql`: refused while a channel is unpublished, stale version, queueing and `purge_keep_preview`, pending and confirmation, storage drop, audit, no second publication, no reopening, no edits, external user and `anon` refused), typecheck, ESLint, Vitest, `check:consistency`, `check:docs`.

**Not done / not tested:** applying the migration to the linked project and `db:types -- --linked`; the removal from a real R2 bucket (`purgePublishedMedia` was not exercised); the reduced video copy; width and height on the internal DTOs (section 6); the official-source check of the platform ratios (section 7); the screens in a browser; the `file_purged` error of section 4 is **not** implemented: the fallback of section 5 returns no URL instead of an error.
