# Audit: video upload in the media library

Snapshot of 2026-10-27 · Scope: upload, validation, library listing and preview of videos (`video/mp4`) · Method: static reading of the code and migrations (nothing was run against a real browser, R2 bucket or database).

Reported symptoms: (1) some videos upload but show no preview; (2) some videos upload but never reach the library; (3) files in the same format are accepted in one case and refused in another.

Files read: `src/hooks/shared/use-media-upload.ts`, `src/lib/shared/media/{limits,resize,image-info,schemas,upload.functions,validate-upload.server,media.functions}.ts`, `src/lib/shared/storage/{browser-storage,r2-storage.server}.ts`, `src/components/shared/media/{upload-dialog,upload-tray-provider,upload-tray-panel,file-dropzone,media-grid,media-detail-page}.tsx`, `supabase/migrations/20261018100810_media_functions.sql`, `docs/spaces/media-library.md`.

## 1. Summary

| Requirement | Status | Evidence |
|---|---|---|
| Video cover (preview) generated for every accepted video | ❌ | F1, F2, F3 |
| An uploaded video always ends in the library or in a visible error | ❌ | F4, F5, F6 |
| Same accepted/refused answer for the same format | ❌ | F7, F8 |
| Documented rule "incompatible codecs rejected" is enforced | ❌ | F9 |
| Size limit on the client equals the server limit | ❌ | F10 |
| Large videos confirm within a serverless function | 🟡 | F11 |
| Video tests | ❌ | F12 |

## 2. What is right (keep)

- Server never trusts the client: `stat`, size, stored content type and magic bytes are checked before `media_confirm_upload` (SEC-7).
- Failed validation discards the version and removes the stored keys (`discard`).
- The upload tray catches exceptions from `sendUpload` and shows a generic failure.
- Expired open sessions are cleaned by `media_expire_sessions`.

## 3. Findings

### F1 · High · A video whose cover cannot be generated is stored with a `thumb_key` that has no object

- Evidence: `media_request_upload` always reserves `thumb_key` for videos (`v_thumb := ... in ('image','video')`). In `sendUpload`, the cover is uploaded only when `planned.thumb && thumb`; when `inspectVideo` returns `null` or `toBlob` returns `null`, nothing is uploaded and `true` is used instead. `validateUploadedVersion` treats a missing derivative as valid (`derivativeBytes` returns `null` when `stat` finds nothing). `confirmUpload` then succeeds.
- Result: the library signs a URL for a key that does not exist. `Thumb` in `media-grid.tsx` renders `<img>` (no `onError`), so the card shows a broken image instead of the film icon. This is symptom 1.
- Risk: every video the browser cannot decode (HEVC/H.265 in Chrome and Firefox, MP4 with unusual codecs, some iPhone/Android recordings) is saved without a preview.
- Recommendation: if the cover is missing, the server must null `thumb_key` on confirm (or the client must tell the server it has none); `Thumb` falls back to the icon on `onError`.

### F2 · High · `inspectVideo` can hang forever

- Evidence: `resize.ts` resolves only on `onerror` or `onloadeddata`. There is no timeout and no `onstalled`/`onabort` handling. Browsers that do not load data with `preload="metadata"` (iOS Safari, low-data modes, some Chromium builds) never fire `loadeddata`; a decoder that neither errors nor loads also hangs.
- Result: `sendUpload` awaits `inspectVideo` **before** `requestUpload`, so the item stays in "Enviando…" forever with no network request. In the upload dialog (`start`) the whole queue is stuck behind it and `busy` never clears; in the tray the single worker (`running`) is stuck and no later file starts.
- Recommendation: timeout (for example 10 s) that resolves `null`; the upload must proceed without a cover instead of waiting.

### F3 · Medium · The cover is the first frame and the size comes from a decoder that may disagree with the file

- Evidence: `drawImage` is called on `loadeddata` at `currentTime = 0`; many videos start with a black or fade-in frame. `video.duration` can be `Infinity` or `NaN` (see F4).
- Result: black covers that look like "no preview".
- Recommendation: seek to a small offset (for example `min(1 s, duration / 10)`) and draw on `seeked`.

### F4 · High · A non-finite duration breaks `confirmUpload` after the bytes are already in R2

- Evidence: `durationMs: Math.round(video.duration * 1000) || 0`. For `Infinity` (streamable or fragmented MP4, some screen recordings) `Math.round(Infinity)` is `Infinity`, which is truthy, so it is sent. `confirmUploadSchema` requires `z.number().int().max(86_400_000)` and the server function rejects the input. `Math.round(NaN) || 0` is fine, but a duration above 24 h or `Infinity` is not.
- Result: `confirmUpload` throws a validation error. In `useMediaUpload.start` there is no `try/catch` around `sendUpload`: the exception escapes, `running.current` stays `true`, `busy` stays `true`, the remaining items stay "Na fila"/"Enviando…", and the dialog cannot be closed. In the tray the error is caught and the file shows "Falhou", but the version stays `open` (never aborted) until the 24 h expiry. Either way the file reached R2 and never reached the library. This is symptom 2.
- Recommendation: `Number.isFinite(duration) ? Math.round(duration * 1000) : undefined`; clamp to the schema limit; wrap `sendUpload` in `try/catch` inside the shared function so the dialog and the tray behave the same, and call `abortUpload` on any failure after `requestUpload`.

### F5 · High · Any exception after `requestUpload` leaves an open session and an orphan object

- Evidence: `sendUpload` calls `abortUpload` only when an upload returns `false`. A throw from `storage.upload` (it cannot throw), from `confirmUpload` (validation, network, server error) or from `abortUpload` itself leaves the version `open`.
- Result: quota stays reserved (`reserved_bytes = size + 4 MiB`, counted by `media_storage_used` while `status <> 'failed'`) for up to 24 h per failed attempt. The object stays in R2 until the expiry job. The user sees "Falhou" and retries, creating a second copy.
- Recommendation: one `try/finally` in `sendUpload` that aborts the version on every non-success path.

### F6 · Medium · The library only lists `available` versions, so a half-finished upload is invisible and the tray says "Na biblioteca" too early

- Evidence: `listMedia` filters `current.status = available` (inner join). `media_confirm_upload` sets the asset `current_version_id` only when it is null. The tray shows "Na biblioteca" as soon as `confirmUpload` returns, then invalidates `QueryKey.Media.all()`.
- Result: if confirm fails (F4, F5, F11), the file is in the bucket but in no list, and `checkStorage` reports it only as an unknown object. For "Nova versão" the new version is available but the asset keeps the old current version, which is by design, but nothing in the upload dialog says so.
- Recommendation: report the real outcome (a version that is not current says "Nova versão enviada; use 'Usar esta versão'"), and make the failure of confirm visible with the reason code.

### F7 · High · The client decides by `file.type`, which is unreliable for video

- Evidence: `rejectionFor` uses `kindOfMime(file.type)`. Browsers derive `file.type` from the extension and the operating system registry: `.mp4` can arrive as `""` (Windows without a registered type), `video/x-m4v` (`.m4v`), `video/quicktime` (`.mov`, iPhone) or `application/octet-stream`. Only exactly `video/mp4` is accepted.
- Result: two files that "look the same" get opposite answers: "Este tipo de arquivo não é aceito." for one and an upload for the other. This is symptom 3. The picker `accept` attribute (`video/mp4`) also hides `.mov`/`.m4v` in the file dialog on some systems but not when dragging.
- Recommendation: decide from the extension **and** the magic bytes. Read the first bytes in the browser (`ftyp` and its brand), map `mp4`, `m4v`, `isom`, `mp42`, `avc1` and `qt  ` to the stored MIME `video/mp4` (or accept `video/quicktime` explicitly after a documented decision, see Open decisions). Send the normalized MIME to `requestUpload` and use it as the `Content-Type` of the PUT.

### F8 · Medium · Two different "invalid" messages for the same root cause

- Evidence: client says "Este tipo de arquivo não é aceito."; the server says `upload_content_mismatch` ("O conteúdo do arquivo não corresponde ao tipo informado.") when `inspectMp4` fails or when the stored `Content-Type` differs from the declared MIME. `inspectMp4` only checks that bytes 4–8 are `ftyp`, so MP4 files whose first box is not `ftyp` (`moov` first, or a leading `free`/`wide`/`skip` box, produced by some editors and downloaders) are refused as "invalid" while a visually identical MP4 passes.
- Recommendation: walk the top-level boxes in the head (`ftyp` anywhere in the first boxes) before refusing; give `upload_content_mismatch` for video a message that names the format ("O vídeo precisa ser MP4 (H.264)").

### F9 · Medium · "Incompatible codecs rejected" (docs) is not implemented

- Evidence: `docs/spaces/media-library.md` section on video states MP4 (H.264/AAC) and "incompatible codecs rejected". The server checks only `ftyp`; the client rejects nothing (it only fails to make a cover, F1). Instagram publishing requires H.264/AAC, so an HEVC file is accepted into the library and fails later at publication.
- Recommendation: either implement the check (read `stsd`/`avc1` from `moov` when it is inside the head range, or ask the browser `canPlayType`/`MediaCapabilities` and send the result) or change the document to say the codec is not verified (GOLD-3: the document is changed first).

### F10 · Medium · The video size limit differs between client and server

- Evidence: the client uses the constant `DEFAULT_LIMITS_MB.video = 100`; the server uses the organization policy `maxVideoMb` (default 100, configurable up to 2000 in settings).
- Result: if the policy is lowered, the browser accepts and the server answers `upload_too_large` after the bytes were sent only when the check runs (it runs at `requestUpload`, before the PUT, so no bytes are lost). If the policy is raised, the browser still refuses files above 100 MB although the setting allows them.
- Recommendation: expose the effective limits to the client from the same policy and use them in `rejectionFor`.

### F11 · Medium · Large videos: single PUT, 10-minute URL, whole-file checksum in a serverless function

- Evidence: `PUT_SECONDS = 600`; one `XMLHttpRequest` PUT; `sha256` streams the whole object inside `confirmUpload`. `docs/pending-external-setup.md` (V13) and `r2-storage.md` already list the memory/time behavior as **not tested** even for a 50 MiB PDF.
- Result: on a slow connection a 100 MB video can exceed 10 minutes and the PUT fails with an expired signature (surfaces as "Não foi possível enviar o arquivo."); on Vercel, hashing 100 MB can exceed the function time limit, and the confirm fails after the upload completed (same outcome as F4).
- Recommendation: measure on the rehearsal bucket before changing anything (this finding is a risk, not a proven failure). Options: longer URL validity for videos, a client-computed checksum verified against the object ETag, or multipart upload (already planned as phase 6).

### F12 · Low · No automated coverage for video

- Evidence: `inspect.test.ts` covers one `ftyp` case; nothing covers `inspectVideo`, `rejectionFor` with video types, `sendUpload` failure paths, the library thumbnail fallback or the server validation with a video and a missing cover.
- Recommendation: add Vitest cases for each finding above as it is fixed (unit for `rejectionFor` and the MP4 box walk, `validateUploadedVersion` with a fake storage, `sendUpload` with mocked server functions).

## 4. Plan (ordered, small steps)

1. F4 + F5: harden `sendUpload` (finite duration, `try/finally` abort, same error handling in the dialog and the tray). Smallest change that stops the "uploaded but not in the library" case.
2. F1 + F2: timeout in `inspectVideo`; null `thumb_key` when no cover was uploaded; icon fallback on `onError` in `Thumb`.
3. F7 + F8: file type detection by extension and magic bytes, MP4 box walk on the server.
4. F10: effective limits from the policy to the client.
5. F3: cover frame at an offset.
6. F9: decide codec policy (document first), then implement.
7. F11: measure on the rehearsal bucket, then decide.
8. F12: tests added with each step.

## 5. Status of each finding

| ID | Status |
|---|---|
| F1 | fixed 2026-10-27: the grid falls back to the film icon when the cover fails to load; the dangling `thumb_key` of a video without cover is still stored (harmless, not cleaned) |
| F2 | fixed 2026-10-27: `inspectVideo` gives up after 10 s and the upload goes on without cover |
| F3 | open |
| F4 | fixed 2026-10-27: the duration is finite and clamped; `sendUpload` never throws |
| F5 | fixed 2026-10-27: any failure after `requestUpload` aborts the version |
| F6 | open (the message is clearer now, the tray still says "Na biblioteca" right after confirm) |
| F7 | fixed 2026-10-27: the MIME type comes from `file.type` or, when empty/generic, from the extension; the same value is sent to the server and used as the `Content-Type` of the PUT |
| F8 | fixed 2026-10-27: the server reads the container (MP4/MOV family boxes in any common order, EBML, RIFF AVI) and answers `upload_video_invalid` with a plain message |
| F9 | closed by decision 2026-10-27: the codec is not verified; the document no longer says "incompatible codecs rejected"; the detail screen explains when the browser cannot play a file |
| F10 | open |
| F11 | open (needs measurement) |
| F12 | partly fixed 2026-10-27: unit tests for the container check, MIME resolution, accept list and video validation, and 3 SQL assertions; no test of `sendUpload`, `inspectVideo` or the screens |

Decisions (2026-10-27): the library is open to as many video types as can be verified (MP4, M4V, MOV, 3GP, 3G2, WebM, MKV, AVI), so iPhone `.mov` files and files saved from WhatsApp are accepted; only `video/mp4` can be published to Instagram (any other video is refused there with `media_not_ready`).

## 6. Limits of this audit

- Nothing was executed: no browser, no real R2 bucket (CORS, signed URL expiry, `Range` reads), no database. The causes of the three reported symptoms are inferred from the code and are the most likely ones; they were not reproduced.
- The exact files that fail for the reporter were not available. Sending the name, size and `file.type` (browser console: `document.querySelector('input[type=file]').files[0].type`) of one accepted and one refused video would confirm F7/F8; the browser console output of a video that shows no preview would confirm F1/F2.
- `docs/audits/` did not exist before this file.
