# Module — Media Library

> A cross-cutting module that centralizes the files of Compasso (images, videos and documents) and gives every page a reusable picker. It serves the Site and CMS space, Marketing Management (brands, content revisions) and, read-only and through signed URLs, the client portal. Storage is described in [r2-storage.md](r2-storage.md). The patterns (asset/version/usage, immutable versions, upload sessions, shared picker, quota) come from the Memoria Print media library; scopes, usages and permissions are Compasso's own. UI label: "Biblioteca de Mídia". Route: `/admin/library`. UI texts are Brazilian Portuguese; everything else is English.

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

- **Nothing becomes public by default.** Every upload is private. Only an explicit action (`media.publish`) copies an approved **derivative** (never the original) to the public bucket.
- A private file does not become public because it is selected in an editor. A brand file used in the portfolio requires explicit authorization of the case study (consent note and date).
- Thumbnails, search, counts, file names and the "Used in" list obey the same access rules; the interface never reveals names or counts of origins the person cannot access. A deletion blocked by references that are not visible shows only "O arquivo tem usos que impedem a exclusão".
- Brand scope is checked with the same function as everything else (`can_access_brand`); external users never browse the library.

## 4. Where files are used

| Origin | Usage | Rules |
|---|---|---|
| Content revisions (variants) | Carousel images, videos, PDFs of a post | Order and alternative text per usage; the **exact versions** are frozen in the revision (`content_revision_media`) |
| Brand identity | Logos, guidelines, references | Brand scope; editable by those who can update the brand |
| Publication evidence | Screenshot or file proving a manual publication | Linked to the variant; kept as history |
| Site pages and case studies | Images and videos in sections | Site scope; published only through public derivatives |
| Social image (SEO) | Open Graph image of a page | Needs a published derivative |
| Comments (future) | Client attachments | Out of the MVP; never public or approved automatically |

Removing a file from a draft revision removes only the association. Approved revisions keep their references; a correction adds a new revision.

## 5. Shared picker

Every page uses the same selection component (`MediaPicker`), configured by context, accepted types, maximum quantity, single/multiple selection and usage role. The server validates these rules; it does not trust the configuration sent by the browser.

1. In the variant editor choose "Adicionar arquivos".
2. A panel opens with "Biblioteca" and "Enviar arquivos", showing only accessible and compatible files (the brand's, or the site's).
3. Search, filter and select existing ones or upload new ones, without leaving the editor or losing unsaved changes.
4. Confirm the selection, set the order and alternative text.
5. Save to confirm the associations; return to the same position.

Cancelling the selection associates nothing. A completed upload and a saved association are different states: a file uploaded to the library can remain unused; an abandoned temporary upload is cleaned after the period below. Show progress per file, failures and the possibility of retrying only the failed ones. Do not report success of the form while a mandatory upload is incomplete.

## 6. Library screen and file record

Routes: `/admin/library` and `/admin/library/$assetId`; menu entry "Biblioteca de Mídia"; the Marketing and Site spaces also open it filtered by brand or by site.

- Grid/list with thumbnail, name, type, size, status and date; search by name/tag; filters by type, scope, usage and status; sorting by newest, oldest, name and size. Pagination, search and filters on the server.
- Record with preview, metadata, versions, tags, author and accessible usages. Files without preview have an icon and an authorized download action.
- Batch changes only for eligible files, indicating the ones that failed.
- Do not play audio/video automatically; keyboard control; reordering by buttons as well as dragging.
- A **storage bar** shows how much of the quota is used (warning at 80 %, alert at 95 %); "Verificar com o bucket" (`media.delete`) compares the bucket with the library: real total, unknown objects, records without an object and missing copies (read-only).

**Collections (folders)**: up to 3 levels, scoped to a brand or to the site. A collection is only a navigation label: moving a file does not change its identity, URLs or usages. The name is unique inside the same level (case-insensitive); a collection can only be deleted when empty (files are never deleted with it); creating and renaming require `media.update`, deleting requires `media.delete`, moving files (up to 200 at a time) requires `media.update`. Search covers the whole scope. Each upload creates a new asset, even if the same content already exists; repeated names get a number ("foto (1)").

## 7. Formats and limits

Initial values, configured centrally (`src/lib/shared/media/limits.ts` and environment) and validated on client and server:

| Type | Accepted formats | Limit per file | Handling |
|---|---|---|---|
| Image | JPEG, PNG, WebP | 25 MiB and 40 million pixels | Thumbnail and display copy generated in the browser; preserve ratio and transparency; strip EXIF/location from derivatives |
| Video | MP4 (H.264/AAC) | 100 MiB in the MVP | Cover image generated in the browser (canvas); incompatible codecs rejected; no transcoding |
| Document | PDF | 50 MiB | No thumbnail; preview in the record; validated by the `%PDF-` header and the `%%EOF`; never used as an image |

Audio alone, SVG, HTML, executables, ZIP and editable design files are not accepted. Maximum of 10 files per upload operation (several batches allowed). Replaced versions count towards storage; do not delete them to get around history preservation.

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
- Alternative text is required on content images meant for publishing; public videos need an accessible alternative before publishing.

## 10. Data model

| Entity | Responsibility |
|---|---|
| `media_assets` | Name, scope (`site`/`brand`), `brand_id`, tags, `current_version_id`, `trashed_at`, author |
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
