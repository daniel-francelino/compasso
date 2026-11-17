# Module — Video editor

> **Status: approved on 2026-11-17 with the spike of phase 0 skipped by decision; MVP delivered in code on 2026-11-17, not yet used in a browser, see "Implementation status".** Reverse engineering of CapCut, the feasibility analysis and the specification of the timeline video editor inside Aura Creative (menu "Vídeos"). The names of section 5 are in the registries ([../reference/](../reference/README.md)). The sister document for images is [image-editor.md](image-editor.md); this one reuses its presets, fonts, history and storage decisions. UI copy is Brazilian Portuguese; everything else is English.

## 1. Goal and verdict

Let the team assemble short vertical or square videos (Reels, Stories, feed video) from clips already in the media library: cut, order, add text, music and a logo, and export an MP4 that Instagram accepts, without leaving the platform.

| Question | Answer |
|---|---|
| Can an editor **in the style of CapCut** exist in this project? | **Partly.** A basic editor (trim, split, reorder, text, image overlay, audio track, export to MP4) is feasible **in the browser**. It is a harder and riskier project than the image editor. |
| Can it be **CapCut itself** (effects, transitions library, keyframes, auto-captions, AI, templates, 4K multi-track)? | **No.** CapCut is a C++ engine compiled to WebAssembly by a large team. Not realistic here. |
| Can it run on the **server** (Vercel)? | **No.** The architecture says "no FFmpeg on Vercel" ([../technical-architecture-v0.1.md](../technical-architecture-v0.1.md) section 11.4) and functions have time, memory and body limits. Server rendering would need a **new component** (a render worker), which is a larger decision (section 3, V4). |
| Does it fit the rules? | Yes for a browser-only editor, with **four decisions** to change first (section 3, V1 to V4). |
| Estimated size (one developer, estimate not a measurement) | MVP of section 4.1: about 10 to 14 weeks. The 2-week spike was skipped by decision (2026-11-17), so in-browser export on the team's machines is unmeasured. |

Path taken (2026-11-17): the MVP was built directly in the browser on WebCodecs through Mediabunny, without the spike. The first use on the team's real machines plays the role of the spike: if exporting a 60-second 1080×1920 video is too slow or fails there, the fallback stays **not offering export** and linking to an external tool, not a weaker editor.

## 2. Reverse engineering of CapCut

**Method and honesty.** CapCut is closed source. This section combines (a) what the product visibly does, (b) what its maker has published and (c) **inferences**. Each row says which. Nothing was verified against CapCut's code.

Public source: the web.dev case study [CapCut: building a fully-functional web app using WebAssembly and WebCodecs](https://web.dev/case-studies/capcut). It states that the web app was made by **porting the native editing engine** (written in C++) to WebAssembly with Emscripten, that WebAssembly's native exception handling reduced the package by about 15%, and that hardware-accelerated decoding and encoding through **WebCodecs** sped up audio and video processing by nearly 300% and allowed several 4K videos to play at once (figures are the vendor's own). It does not describe the renderer; the use of WebGL is **not confirmed** by any source found.

### 2.1 Functional anatomy

| Area | What CapCut does (observed) | Evidence | Needed in Aura? |
|---|---|---|---|
| Project | A project has a canvas size and frame rate (9:16, 1:1, 16:9; 30 fps) | Observed | Yes: presets for Instagram formats |
| Media bin | Imported clips, images, audio | Observed | Replaced by `MediaPicker` over the media library |
| Timeline | Horizontal time axis with **tracks** (video, overlay, text, audio); clips are placed, trimmed from both ends, split at the playhead, moved, snapped | Observed | Yes: the core of the editor |
| Preview | Player with playhead, play/pause, scrub, frame stepping | Observed | Yes |
| Clip properties | Position, scale, rotation, opacity, speed, volume, crop, mask | Observed | Position, scale, opacity, volume, crop; speed later |
| Text and stickers | Text layers with styles, animations, captions | Observed | Plain text layers with a start and an end |
| Transitions and effects | Large library of transitions, filters, effects (GPU shaders) | Observed | Fade/cross-fade only, later |
| Keyframes | Animate any property over time | Observed | Later (or never) |
| Audio | Music library, voice-over, volume, fade, beat sync | Observed | Upload music into the library; volume and fade |
| Auto captions, AI | Speech to text, background removal, AI generation | Observed | Out |
| Templates | One-tap templates that fill with the user's clips | Observed (the case study mentions over a million templates) | A small set later; same idea as design templates |
| Export | Resolution, fps, bitrate, codec choice; MP4; on the web, in-browser encode | Public (case study) | MP4, H.264 + AAC, 1080p, 30 fps |
| Cloud project and sync | Projects stored in the account | Observed | Yes, as project JSON in the database |

### 2.2 Document model (inferred)

A project is `canvas + tracks[] → clips[]`. A clip has: a source reference (media id), `sourceIn` and `sourceOut` (the part of the source used), `start` on the timeline, transform, effects and audio properties. **Editing never touches the source file**: it only edits this description (non-destructive editing). The preview and the export both read the same description, which is why the two always agree. This is the standard model of every non-linear editor and is what section 5.2 proposes. **Inference.**

### 2.3 Preview pipeline (inferred, standard practice)

For each displayed frame: find the clips active at the playhead time → decode the needed source frame → apply transform and effects while compositing the layers → draw on a canvas; audio is mixed separately and drives the clock. Decoding is the bottleneck, so editors cache decoded frames, decode ahead of the playhead and often work on **low-resolution proxies** while editing and use the original only for export.

### 2.4 Export pipeline (inferred, standard practice)

For each output frame at the target fps: composite exactly as in the preview, encode the frame (hardware encoder), mix and encode the audio, **mux** both into an MP4 container. In the browser this is WebCodecs (`VideoDecoder`, `VideoEncoder`, `AudioEncoder`) plus a muxer; ffmpeg compiled to WebAssembly is the alternative.

### 2.5 What CapCut does that Aura should **not** copy

Effect and transition libraries, keyframe animation, speech-to-text captions, AI features, 4K multi-track playback, the template marketplace, the music catalog (licensing), a mobile-native app. CapCut's web app exists because a team ported an existing native engine; Aura has no such engine to port.

## 3. Fit with this project

| ID | Rule or decision | Effect | Resolution (decided 2026-11-17) |
|---|---|---|---|
| V1 | [../spaces/media-library.md](../spaces/media-library.md) section 1 excluded video editing | The editor is video editing | **Changed first** (base.md 9.1): the library stays storage; video editing lives in this module, which reads and writes through the library |
| V2 | Media library section 7: video up to **100 MiB**, single `PUT`, URL valid about 10 minutes; [../audits/media-video-upload.md](../audits/media-video-upload.md) F11 (large uploads not measured) | A long export would not fit | A project lasts **at most 90 seconds** (`video_too_long`) and is exported at 6 Mbit/s video + 128 kbit/s audio (about 70 MiB at 90 s); a file above 100 MiB is refused before the upload. Multipart upload is a prerequisite for anything longer |
| V3 | Media library: "the codec is **not** verified, no transcoding"; Instagram needs MP4 | The editor is the first place that produces a controlled codec | Export H.264 + AAC in MP4. A clip the browser cannot decode (HEVC from an iPhone, audit F1) is **refused when it is added**, with a clear message; nothing is transcoded |
| V4 | ADR-14 and architecture 11.4: "no FFmpeg on Vercel" | Server rendering is excluded | **The editor renders in the browser only.** A server render worker would be a separate ADR |
| — | ADR-13: persistent queue only for automatic publishing | Not needed: rendering is client-side | Fits |
| — | GOLD-8, immutable versions | Fits | Exporting saves an immutable project version first; the exported MP4 is an immutable media version; an approved revision keeps pointing to the media version |
| — | SEC-7 uploads | Fits | The export goes through `sendUpload` (`requestUpload` → PUT → `confirmUpload`); the server checks the container signature as for every video |
| — | SEC-8, SEC-12 | Fits | No HTML from users; text is drawn on a canvas; the project JSON holds ids, numbers and the text of the text clips |
| — | UI-7 and UI-8 | A timeline is not usable at 360 px | **Desktop only** (decided 2026-11-17, an exception to UI-7 for this screen): below 1024 px the editor is read-only with a message. Keyboard shortcuts for every timeline action and a clip list as the accessible alternative |
| — | Supported browsers | WebCodecs support differs between browsers | **Chromium first** (Chrome, Edge), written on the screen. Export is enabled only when the browser can encode H.264 and AAC; editing and preview work wherever the `<video>` element plays the files |
| — | Audio files | The library accepts images, videos and PDFs only | **The music track uses the sound of a library video** (an MP4 or MOV with the song). Adding audio types to the library is a separate decision (SEC-7 allowlist, signatures, kind) |
| — | Spaces and `lost-ui` | Same as the image editor | Module in `shared` (`shared/video`); panels and dialogs from the kit; the timeline is app-specific |
| — | CODE-7, 600-line limit | Editors grow fast | Split by feature (timeline, player, export, properties) from the first commit |

## 4. Scope

### 4.1 MVP (delivered in code)

- One project = one format preset (the presets of the image editor: 1:1 1080×1080, 4:5 1080×1350, 9:16 1080×1920) at 30 fps, **up to 90 seconds**.
- Four tracks: **main** (videos and still images played one after the other, without gaps), **overlay** (images such as a logo, at a time and position), **text** and **audio** (the sound of a library video, used as music).
- Main clips: trim the start and the end, split at the playhead, delete, move left or right, fit "Preencher" (cover) or "Ajustar" (contain, on the project background color), volume of the clip's own sound.
- Overlay and text clips: start and duration on the timeline (drag or fields), position and size, opacity (overlay); text with the eight fonts of the image editor, size, bold, italic, color, alignment and an optional background box.
- Audio clips: start, trim, volume, fade in and fade out.
- Project fade in and fade out (picture to the background color and sound to silence).
- Play, pause, scrub, frame step; undo/redo; draft autosave with `version`.
- Export: MP4 (H.264 + AAC), the preset size, 30 fps; progress, cancel, and the result in the media library, ready to attach to a content item through the content editor's picker.

### 4.2 Later

Cross-fade transitions, speed, crop and mask, voice-over recording, audio files in the library, a list of saved versions with restore, per-brand templates, proxies for large clips, multipart upload, subtitle import (SRT), reuse of image-editor designs as overlays, drag of overlays on the player.

### 4.3 Out

Effects and filters library, keyframes, AI and auto-captions, 4K, multi-camera, collaboration, a music catalog, a server render worker.

## 5. Technical design

### 5.1 Building blocks

| Concern | Implementation |
|---|---|
| Container read and write, decode, encode | **Mediabunny** ^1.66.0 (MPL-2.0, TypeScript, maintained; added 2026-11-17): `Input` + `UrlSource` + `CanvasSink` to decode the original files, `Output` + `Mp4OutputFormat` + `CanvasSource` (H.264) + `AudioSampleSource` (AAC) to encode and mux. ffmpeg.wasm is not used |
| Preview | A 2D canvas drawn on every animation frame from hidden `<video>` elements (main clips) and `<audio>` elements (audio clips) kept in sync with the playhead; the elements play the sound in the preview |
| Composite | `composeFrame` in `lib/shared/video/compose.ts`, the same function for the preview and the export: main frame (cover or contain) → overlays → texts → project fade |
| Text | Every text clip is rasterized on the main thread (after its font loads) into a bitmap; the preview and the export draw the same bitmap, so they agree |
| Export | A module Web Worker (`export.worker.ts`) decodes, composites and encodes on an `OffscreenCanvas`; the main thread prepares the image and text bitmaps and the mixed audio, then uploads the result |
| Audio mix | `OfflineAudioContext` on the main thread (Web Audio is not available in workers): each source's sound is decoded, placed, trimmed, faded and mixed to 48 kHz stereo; the worker encodes it to AAC |
| Timeline UI | Plain React with pointer events (move and trim with snapping to the playhead and to clip edges); `@dnd-kit` was not needed |
| Fonts, presets, history, autosave | Reused from the image editor: `DesignFont` and `loadDesignFont`, `DesignPreset` and its sizes, `history.ts`, and the draft autosave, now generic (`useDraftAutosave`) and used by both editors |

### 5.2 Document model

The project JSON is the source of truth, validated by zod on the server (SEC-6, `videoDocumentSchema` in `lib/shared/video/schemas.ts`) and checked again by `video_assert_document` in SQL. Time is stored as **integer milliseconds**; frame positions are derived from 30 fps. Assets are referenced by media version id, never by signed URL (DATA-15).

Shape (version 1): `{ version: 1, background, fadeInMs, fadeOutMs, main[], overlays[], texts[], audio[] }`.

- `background`: `#rrggbb`, shown behind a contained clip and in the fades. `fadeInMs`, `fadeOutMs`: 0 to 3000.
- **Main clip** (`main`, played in array order without gaps): `id`, `kind` (`VideoClipKind`: `video` or `image`), `mediaVersionId` (a video or an image of the same brand, matching the kind), `durationMs` (100 to 90000), `sourceInMs` (where the clip starts in its source; 0 for an image), `volume` (0 to 1; 0 for an image), `fit` (`VideoFit`: `cover` or `contain`).
- **Overlay clip** (`overlays`): `id`, `mediaVersionId` (an image of the same brand), `startMs`, `durationMs`, `x`, `y`, `width`, `height` (pixels of the project size), `opacity` (0 to 1). Array order is the stacking order.
- **Text clip** (`texts`): `id`, `text` (up to 500 characters; an empty text draws nothing), `startMs`, `durationMs`, `x`, `y`, `width`, `font` (`DesignFont`), `fontSize` (12 to 300), `bold`, `italic`, `color`, `align` (`DesignTextAlign`), `background` (`#rrggbb` or `null`: a box behind the text). Texts are drawn above the overlays.
- **Audio clip** (`audio`): `id`, `mediaVersionId` (a **video** of the same brand whose sound is used), `startMs`, `durationMs`, `sourceInMs`, `volume` (0 to 1), `fadeInMs`, `fadeOutMs` (0 to 10000 each).

The **duration** of a project is the largest of the sum of the main clips and the end (`startMs + durationMs`) of every other clip; it must be at most 90000 ms (`video_too_long`). Limits: 50 main clips, 20 overlays, 30 texts, 5 audio clips, 256 KiB (`video_too_large`). Colors inside a document are user data (UI-9 is about the application's interface); the default colors of a new project and a new text are read from the palette tokens at run time.

### 5.3 Data

| Name | Purpose |
|---|---|
| `video_projects` | One row per project: `brand_id`, `name` (1 to 120), `preset` (`DesignPreset`), `draft_document` (jsonb, written by autosave), `current_version_no` (0 when none), `version` (optimistic locking, DATA-5), `trashed_at`, `created_by`. `unique (id, brand_id)` |
| `video_project_versions` | **Immutable** saved states: `project_id` + `brand_id` (composite foreign key, DATA-3), `version_no`, `document`, `duration_ms`, `created_by`. A trigger refuses update and delete (`video_version_immutable`, DATA-6) |
| `video_exports` | One row per export: `project_id` + `brand_id` (composite foreign key), `version_no` (the saved version exported), `media_asset_id`, `media_version_id` (unique), `created_by`, `created_at`. Written only by `video_project_record_export` |
| `media_usages` | New usage type `video_project_version` (`usage_ref_id` = the `video_project_versions.id`): every video and image a saved version references, so the library counts it as used and refuses to delete it |
| Actions | `video.view` (requires `brands.view`), `video.create`, `video.update`, `video.delete` (each requires `video.view`). Choosing a clip also needs `media.view`; exporting also needs `media.upload` (the upload checks it). Starting roles: `manager` has the four; `collaborator` has view, create and update |
| Audit | `video.created` (metadata: the preset), `video.version_saved` (metadata: version number and duration), `video.trashed`, `video.restored`, `video.exported` (metadata: version number), all through `audit_write` (entity `video_project`). Autosave of the draft is not audited |
| Error codes | `video_too_long`, `video_too_large`, `video_empty` (saving a version of a project without clips), `video_trashed`, `video_version_immutable`; a stale `version` answers the shared `conflict`; a bad shape, a file of another brand or of the wrong kind, or an export file that does not match answers `invalid_input` |
| SQL functions | `video_project_create(p_brand, p_name, p_preset, p_document)` (the empty document built by the client, so its default colors come from the palette tokens), `video_project_save_draft`, `video_project_rename`, `video_project_save_version` (also writes the usages), `video_project_set_trashed`, `video_project_record_export`; internal `video_assert_document` (returns the duration), `video_project_lock`; trigger `video_project_versions_immutable` |
| Server functions | `listVideoProjects`, `getVideoProject`, `createVideoProject`, `saveVideoProjectDraft`, `renameVideoProject`, `saveVideoProjectVersion`, `setVideoProjectTrashed`, `listVideoExports`, `recordVideoExport`, all in `lib/shared/video/video.functions.ts` |

The tables follow base.md 5.5: RLS with `video.view` and `can_access_brand`, writes only through the functions, no policy for external users, and no `portal_*` function exposes a project (the portal only sees the exported media of a revision). Archive instead of delete (GOLD-8): "Mover para a lixeira" sets `trashed_at` and needs `video.delete`; a trashed project cannot be edited (`video_trashed`) until it is restored.

### 5.4 Flow

1. "Novo vídeo": name, brand and format. The editor opens with empty tracks.
2. Add clips through `MediaPicker` (videos and images of the project's brand). Before a video is added, the browser probes it with Mediabunny: a file whose video cannot be decoded is refused with "Este vídeo usa um formato que o navegador não consegue abrir…"; its duration limits the trim.
3. Edit; the draft is saved about 2 seconds after the last change with `version`; a conflict stops the autosave and keeps the work on screen until the person reloads.
4. "Exportar": saves a version (`video_project_save_version`), loads the fonts and the original files, rasterizes texts and images, mixes the audio, then the worker renders every frame and encodes the MP4 with a real progress bar and "Cancelar". The file is uploaded through `sendUpload` as a normal video of the brand and linked with `video_project_record_export`. A failed upload can be retried without rendering again while the dialog is open. Leaving the page during the export asks for confirmation.
5. The exported video is attached to a content item through the existing picker of the content editor. A content revision freezes the **media version**, not the project (GOLD-8).

### 5.5 Placement and screens

`components/shared/video/`, `lib/shared/video/`, `hooks/shared/video/`. Routes in the Marketing group: `/admin/marketing/videos` (list) and `/admin/marketing/videos/$projectId` (editor), both guarded by `video.view`. Menu entry "Vídeos" in the "Produção" group of `nav-config.ts`, next to "Designs".

- **List ("Vídeos"):** search by name, tabs "Ativos" and "Lixeira", brand filter, server pagination; columns name, brand, format, saved versions and last change; primary action "Novo vídeo". Row actions: open, move to the trash or restore.
- **Editor:** header with the name, the saving state and "Exportar"; a toolbar ("Clipe", "Imagem", "Texto", "Música", "Dividir", "Excluir", undo, redo); the player (canvas at the preset ratio, play/pause, previous and next frame, time); a side panel with "Propriedades" (the selected clip, or the project: background color and fades) and "Clipes" (every clip of every track as a list of buttons with its time range, the accessible alternative to the timeline, with "Mover para a esquerda/direita" for main clips); the timeline (ruler, four tracks, playhead, zoom).
- **Timeline:** click the ruler to move the playhead; drag a clip to move it (overlay, text and audio tracks; main clips are reordered with the buttons or the keyboard); drag the edges to trim; edges snap to the playhead and to other clips. Each clip is a focusable button.
- **Keyboard:** Space plays or pauses, Left and Right move the playhead one frame (one second with Shift) or, with a clip selected, nudge it, S splits at the playhead, Delete removes, Home and End go to the start and the end, Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) undo and redo, Escape clears the selection.
- **Read-only:** without `video.update`, for a project in the trash and below 1024 px. "Exportar" also needs `media.upload` and a browser that encodes H.264 and AAC.

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Browser support** of WebCodecs (Safari and Firefox differ and change) | The export works for some people only | Chromium first, written on the screen; `canEncodeVideo('avc')` and `canEncodeAudio('aac')` are checked before "Exportar" is enabled |
| HEVC and uncommon codecs from phones (audit F1) | A clip cannot be decoded | Probed when added; refused with a clear message; no transcoding |
| Performance and memory | Tab freezes or crashes | 90 s cap; one decoder alive at a time in the export; work in a worker; **not measured** (the spike was skipped) |
| Preview sync | The preview uses media elements and a wall clock, so a slow machine may drift a little | Elements are re-seeked when they drift more than 150 ms; the export is frame-exact and does not depend on the preview |
| CORS of the private bucket | The canvas cannot read the frames ("tainted") | Same `GET` CORS rule the image editor needs ([../spaces/r2-storage.md](../spaces/r2-storage.md) section 6) |
| Output larger than 100 MiB or upload failing | Export lost (audit F11) | Duration cap and fixed bitrate; size checked before upload; the file stays in memory for a retry while the dialog is open |
| Music and font licensing | Legal exposure | User uploads only; curated open-license fonts |
| Maintenance cost | Browsers change | Accepted on 2026-11-17 |

## 7. Phases

| Phase | Content | Status |
|---|---|---|
| 0 | Decisions V1 to V4 recorded; spike | Decisions recorded 2026-11-17; spike skipped by decision |
| 1 | Document model, timeline UI, player, undo/redo, save/load, migration and pgTAP | Delivered in code 2026-11-17 |
| 2 | Export pipeline in a worker, upload and record, progress and cancel | Delivered in code 2026-11-17 |
| 3 | Accessibility pass, browser matrix, tests on the team's machines | Not done |

## 8. Decisions (2026-11-17)

1. The media library document was changed (V1): video editing lives in this module.
2. Rendering happens in the browser only (V4); a render worker would be a separate proposal.
3. A project lasts at most 90 s and the export stays under the 100 MiB upload limit until multipart upload exists (V2).
4. Chromium is the supported browser at first, written on the screen.
5. The editor is desktop only (below 1024 px it is read-only).
6. The 2-week spike was skipped; the MVP was built directly.
7. Mediabunny is the media library (MPL-2.0), added as a dependency.
8. The music track uses the sound of a library video until audio files are accepted by the library (separate decision).
9. The presets, fonts, history and autosave of the image editor are reused, not copied (GOLD-2).
10. `manager` and `collaborator` view, create and update projects; only `manager` moves them to the trash.

## 9. Acceptance criteria

- Build a 30 s project from three library clips, a logo and a text layer; play it without visible desync; split and trim with mouse and keyboard.
- Export an MP4 that plays in the browser and in the OS player, and that the Instagram adapter accepts (`media_ready`).
- A clip the browser cannot decode is refused with a clear message at the moment it is added.
- Leaving the page during export asks for confirmation; cancelling leaves no media record behind; a failed upload can be retried without rendering again while the dialog is open.
- The exported file attached to an approved revision does not change when the project is edited later.
- Isolation per brand and action per base.md 5.6; an external user reaches no project.
- Usable on desktop; below 1024 px a clear read-only message; every clip reachable by keyboard from the clip list.

## Implementation status

**MVP delivered in code on 2026-11-17** (tasks VE-01 to VE-05 of [../implementation-plan.md](../implementation-plan.md)). The documents and registries were written first, then the code. **Nothing was used in a browser with a signed-in user**, so no MP4 has been exported yet: the in-browser export, which the skipped spike was meant to measure, is unverified.

Migration and tests:

- `20261117200000_video_editor.sql`: the four `video.*` actions and their role seeds, usage type `video_project_version`, tables `video_projects`, `video_project_versions`, `video_exports` (RLS, `select` only, composite foreign keys), trigger `video_project_versions_immutable`, `video_assert_document` (shape, brand and kind of every file, duration, limits), `video_project_lock`, `video_project_create`, `video_project_save_draft`, `video_project_rename`, `video_project_save_version` (writes the usages), `video_project_set_trashed`, `video_project_record_export` (an available `video/mp4` of the same brand uploaded by the caller), `audit_write` with the five `video.*` actions.
- pgTAP `33_video_editor.test.sql` (34 assertions: creation, names and presets, unlinked brand, empty version, conflict, file of another brand, wrong kinds, minimum clip, document version, background, 90 s limit, size limit, rename, saved version and its duration, usages, export rules, collaborator cannot trash, immutability, audit, trash, brand isolation, external user, `anon`); `01_auth_roles_profiles.test.sql` now counts 63 actions.

Code:

- `src/lib/shared/video/`: `types.ts`, `schemas.ts`, `timeline.ts` (pure operations: starts, duration, split, trim, move, reorder, active clips, fades, snapping), `timeline.test.ts` (21 Vitest cases), `labels.ts`, `compose.ts` (the frame compositor shared by preview and export), `text-raster.ts`, `preview.ts`, `probe.ts` (decodability and duration with Mediabunny, export support check), `audio-mix.ts` (`OfflineAudioContext`), `export-protocol.ts`, `export.worker.ts` (decode with `CanvasSink`, composite on `OffscreenCanvas`, H.264 with `CanvasSource`, AAC with `AudioSampleSource`, MP4 with `fastStart: "in-memory"`), `video.functions.ts` (9 server functions).
- `src/hooks/shared/video/`: `use-video-editor.ts` (history and selection), `use-video-sources.ts` (signed URLs refreshed every 4 minutes), `use-video-playback.ts` (canvas preview, hidden media elements kept in sync, clock), `use-video-adders.ts`, `use-video-shortcuts.ts`, `use-video-export.ts`, `use-is-desktop.ts`; `src/hooks/shared/use-draft-autosave.ts` (generic, shared with the designs).
- `src/components/shared/video/`: `videos-page.tsx`, `new-video-dialog.tsx`, `video-editor-page.tsx`, `video-workspace.tsx`, `video-toolbar.tsx`, `video-player.tsx`, `video-timeline.tsx`, `video-timeline-clip.tsx`, `video-properties-panel.tsx`, `video-text-properties.tsx`, `video-timing-fields.tsx`, `video-clip-list.tsx`, `video-export-dialog.tsx`.
- Routes `src/routes/admin/_app/(marketing)/marketing/videos/` (`index.tsx`, `$projectId.tsx`), menu item "Vídeos", `Action.Video`, `AuditAction.Video` and labels (audit domain "Vídeos"), `QueryKey.Video`, `AppRoute.Videos`, five error codes in `errors.ts`, `check:consistency` (`video_projects.preset`), `routeTree.gen.ts`, `e2e/auth-guards.spec.ts` (the list route without a session). Dependency: `mediabunny` ^1.66.0 (MPL-2.0, last published 2026-11-13, one maintainer).
- `database.types.ts`: the blocks of the three tables and eight functions were produced by the offline generator (`npm run db:types:offline`) and inserted into the file generated from the linked project, because the migration is not applied there yet. Regenerate it with `node scripts/db-types.mjs --linked` after `db push`.

Validation performed (2026-11-17): `npm run db:verify` (1243 assertions, 0 failures, PGlite), `npm run check:consistency`, `npm run check:docs`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` (357 tests), `npx vite build` (the worker is emitted as its own chunk of about 580 kB, loaded only when exporting), `npx playwright test e2e/auth-guards.spec.ts` (the new videos route redirects without a session; the older login-form test failed once and passed on the rerun, the same flakiness recorded in [image-editor.md](image-editor.md)).

**Not tested:** none of the acceptance criteria of section 9. In particular, never exercised in a browser: creating a project, adding clips and the HEVC refusal, the preview and its sync, the timeline drag, trim and snapping, split, the clip list and the keyboard, autosave and the conflict between two tabs, and **the whole export** (fetching the originals, the audio mix, the worker, H.264/AAC encoding, the size check, the upload, the record, cancel and retry, the time it takes on the team's machines). The MP4 was never checked against the Instagram adapter. `supabase test db` on Docker was not run.

The migration was **not applied** to the linked project (Compasso, production); applying it is a separate decision (`npx supabase db push`), after which the types should be regenerated.

Known gaps and pending items:

- The preview reads frames from `<video>` elements and the export from `CanvasSink`; both need the CORS `GET` rule of the private bucket ([../spaces/r2-storage.md](../spaces/r2-storage.md) section 6), the same rule the image editor needs. Without it the preview stays on the background color and the export fails while preparing.
- The export downloads every source file whole into memory before rendering (also to decode their sound); with several large originals this can use a lot of memory. Not measured.
- The music track takes the sound of a library video; audio files in the library need their own decision (section 3).
- Overlays and texts are positioned with numeric fields; dragging them on the player is "later" (section 4.2). There is no list of saved versions yet; every export saves one.
- A clip whose source file was deleted after it was added shows the background color; nothing warns about it yet.
- `lost-ui` has no timeline component; the timeline stays in the app (CLAUDE.md item 10). No request was filed.

Sources: [web.dev: CapCut case study](https://web.dev/case-studies/capcut), [Mediabunny](https://mediabunny.dev/), [Mediabunny introduction](https://mediabunny.dev/guide/introduction).
