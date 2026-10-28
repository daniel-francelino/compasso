# Module — Media Library

> A cross-cutting module that centralizes the files of Aura Creative (images, videos and documents) and gives every page a reusable picker. It serves the Site and CMS space, Marketing Management (brands, content revisions) and, read-only and through signed URLs, the client portal. Storage is described in [r2-storage.md](r2-storage.md). The patterns (asset/version/usage, immutable versions, upload sessions, shared picker, quota) come from the Memoria Print media library; scopes, usages and permissions are Aura Creative's own. UI label: "Biblioteca de Mídia". Route: `/admin/library`. UI texts are Brazilian Portuguese; everything else is English.

## 1. Goal and scope

Upload, organize, find and reuse images, videos and documents without repeating uploads in every module. A brand logo can be used by the brand identity, by several content revisions and by a case study on the site; a carousel image can be reused in another revision, always with the right access for each context.

Included: standalone library, upload, preview, search, tags, collections, contextual selection, usages, versions and a "where it is used" view, explicit publishing of public derivatives for the site.

Not included in the MVP: advanced image/video editing, AI image generation, automatic import by URL, synchronization with external services, video transcoding, upload by clients (decision pending), sharing by link with a password.

## 2. File, version and usage

| Concept | Meaning |
|---|---|
| Asset (`media_assets`) | Logical record: name, scope, tags, current version, trash status |
| Version (`media_versions`) | **Immutable** binary: opaque storage keys, checksum, MIME type, size, dimensions/duration, status |
| Usage (`media_usages`) | Association of a **concrete version** with a revision, a site page revision, a case study or a brand identity, with its own alternative text |
| Derivative | Thumbnail, display copy or video poster generated from the version (browser-generated, validated by the server) |
| Collection | Logical folder; organizes **references**, without duplicating bytes |

The same asset can be used in many places without duplicating the binary. Each usage keeps its own alternative text and caption: changing the alternative text in one revision does not change another's.

A **replacement creates a new version**; it never overwrites an object that is already in an approved revision. A revision that was sent or approved keeps pointing to the same version forever.

## 3. Scopes and visibility

| Scope | Meaning | Who can see it |
|---|---|---|
| `brand` | Material of one brand (logos, photos, videos, PDFs, evidence of publication) | Users with `media.view` and a link to that brand; external users **only** files referenced by a revision shared with them |
| `site` | Material of the public site (hero images, services, portfolio) | Users with `media.view` + `site.view` |
| `profile` | **Profile photos** of people (internal and external), one asset per photo, owned by one person (`media_assets.owner_id`). Decided 2026-10-24 | The owner always; users with `media.view` see them in the library under "Fotos de perfil", **read only**. Uploading needs no `media.upload`: any approved person uploads and removes their own photo from their profile page. Image only (JPEG, PNG, WebP), up to 5 MB, never shareable, never published, never moved to collections; library actions on these files are refused (`not_found`) |

- **Nothing becomes public by default.** Every upload is private. Only an explicit action (`media.publish`) copies an approved **derivative** (never the original) to the public bucket.
- A private file does not become public because it is selected in an editor. A brand file used in the portfolio requires explicit authorization of the case study (consent note and date).
- Thumbnails, search, counts, file names and the "Used in" list obey the same access rules; the interface never reveals names or counts of origins the person cannot access. A deletion blocked by references that are not visible shows only "O arquivo tem usos que impedem a exclusão".
- Brand scope is checked with the same function as everything else (`can_access_brand`); external users never browse the library.

## 4. Where files are used

| Origin | Usage | Rules |
|---|---|---|
| Content versions | Carousel images, videos, PDFs of a post | Order and alternative text per usage; the **exact versions** are frozen in the revision (`content_revision_media`) |
| Brand identity | Logos, guidelines, references | Brand scope; editable by those who can update the brand |
| Profile photo | Avatar of a person | Profile scope; set and removed only by the owner (`profile_set_avatar`); removing it moves the file to the trash |
| Publication evidence | Screenshot or file proving a manual publication | Linked to the channel row; kept as history |
| Site pages and case studies | Images and videos in sections | Site scope; published only through public derivatives |
| Social image (SEO) | Open Graph image of a page | Needs a published derivative |
| Comments (future) | Client attachments | Out of the MVP; never public or approved automatically |

Removing a file from a draft revision removes only the association. Approved revisions keep their references; a correction adds a new revision.

## 5. Shared picker

Every page uses the same selection component (`MediaPicker`), configured by context, accepted types, maximum quantity, single/multiple selection and usage role. Accepted types are filtered on the server before pagination, so compatible files remain discoverable across pages. The picker has loading, retry, empty and paginated states; cancelling clears its draft selection. The server validates these rules; it does not trust the configuration sent by the browser.

1. In the content editor choose "Adicionar arquivos".
2. A panel opens with "Biblioteca" and "Enviar arquivos", showing only accessible and compatible files (the brand's, or the site's).
3. Search, filter and select existing ones or upload new ones, without leaving the editor or losing unsaved changes.
4. Confirm the selection, set the order and alternative text.
5. Save to confirm the associations; return to the same position.

Cancelling the selection associates nothing. A completed upload and a saved association are different states: a file uploaded to the library can remain unused; an abandoned temporary upload is cleaned after the period below. Show progress per file, failures and the possibility of retrying only the failed ones. Do not report success of the form while a mandatory upload is incomplete.

## 6. Library screen and file record

Routes: `/admin/library` and `/admin/library/$assetId`; menu entry "Biblioteca de Mídia"; the Marketing and Site spaces also open it filtered by brand or by site.

- Grid/list with thumbnail, name, type, size, status and date; search by name/tag; type, scope, brand and sorting filters are grouped in the shared "Filtros" dropdown. Pagination, search and filters on the server.
- Record with preview, metadata, versions, tags, author and accessible usages. Files without preview have an icon and an authorized download action.
- Batch changes only for eligible files, indicating the ones that failed.
- Do not play audio/video automatically; keyboard control; reordering by buttons as well as dragging.
- A **storage bar** shows how much of the quota is used (warning at 80 %, alert at 95 %); "Verificar com o bucket" (`media.delete`) compares the bucket with the library: real total, unknown objects, records without an object and missing copies (read-only).

**Collections (folders)**: up to 3 levels, scoped to a brand or to the site. A collection is only a navigation label: moving a file does not change its identity, URLs or usages. The name is unique inside the same level (case-insensitive); a collection can only be deleted when empty (files are never deleted with it); creating and renaming require `media.update`, deleting requires `media.delete`, moving files (up to 200 at a time) requires `media.update`. Search covers the whole scope. Each upload creates a new asset, even if the same content already exists; repeated names get a number ("foto (1)").

### 6.1 Share links (decided 2026-10-19, same behavior as Memoria Print without virtual folders)

A person with `media.share` (and the brand link, or `site.view` for the site scope) can share **one file** or **one folder (collection)** by link, from the file card, the file record and the folder card. Everything is a secret URL, `/share/<token>`: the token has 64 random characters, is never listed to the public and the page is `noindex`.

| Option | Rule |
|---|---|
| Name and message | Required name (1 to 80), optional message (up to 500) shown to the visitor |
| Validity | Never, or a future date up to 10 years; an expired link answers `expired` |
| Password | Optional, 8 to 128 characters, stored as a bcrypt hash; the right password opens a 2-hour session (only the hash of the session code is stored); 5 wrong passwords lock the link for 15 minutes |
| Downloads | Optional limit (1 to 10 000); each download counts, and at the limit the link answers `exhausted`. "Only view" turns downloads off |
| File version | A file link pins the version it has when created (a later replacement does not change what was shared) unless "always the latest" is chosen |
| Folder | Includes the files of the subfolders (up to 4 levels, 500 files); trashed or unavailable files drop out |
| End | A link is revoked by hand (`revoked`, immediate, closes the password sessions) or ends by itself when the file or the folder is deleted (`target_deleted`) |
| History | `media_share_events` keeps created, updated, viewed, wrong password, downloaded and revoked; creating and revoking also go to the audit trail (`media.share_created`, `media.share_revoked`) |

Security: the three public functions are the only ones granted to `anon`; each one validates the secret, the status, the expiry, the lock, the limit and the password session **inside the function** and returns only what the link allows. Storage keys never leave the server: after the function accepts the request, the server signs a read URL of 5 minutes (view) or a download URL with the file name. A per-IP limit in memory (10 password attempts per 10 minutes) comes on top of the 5-attempts lock. Wrong secrets, revoked, expired and unavailable links answer with a generic state, never with the name of what was shared.

The library shows folders as cards above the files (breadcrumb trail, rename, delete and share in the card menu), file cards with a menu (details, download, share, move, trash), a "Compartilhado" mark on whatever has an active link, a preview dialog and the storage meter in a dialog opened by an icon button. The default quota is **10 GiB** (the free tier of R2), changed in the migration `20261019120000_media_quota_default.sql`.

## 7. Formats and limits

Initial values, configured centrally (`src/lib/shared/media/limits.ts` and environment) and validated on client and server:

| Type | Accepted formats | Limit per file | Handling |
|---|---|---|---|
| Image | JPEG, PNG, WebP | 25 MiB and 40 million pixels | Thumbnail and display copy generated in the browser; preserve ratio and transparency; strip EXIF/location from derivatives |
| Video | MP4, M4V, MOV (QuickTime, iPhone), 3GP, 3G2, WebM, MKV, AVI (decision 2026-10-27: open to as many video types as can be verified; MIME types `video/mp4`, `video/x-m4v`, `video/quicktime`, `video/3gpp`, `video/3gpp2`, `video/webm`, `video/x-matroska`, `video/x-msvideo`) | 100 MiB in the MVP | The type is resolved in the browser from `file.type` and, when that is empty or generic (common for files saved from WhatsApp or the iPhone), from the extension; the server checks the container signature (MP4/MOV family boxes, EBML for WebM/MKV, `RIFF…AVI `). The codec is **not** verified and there is no transcoding. The cover is generated in the browser when the browser can decode the file; when it cannot (for example HEVC from an iPhone in Chrome), the file is still stored, the card shows the film icon and the detail screen says the browser cannot play it and offers the original download. Instagram publishing still needs an MP4 (see [../modules/instagram-publishing.md](../modules/instagram-publishing.md)) |
| Document | PDF | 50 MiB | No thumbnail; preview in the record; validated by the `%PDF-` header and the `%%EOF`; never used as an image |

Every refusal names its cause in plain pt-BR (unsupported format with the detected extension, size above the limit with the file size and the limit, file not read, connection lost, upload link expired, storage refusal); the codes are in [../reference/error-codes.md](../reference/error-codes.md). Audio alone, SVG, HTML, executables, ZIP and editable design files are not accepted. Maximum of 10 files per upload operation (several batches allowed). Replaced versions count towards storage; do not delete them to get around history preservation.

A total quota and a per-user/period limit are configured before enabling production uploads. On reaching the quota, existing files are preserved and new uploads are refused with a clear message.

## 8. Upload and processing

Statuses: `pending` (uploading) → `processing` (validating) → `available`; or `failed`. Only available versions can be confirmed in associations.

- Create an authorized session, reserve quota and assign opaque keys **on the server**; never use the original name as a path.
- Verify size, real content, format/codec and decoding limits, not just extension or declared MIME ([r2-storage.md](r2-storage.md), section 5).
- Store checksum and technical metadata; generate derivatives without changing the original; remove location metadata from derivatives.
- Repeated attempts use the same idempotency key: do not create several assets or associations for the same command.
- Suggest reuse by checksum only inside the same authorized scope; never reveal that an identical file exists in another brand.
- Upload to storage and writing to the database are not a single transaction: use sessions, confirmation and compensating cleanup for orphans.

Temporary sessions expire after 24 hours without confirmation. Cleanup removes only temporary objects with no associations, no publication and no active processing, revalidating the status when removing. Files saved explicitly in the library are not deleted just because they are unused.

## 9. Versions, removal and deletion

- **Replace** creates a new version. A usage only moves to it with confirmation and permission over the origin; other usages keep the previous version; revisions already created never change.
- **Remove from the record** removes only the association (history rules of the origin apply: approved revisions keep their reference).
- **Archive** (`trashed_at`) removes the file from new selections, keeping usages and existing access; it does not withdraw publications. Retention in the trash: 30 days (configurable).
- **Delete permanently** requires no usages, no revision references (the `restrict` foreign key guarantees it), no publication and no applicable retention; the check covers all versions. Deletion marks "pending", blocks new associations, removes originals and derivatives with safe retry and confirms only after storage answers. Races between association and deletion are resolved on the server.
- Alternative text is not typed in the content editor (decision 2026-10-24); it is no longer required there, and any value already saved is kept; public videos need an accessible alternative before publishing.

## 10. Data model

| Entity | Responsibility |
|---|---|
| `media_assets` | Name, scope (`site`/`brand`/`profile`), `brand_id`, `owner_id` (profile scope), tags, `current_version_id`, `trashed_at`, author |
| `media_versions` | Asset, `version_no`, `storage_key`, `thumb_key`, `display_key`, original file name, MIME, size, dimensions/duration, checksum, status, `public_published_at` |
| `media_collections`, `media_collection_items` | Logical organization of the library |
| `media_usages` | `media_version_id` + `usage_type` + `usage_ref_id`, alternative text |
| `media_upload_sessions` | Author, purpose, reserved quota, expiry and status |
| `content_revision_media` | The ordered versions shown in each revision (immutable) |

The schema is in [../reference/data-model.md](../reference/data-model.md) section 6. Prefer real foreign keys per origin and `on delete restrict` on versions in use. Guarantee unique usage per version/origin and store order transactionally. **Signed URLs are temporary: never store them as the identity of a file or in persistent documents.**

## 11. Permissions

| Action | Application and dependency |
|---|---|
| `media.view` | Open the library and select files of the authorized scope |
| `media.upload` | Upload; requires `media.view` and, in context, write permission over the origin |
| `media.update` | Edit metadata, tags and collections; create versions (also requires `media.upload`) |
| `media.delete` | Archive and delete eligible files; also run the storage check |
| `media.publish` | Publish/withdraw public derivatives for the site; requires `media.update` |

Viewing an image already associated inside a record requires reading that record, not access to the whole library. Selecting another file requires `media.view` and write on the origin. Having library access never allows editing a content item or a page. Every rule is checked in server functions and in the database policies; revoking access prevents new reads and URL issuance (URLs already issued expire in minutes).

## 12. Delivery stages

1. Private infrastructure, permissions, image/PDF uploads, processing and the shared picker.
2. Library screen, collections, trash, "Used in", quota and storage check.
3. Use in content revisions (frozen versions), brand identity and publication evidence.
4. Video uploads with a browser-generated cover; derivatives for video posts.
5. Public derivatives and `media.publish` for the site; case study consent.
6. (Later) multipart upload for large videos, client uploads, sharing by link.

## 13. Acceptance criteria

- Add three images to a revision, choose the order and reorder with mouse or keyboard.
- Reuse an image in another revision without a new upload; removing it from one keeps the other.
- Open the picker, upload and cancel without creating an association or losing form data.
- Reject invalid format/size, forged MIME and an image above the pixel limit; failures never make incomplete files available.
- Repeat upload/confirmation without duplicating a version or association; clean only eligible abandoned temporaries.
- An external user of brand A gets no file, thumbnail, name or count belonging to brand B, even by ID or direct URL.
- A new version of a file does not change a past revision; a file used by an approved revision cannot be overwritten or permanently deleted, even under simultaneous association.
- Uploading a file never publishes it; a private file cannot become public by changing a visibility field.
- Library and uploads work with their own permissions without granting editing of the origin modules.

## 14. Open decisions

1. Do clients need to **upload files** (briefings, logos)? If yes: action `media.upload_external`, brand scope, a review status, never public (about one more week).
2. Video limits (size and duration) and when to add multipart upload.
3. Quota size and per-user daily limit.
4. Trash and audit retention (proposal: 30 days and 2 years).
5. Virus/malware scanning of documents before they become available.

## Implementation status

Phase 2 (tasks P2-01 to P2-04, 2026-10-18). Done: migrations `20261018100800_media.sql`, `…100810_media_functions.sql`, `…100820_media_summary_and_jobs.sql` (assets, immutable versions, upload sessions with idempotency, quota, collections up to 3 levels, usages with `restrict`, trash and permanent deletion with in-use checks, replacement of the current version, cleanup of expired sessions); tests `supabase/tests/07_media.test.sql` (55 assertions) and `08_media_jobs.test.sql` (7); storage layer in `src/lib/shared/storage/*`; `src/lib/shared/media/*` (limits, content inspection, upload and library server functions, collections, cron cleanup); screens `/admin/library`, `/admin/library/$assetId` and the brand tab `/admin/marketing/brands/$brandId/library` (grid, search, filters, trash, folders, storage bar, "Verificar com o bucket", versions, metadata, download, replace) and `MediaPicker`.

2026-10-19: Moved the media library's scope, brand, type and sort controls into the shared "Filtros" dropdown. Validation performed: targeted ESLint, typecheck, `check:consistency`, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser behavior.

2026-10-19: Hid the pagination footer when the media library has no files, leaving only its empty state. Validation performed: targeted ESLint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser behavior.

2026-10-19: Removed the prompt to choose a site or brand when no collection scope is selected. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser behavior.

Validation performed: 62 SQL assertions on PGlite; 20 Vitest tests (content inspection, server-side upload validation with a fake storage, presigning, and the real `aws4fetch` code against a fake S3 server: HEAD, Range, streamed checksum, list, delete); typecheck, lint, build; guard redirects and the cron 401 in Playwright. **Not tested**: a real R2 bucket (presigned PUT from a browser, CORS, `Range` reads), the screens in a browser with data, canvas thumbnails and video covers, a 50 MiB PDF in a Vercel function, the daily cron on Vercel. **Not done**: the `media.publish` flow and public derivatives (phase 5), the "used in" list with names (only a count is shown until the content module exists), reordering inside the picker (needed by the variant editor, phase 3), batch edit of tags, malware scanning, reconciliation of orphan objects without a database row (the check screen only reports them).

Phase 5 (task P5-03, 2026-10-19). `media_publish_derivative` and `media_withdraw_derivative` (migration `20261018101110_site_functions.sql`), the server functions `publishMedia` and `withdrawMedia` (copy of the two web sizes to `site/<hash>-400.webp` and `-1600.webp` in the public bucket, removal only when no other published version shares the hash) and the buttons "Publicar para o site" and "Retirar do site" in the media detail, shown with `media.publish` for images. An image used by a draft, a published page or the settings cannot be withdrawn (`media_in_use`). **Not tested**: the copy against the real R2 (V24, S14).

Share links and library layout (2026-10-19). Migrations `20261019120000_media_quota_default.sql` (default quota 10 GiB), `…120100_media_sharing.sql` (action `media.share`, granted to the `manager` role; tables `media_shares`, `media_share_grants`, `media_share_events`; private functions `media_share_create/update/revoke/list/targets`, the internal gate and file listing; `audit_write` catalog with `media.share_created` and `media.share_revoked`), `…120110_media_sharing_public.sql` (the three functions granted to `anon`) and `…120120_site_reserved_share.sql` (`share` is a reserved first segment for site pages and redirects). Files: `src/lib/shared/media/{sharing.functions,public-share.functions}.ts` and the share schemas in `schemas.ts`, `src/lib/shared/rate-limit.server.ts` (now also used by the contact form), the route `/share/$token`, `public-share-page.tsx`, `share-dialog.tsx`, `collections-grid.tsx` (replaces the side panel: breadcrumb, folder cards with a menu, share mark), file cards with a menu and the "Compartilhado" mark, the storage dialog (usage bar plus "Verificar com o bucket", an icon button). Validation: `supabase/tests/17_media_sharing.test.sql` (34 assertions on PGlite: secret length, audit, scope isolation between brands, role without `media.share`, external user, `anon` cannot read the table or create a link, password and lock, download limit, revocation, reserved address), 4 Vitest tests (schemas and rate limiter), and the public page answering "Link não encontrado" for an unknown secret against the real Supabase project. The quota migration initially failed before being applied and was not applied in any environment; the corrected script is pending deployment. **Not tested**: creating a link and opening it with a real file (needs an uploaded file and R2, S11/S14), the real signed URLs for view and download, the password flow in a browser, the 5-attempt lock with two connections, the per-IP limit across Vercel instances, the new library layout with files and folders (the project has none yet), the share dialog and the card menu, and bcrypt through `extensions.crypt` on the real database (covered offline only).

2026-10-19 quota migration recovery. `20261019120000_media_quota_default.sql` now recognizes both the 5 GiB fallback (`5120`) and the 10 GiB target (`10240`) in `media_request_upload` and `media_storage_summary`, changing only the old value and allowing the target value to pass unchanged. This handles a database where one function has already been updated while the other still holds the old default. **Validated**: `npm run db:verify` (696 SQL assertions) and an additional PGlite run applying the quota migration twice. **Not tested**: the corrected migration against the user's database; the 10 GiB fallback is pending deployment.
2026-10-19: Aligned media detail save action to the right using the shared form action component. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. Full typecheck remains blocked by existing calendar and brand-logo type errors outside this change. **Not tested**: browser rendering.

2026-10-19: The shared list-filter trigger now uses an icon with a tooltip and active-count badge. This applies to the media library. Validation performed: targeted ESLint, Prettier and `git diff --check`. `check:docs` is currently blocked by ten audit-action registry mismatches for `calendar_note.*` and `variant.*` in the audit/functions documents. Full typecheck is blocked by existing `brand-logos.server.ts` type errors. **Not tested**: browser interaction.

2026-10-19: The shared media picker now filters accepted types before server pagination and provides pagination, loading, retry and clearer empty states. Closing the picker clears the unconfirmed selection. Files: `src/components/shared/media/media-picker.tsx`, `src/lib/shared/media/media.functions.ts`, `src/lib/shared/media/schemas.ts`. Validation performed: targeted ESLint, full TypeScript check, Prettier, `check:docs` and `git diff --check`. **Not tested**: selecting files or uploading from the picker in a browser.

2026-10-23: the file area of the content editor (`FileStrip`) accepts dropped or chosen files: they are uploaded to the brand library and attached to the content as soon as each one finishes, with no extra clicks ("Adicionar da biblioteca" still exists). Uploads run through a global tray at the bottom right (`UploadTrayProvider` in `src/routes/admin/_app.tsx`, `upload-tray-panel.tsx`, `use-upload-tray.ts`) with a status and a progress bar per file, retry for failures, collapse, and a warning before leaving the page while uploading; the queue survives a change of editor step (a file that finishes after its step was left goes only to the library, with a toast). Real progress comes from `browserStorage().upload` (XHR, optional `onProgress`); `sendUpload` was extracted from `use-media-upload.ts` and is reused by the tray and by `UploadDialog`; `acceptFor` was added to `limits.ts`. Files: `file-strip.tsx`, `file-dropzone.tsx`, `upload-tray-provider.tsx`, `upload-tray-panel.tsx`. Validation performed: ESLint on the touched files, typecheck, Prettier, Vitest for `lib/shared/storage`. **Not tested:** a real upload against R2 and the browser (drag and drop, progress, 360 px, reduced motion); the library page and the picker still use `UploadDialog`, not the tray.

2026-10-27: Open video formats and clear upload errors (audit [../audits/media-video-upload.md](../audits/media-video-upload.md)). Migration `20261027100000_media_video_types.sql` (`media_request_upload` accepts the eight video MIME types; applied to the linked project on 2026-10-28). Files: `limits.ts` (video types, `mimeOfFile`, `extensionOf`, accept list with extensions, `ACCEPTED_FORMATS_LABEL`), `image-info.ts` (`inspectVideoFile` replaces `inspectMp4`), `validate-upload.server.ts` (`upload_video_invalid`, `upload_not_received`), `resize.ts` (10 s timeout, finite duration), `use-media-upload.ts` (`sendUpload` never throws, aborts the version on any failure, specific messages for size, format, connection, expired link and storage refusal), `browser-storage.ts` and `types.ts` (upload returns the HTTP status), `upload-tray-provider.tsx` (the duplicate error wrapper was removed), `media-grid.tsx` (icon when the cover fails), `media-detail-page.tsx` (message when the browser cannot play the video), `upload-dialog.tsx`, `upload-tray-panel.tsx`, `file-strip.tsx`, `errors.ts` and `reference/error-codes.md` (five new codes). Validation performed: Vitest on `src/lib/shared/media` and `storage` (38 tests), `npm run typecheck`, ESLint on the touched files, `check:consistency`, `check:docs`, `format:check`, `npm run db:verify` (1104 SQL assertions, 3 new in `07_media.test.sql`). **Not tested**: a real browser, a real iPhone or WhatsApp file, a real R2 bucket (CORS, expiry), the cover for HEVC or MOV in each browser, the new messages on screen, Instagram refusal of non-MP4 videos, the `supabase test db` run (Docker not used). Findings F3, F6, F10 and F11 of the audit stay open.

2026-10-28 (later): video cover capture. `inspectVideo` (`resize.ts`) now waits for the first seek (about 1 second or a tenth of the duration) before drawing the cover and discards a fully transparent frame, because the cover of the first video uploaded from the iPhone/WhatsApp came out blank or missing and the card showed nothing (an image that fails to load with `alt=""` is invisible; `media-grid.tsx` now falls back to the film icon on error). Videos already in the library keep their old cover; a new upload is needed to regenerate it (a "Regenerar capa" action is not built). Validation performed: `lint`, `typecheck`, Vitest (249). **Not tested**: the cover of an iPhone or WhatsApp MP4 in Chrome, Safari and Firefox, a file whose first seconds are black, the library card of an old video after the fix.
