# Module — Video editor (proposal)

> **Status: proposal, not decided, no code.** Reverse engineering of CapCut and a feasibility analysis for a timeline video editor inside Aura Creative ("Editor de Vídeo" in the UI). Every name in section 5 is a **proposed name**: none is in [../reference/](../reference/README.md) yet and none may be used in code until the proposal is approved and registered (GOLD-4). The sister document for images is [image-editor.md](image-editor.md); this one reuses its document model and storage decisions. UI copy is Brazilian Portuguese; everything else is English.

## 1. Goal and verdict

Let the team assemble short vertical or square videos (Reels, Stories, feed video) from clips already in the media library: cut, order, add text, music and a logo, and export an MP4 that Instagram accepts, without leaving the platform.

| Question | Answer |
|---|---|
| Can an editor **in the style of CapCut** exist in this project? | **Partly.** A basic editor (trim, split, reorder, text, image overlay, audio track, export to MP4) is feasible **in the browser**. It is a harder and riskier project than the image editor. |
| Can it be **CapCut itself** (effects, transitions library, keyframes, auto-captions, AI, templates, 4K multi-track)? | **No.** CapCut is a C++ engine compiled to WebAssembly by a large team. Not realistic here. |
| Can it run on the **server** (Vercel)? | **No.** The architecture says "no FFmpeg on Vercel" ([../technical-architecture-v0.1.md](../technical-architecture-v0.1.md) section 11.4) and functions have time, memory and body limits. Server rendering would need a **new component** (a render worker), which is a larger decision (section 3, V4). |
| Does it fit the rules? | Yes for a browser-only editor, with **four decisions** to change first (section 3, V1 to V4). |
| Estimated size (one developer, estimate not a measurement) | MVP of section 4.1: about 10 to 14 weeks, after a 2-week technical spike that decides whether to continue. |

Recommended path: do the **spike first** (section 7, phase 0). If decoding, compositing and exporting a 30-second 1080×1920 clip works acceptably on the team's real machines and browsers, build the MVP in the browser on WebCodecs. If it does not, stop; the fallback is not a weaker editor but **not building it** and linking to an external tool.

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

| ID | Rule or decision | Effect on this proposal | Resolution |
|---|---|---|---|
| V1 | [../spaces/media-library.md](../spaces/media-library.md) section 1: "Not included in the MVP: advanced image/video editing … video transcoding" | The editor is both | **GOLD-3: change the document first** (base.md 9.1), same wording as D1 in [image-editor.md](image-editor.md). The library stays storage; the editor reads and writes through it |
| V2 | Media library section 7: video up to **100 MiB**, single `PUT`, URL valid about 10 minutes; [../audits/media-video-upload.md](../audits/media-video-upload.md) F11 (large uploads not measured) | Source clips fit; an exported 1080p video of 60 seconds is typically 20 to 60 MiB, inside the limit, but long projects are not | Keep 100 MiB for the MVP; cap project duration (suggestion: 90 s) so the export stays under it; **multipart upload** (already planned in phase 6) becomes a prerequisite for anything longer |
| V3 | Media library: "the codec is **not** verified, no transcoding"; Instagram needs MP4 | The editor **is** the first place that produces a controlled codec | Export H.264 + AAC in MP4 so the result always passes the Instagram adapter. Imported clips may be HEVC (iPhone) that the browser cannot decode (audit F1): the editor must say so and refuse that clip, not fail silently |
| V4 | ADR-14 and architecture 11.4: "no FFmpeg on Vercel"; Vercel functions have limited time, memory and body size | Server rendering is excluded by the current architecture | **The editor renders in the browser only.** A server render worker (a container on a separate service) would be a new ADR with cost, secrets and queue design; not proposed here |
| — | ADR-13: "persistent queue only in the automatic-publishing phase" | Not needed while rendering is client-side | Fits |
| — | GOLD-8, immutable versions | Fits | A saved project is an immutable version; the exported MP4 is an immutable media version; an approved revision keeps pointing to the media version |
| — | SEC-7 uploads | Fits | The export goes through the normal `requestUpload` / `confirmUpload`; the server checks the container signature as it does for every video |
| — | SEC-8, SEC-12 | Fits | No HTML from users; project JSON holds ids and numbers, no personal data beyond what text layers contain |
| — | UI-7 and UI-8 | A timeline editor is not usable at 360 px; a timeline is hard to make accessible | **Desktop only** (decision to record); keyboard shortcuts for play, split, nudge, delete; a clip list as the accessible alternative; reduced-motion respected |
| — | Spaces and `lost-ui` | Same as the image editor | Module in `shared/video-editor`; panels and forms from `lost-ui`; the timeline is app-specific unless the library owner wants it |
| — | CODE-7, 600-line limit | Editors grow fast | Split by feature (timeline, player, export, tools) from the first commit |

## 4. Proposed scope

### 4.1 MVP (only after the spike passes)

- One project = one canvas preset (9:16, 4:5, 1:1) at 30 fps, **up to 90 seconds**.
- Tracks: one main video track, one overlay track (image or logo), one text track, one audio track.
- Clips from the media library (MP4/MOV/WebM the browser can decode) and images; trim, split, delete, move, reorder, snap; position, scale and opacity of overlays; volume.
- Text layers with a start and an end, a curated font list shared with the image editor, one style per layer.
- Optional fade in/out.
- Play, pause, scrub, frame step; undo/redo; draft autosave with `version`.
- Export: MP4 (H.264 + AAC), 1080 px on the long side, 30 fps; progress, cancel, and the result attached to a content item.

### 4.2 Later

Cross-fade transitions, speed, crop/mask, voice-over recording, per-brand templates, proxies for large clips, multipart upload, subtitle import (SRT), reuse of image-editor designs as overlays.

### 4.3 Out

Effects and filters library, keyframes, AI and auto-captions, 4K, multi-camera, collaboration, a music catalog, a server render worker.

## 5. Proposed technical design

### 5.1 Building blocks

| Concern | Proposal | Notes |
|---|---|---|
| Decode | WebCodecs `VideoDecoder`, fed by a demuxer | Hardware accelerated; confirm browser support (section 6) |
| Container read/write | **Mediabunny** (TypeScript library for reading, writing and converting media with WebCodecs) | Recommended over ffmpeg.wasm; its own published benchmarks show it far ahead, but those are the vendor's numbers: re-measure in the spike. Check license and maintenance before adding (CODE-12) |
| Composite | A 2D canvas first; WebGL only if the spike shows 2D is too slow | Konva is **not** used for the video frame; the timeline UI is plain React |
| Encode | WebCodecs `VideoEncoder` (H.264) and `AudioEncoder` (AAC) | Fallback to ffmpeg.wasm only if a target browser lacks AAC or H.264 encoding, accepting it is slow and CPU-heavy |
| Audio | Web Audio API for preview mixing; offline mixing for export | The audio clock drives playback |
| Heavy work | A Web Worker (and `OffscreenCanvas`) so decoding and encoding never block the UI | Required, not optional |
| Timeline UI | React components, virtualized ruler and clips with `@tanstack/react-virtual`, drag with `@dnd-kit` (both already installed) | Keyboard-first operations |

### 5.2 Document model (proposed)

Same principles as [image-editor.md](image-editor.md) section 5.2: JSON validated by zod, closed set of clip and track kinds, assets by media version id, operations with undo/redo, immutable saved versions. Time is stored as **integer milliseconds** (never floats, never `Date`); frame positions are derived from the project fps.

### 5.3 Data (proposed names, not registered)

| Proposed | Purpose |
|---|---|
| `video_projects` | One row per project: brand, name, preset, fps, `current_version_id`, `version`, `trashed_at`. Composite foreign keys with the brand |
| `video_project_versions` | **Immutable** saved states: `document` (jsonb, size-capped), duration, author |
| `video_exports` | Link between a project version and the media version it produced |
| Actions | `video.view`, `video.create`, `video.update`, `video.delete`; export also requires `media.upload` |
| Audit | `video.created`, `video.exported`, `video.deleted` through `audit_write` |
| Error codes | `video_project_invalid`, `video_too_long`, `video_codec_unsupported`, `video_export_failed` |
| Server functions | `saveVideoProjectVersion`, `listVideoProjects`, `getVideoProject`, `exportVideoProject` (records the link; bytes use the media upload path) |

All with RLS combining the action and the brand scope, nothing for external users, and no `portal_*` function exposing a project; the portal only sees the exported media of a revision.

### 5.4 Flow

1. Create a project from a preset; choose clips through `MediaPicker`. The editor works on the **display or proxy copy** where one exists and on the original only to export.
2. Edit; autosave with `version`; conflicts keep the work.
3. Export in a worker: decode → composite → encode → mux; the progress bar is real; closing the tab cancels (warn with the existing unsaved/uploading prompt).
4. Upload the MP4 through the upload tray (`UploadTrayProvider`) as a normal file; attach to the content item; the revision freezes the media version.

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Browser support** of WebCodecs (video and especially audio encoding; Safari and Firefox differ and change quickly) | The editor works for some people only | Verify the real support matrix **at spike time** on caniuse and on the team's machines; declare supported browsers (Chromium first); detect and show a clear message |
| HEVC and uncommon codecs from phones (audit F1) | A clip cannot be decoded | Probe with `VideoDecoder.isConfigSupported`; refuse with a clear message; do not transcode |
| Performance and memory (a long timeline decodes a lot) | Tab freezes or crashes | 90 s cap, one or two decoders alive at a time, proxies later, worker-based pipeline, measure in the spike |
| Frame accuracy and A/V sync | Audio drifts from the picture | Audio is the master clock; integer-millisecond model; test with variable-frame-rate phone videos |
| Export on a weak machine | Takes minutes or fails | Progress and cancel; document minimum hardware; no promise of speed |
| Output larger than 100 MiB or upload failing | Export is lost (audit F11) | Duration cap; keep the exported blob in memory until the upload is confirmed; multipart upload as a prerequisite for longer videos |
| Music and font licensing | Legal exposure | User uploads only; no catalog; curated open-license fonts |
| Effort underestimated | Weeks lost | Phase 0 spike with a go/no-go before any migration or route is created |
| Maintenance cost | A niche editor needs continuing care as browsers change | Accept explicitly, or do not build |

## 7. Phases (estimates, to be re-estimated after the spike)

| Phase | Content | Estimate |
|---|---|---|
| 0 | Decisions V1 to V4 recorded. **Spike** in a throwaway branch: decode two clips, composite text and a logo, export 30 s of 1080×1920 H.264/AAC in a worker on the team's machines and browsers. Go/no-go written in this document | 2 weeks |
| 1 | Document model, timeline UI, player, undo/redo, save/load, migration and pgTAP | 4 to 5 weeks |
| 2 | Export pipeline in a worker, upload and attach to content, progress and cancel | 3 to 4 weeks |
| 3 | Accessibility pass, keyboard shortcuts, browser matrix, tests, polish | 2 to 3 weeks |

## 8. Decisions needed (open)

1. Approve the change to media-library section 1 (V1)? Recommendation: yes, only together with a passed spike.
2. Browser-only rendering (V4)? Recommendation: yes; a render worker is a separate proposal.
3. Duration cap of 90 s and 100 MiB until multipart upload exists (V2)? Recommendation: yes.
4. Supported browsers (Chromium only at first)? Recommendation: yes, written in the screen.
5. Desktop only? Recommendation: yes.
6. Is the effort worth it compared with linking to an external editor and importing the result through the library? **Recommendation: decide after the spike, with its measurements.**

## 9. Acceptance criteria (for when it is built)

- Build a 30 s project from three library clips, a logo and a text layer; play it without desync; split and trim with mouse and keyboard.
- Export an MP4 that plays in the browser, in the OS player and that the Instagram adapter accepts (`media_ready`).
- A clip the browser cannot decode is refused with a clear message at the moment it is added.
- Closing the tab during export warns; cancelling leaves no media record behind; a failed upload can be retried without re-rendering while the tab is open.
- The exported file attached to an approved revision does not change when the project is edited later.
- Isolation per brand and action per base.md 5.6; an external user reaches no project.
- Usable on desktop; below the supported width a clear message; a clip list reachable by keyboard.

## Implementation status

Not started. This document is a proposal written on 2026-11-16. No code, migration or registry entry exists. Nothing was tested or measured: the viability of in-browser export on the team's machines is **the** open question and is answered only by the phase 0 spike. Statements about CapCut come from one vendor case study plus inference; the library performance claims are the vendors' own.

Sources: [web.dev: CapCut case study](https://web.dev/case-studies/capcut), [Mediabunny](https://mediabunny.dev/), [Mediabunny introduction](https://mediabunny.dev/guide/introduction).
