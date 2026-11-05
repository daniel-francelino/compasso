# Module — Portal feed previews (Instagram formats)

> Functional specification. Context and conventions in [README.md](README.md). Space: `shared` (the previews are used by the portal feed and, later, by the editor in `marketing`; a space never imports from another). It details **how each Instagram format is drawn** inside the portal feed described in [portal.md](portal.md#feed-decided-2026-11-04). Platform guidance that already exists is in [channels.md](channels.md#platform-rules-preview-and-validation-guidance); this document extends it for Instagram only and does not repeat it. Created on 2026-11-04 with the person's explicit permission to add a document (DOC-3).

## Goal and scope

The portal feed must look and behave like Instagram so a client judges a post the way their followers will see it. Instagram is not one layout: a feed image, a carousel, a video, a Reel and a Story are framed, cropped and decorated differently. This document records, **per format**, what the real app shows (the "reverse engineering"), how that maps to our data, and how our component reproduces it.

Included: the anatomy of an Instagram post on mobile width and on desktop, the frame and overlays of each format, caption rules, the mapping from our data, the method to measure and keep the reference, the component split, states and acceptance criteria.

**Phased delivery (decided 2026-11-04).** For now only **Instagram** rows are drawn with the components of this document. Other platforms keep the existing `ChannelPreview` inside the same feed card and are improved one at a time: each new platform gets its own section here, with the same method, instead of a new document.

Not included: other platforms (see the phase note above), real likes, reposts, shares, saves or view counts (the feed never shows numbers that do not exist), publishing to Instagram ([instagram-publishing.md](instagram-publishing.md)), pixel-exact copies of Instagram's proprietary icons and fonts (we use our own icon set and the project fonts, matching proportions and placement only).

## Method (the "reverse engineering")

The reference is the Instagram web app and mobile app as the client sees them. Because it changes without notice, the rules below are **recorded measurements**, not Instagram's promises (same stance as `channels.md`: guidance, not enforcement).

1. **Capture** one reference per format and per case in the checklist below (portrait, square, landscape, carousel with mixed ratios, Reel, Story, long caption, collab, location). Captures are third-party UI: they are **not committed**; only the measurements and the written description go into this document.
2. **Measure** proportions, not pixels: height of the header against the media width, gaps, icon sizes against the frame, safe zones as a percentage of the frame, caption line count and where "mais" breaks.
3. **Write the rule** in the format table (section "Formats") with the date of the observation.
4. **Encode** the rule as data in `lib/shared/preview/instagram.ts` (ratios, ranges, safe-zone percentages, caption limits), one constant per rule, covered by Vitest tests like `platforms.test.ts`. The component only reads the data.
5. **Re-check** when Instagram changes (a rule row carries "Observed on" and "Verify"): a drift is fixed in the data and this document, never by a local style tweak (GOLD-2).

Capture checklist: feed image 4:5, 1:1 and 1.91:1; image outside the range (taller than 4:5, wider than 1.91:1); carousel of equal ratios; carousel whose first item differs from the others; carousel with a video item; video post; Reel; Story with and without sticker areas; caption short, two lines, long with hashtags and mentions; empty caption; collab post; post with location; post with tagged people.

## What the reference captures show (observed 2026-11-04)

Two captures were provided: the mobile-width feed and the desktop detail view.

**Feed post, mobile width (one column).**

| Part | Observed |
|---|---|
| Header | Round avatar with a gradient ring, bold username, then a muted time ("• 2 d"); a second muted line below the username holds the **location** when there is one; an overflow "⋯" at the far right. Suggested accounts add a "Seguir" button before the "⋯" |
| Media | Full width of the column, no side padding, no rounded corners inside the feed; the frame follows the media ratio within the allowed range; a small **person icon** at the bottom-left when people are tagged; for a carousel a **"›" arrow** on the right edge, a "‹" once past the first item, and the **dots below the media** (not over it) |
| Action bar | Left group: heart, comment, repost, send. Right: save. Icons are outlined, about 24 px, 44 px touch area |
| Counts | Like count in bold ("33") next to or under the bar; comment and repost counts beside their icons |
| Caption | Bold username followed by the text on the same line, truncated with "… mais" |
| Spacing | No card borders or shadows between posts on mobile; a thin separation only |

**Detail view, desktop (two columns).** Media on the left filling the height; on the right a column with the header (avatar, username, verified mark, "Seguir"), the **caption as the first comment** (with the author's avatar), hashtags in the link color, the comments list (avatar, username, text, "1 d", "Responder", "Ver tradução", a small heart per comment), then the action bar, the like count, the age ("há 5 dias") and a bottom field "Adicione um comentário…" with a disabled "Postar". The carousel has the "›" arrow on the media and the dots at the bottom of it.

Our feed adopts the mobile-width post for every screen size (single column, up to 32 rem on desktop) and the desktop two-column layout only inside the detail dialog of the review screen (see "Where each layout is used").

## Formats

Mapping from our constants (`Platform.Instagram` with `ContentFormat`): `image`, `carousel`, `video`, `story`, `reel` are the formats offered for Instagram ([channels.md](channels.md)). `text`, `article` and `other` are not offered for Instagram; if one reaches the preview (old data), it falls back to the feed image frame with the caption only and no media.

| Format | Surface it imitates | Frame | Overlays and chrome | Media kinds |
|---|---|---|---|---|
| `image` | Feed post | Ratio of the file clamped between **4:5 (0.8)** and **1.91:1**; outside the range Instagram crops to the nearest limit. Without dimensions: 4:5 (existing `previewFrameRatio`) | Header, media, action bar, caption (feed post layout) | image |
| `carousel` | Feed post, several items | The **first item sets the frame for all items** (same clamp as `image`); the others are cropped to it | Feed post layout plus "›" and "‹" arrows, dots **under** the media, an item counter badge "1/N" at the top-right of the media | image, video (a video item plays inline, muted until tapped, no autoplay in the portal) |
| `video` | Feed video | Same clamp as `image` using the first frame dimensions; fallback 4:5. On the real app a feed video is delivered as a Reel; we keep the feed frame and mark it with the Reels glyph at the top-right | Feed post layout; the Instagram-style player (see "Video player"): no native controls, tap to pause, mute button at the bottom-right | video |
| `reel` | Reels viewer | **9:16**, drawn inside a phone-like frame (max width 20 rem) | Full-bleed media played by the Instagram-style player; bottom-left: the caption on a **single line with an ellipsis** (no username line, decided 2026-11-04), the audio line ("♪ Áudio original · username") also on a single line with an ellipsis; right rail: heart, comment, share, save, more, with the **approve and comment buttons of our feed in their place** (see "Feed actions on immersive formats"); a "Reels" label at the top-left; mute button at the top-right; a thin progress line at the bottom that can be scrubbed; **safe zones** (see below) | video |
| `story` | Story viewer | **9:16**, phone-like frame (max width 18 rem) | Segmented **progress bar** at the top (one segment per file; the current one fills while the file plays and the story moves to the next file on its own: 5 seconds for an image, the length of a video); header with avatar and username and, at the right, pause/play and mute (mute only for a video); **tap zones**: the left third goes back, the rest goes forward, and holding a press pauses; the reply bar at the bottom is drawn as a muted placeholder: the pill "Enviar mensagem" with a heart and a send icon at its right (decorative); safe zones (see below). Instagram has no caption on a Story, but when the content has one it is drawn as a **single line with an ellipsis** inside the frame, just above the reply bar (decided 2026-11-04, reverses the earlier rule); the full text is in the review | image, video |

**Safe zones (percentages of the frame height, measured, to be confirmed with the capture checklist).** Story: top about 14 % (progress bar and header) and bottom about 18 % (reply bar) are covered by interface; Reel: bottom about 22 % and right about 16 % are covered. The preview draws these areas as a dashed outline only while the option "Mostrar áreas cobertas" is on (off by default). The option lives in the **"⋯" menu of the post header**, as a dropdown checkbox item, for Reel and Story only (decided 2026-11-04; there is no button under the frame). Values are constants in `lib/shared/preview/instagram.ts`.

**Carousel rules.** Up to 20 items (the limit used in [instagram-publishing.md](instagram-publishing.md) and in Meta's carousel rule), order by `content_revision_media.position`. Items keep their own media kind. When the first item is a video, the frame is read from the video dimensions. When an item is missing or failed to load, its slot shows the existing "Prévia indisponível" and the counter still counts it. Keyboard: left and right arrows move the item; the dots are buttons with `aria-pressed` (already true in `ChannelPreview`).

**Feed actions on immersive formats.** In a Reel or a Story frame the real right rail has like, comment, share, save. Our actions (heart "Aprovar", comment, "Solicitar alteração") are **not drawn inside the frame**: they stay in the post action bar below the frame, exactly as on the other formats, so the same buttons, labels and rules apply to every format ([portal.md](portal.md#feed-decided-2026-11-04)). The right rail is drawn as non-interactive decoration (outlined icons, `aria-hidden`) so the proportions and the covered area are faithful, and it carries no counts.

## Media loading, cache and expiry (decided 2026-11-04)

The feed shows many images and videos, and signed URLs for external users last **2 minutes** ([../spaces/r2-storage.md](../spaces/r2-storage.md), rule 5, unchanged). A new signature produces a different URL, so a cached or remounted post could hold an expired URL and a failed load used to be recorded as "Prévia indisponível" for good. The rules:

| Part | Rule |
|---|---|
| Browser cache | The preview and display URLs carry `response-cache-control: private, max-age=<lifetime of the URL>` (signed in), so the browser may reuse a file while its URL lives. Originals for download are not marked |
| URL manager | One hook, `usePortalPreviewUrls` (`hooks/portal/`), owns the signing of a post. Its data is fresh for 90 s (`PORTAL_URL_STALE_MS`) and is dropped after 120 s without observers (`PORTAL_URL_GC_MS`), so an expired URL is never shown from the cache; it also returns `refresh()` |
| Failure | A first load error of an image or video asks for new URLs **once**. Only if the new URL also fails, or comes back the same, the slot shows "Prévia indisponível". A new URL clears an earlier failure. A video resumes at the second where it stopped |
| Brand logo | One query per page (`usePortalBrand`), refreshed every 90 s while the page is open; the posts receive the logo as a prop (no query per post) |
| Memory | The virtual list unmounts the posts far from the screen, which releases their `<video>` and `<img>` elements |
| Not done, needs a decision | Longer URLs (would change r2-storage rule 5); a same-origin proxy (the Vercel response limit is 4.5 MB and it costs bandwidth); keeping the files in the browser's Cache Storage across URL changes (needs read CORS on the R2 bucket, which was not verified) |

## Video player (reverse-engineered, decided 2026-11-04)

Instagram does not use the browser's native video controls. The rules below are what the app does, recorded as targets for the capture checklist.

| Behavior | Rule |
|---|---|
| Start | Plays **muted** by itself while at least 60 % of the frame is visible; pauses when it leaves the screen. With `prefers-reduced-motion` it does not start by itself and shows a play icon |
| Loop | Feed video and Reel loop. A Story does not loop: it moves to the next file |
| Tap | A tap on a feed video or Reel toggles pause; a centered play icon fades in while paused. A Story uses the tap zones (back, forward) and hold-to-pause |
| Sound | A round mute button: bottom-right on a feed video, top-right on a Reel, in the header on a Story. It starts muted and remembers the choice for that post |
| Progress | Feed video: none. Reel: a thin line at the bottom edge that can be dragged (an accessible slider "Posição do vídeo"). Story: the top segments |
| Time | No elapsed or total time is shown |
| Keyboard | The player is a button (Space or Enter toggles); the mute and pause buttons and the slider are focusable |
| Failure | The slot shows "Prévia indisponível" |

Component: `InstagramVideoPlayer` (`shared/preview/instagram`). `ChannelPreview` and the other platforms keep the native video element.

## Caption

| Rule | Value |
|---|---|
| Limit | 2,200 characters (`platformDescriptors`) |
| Visible before "mais" | About **two lines or 125 characters, whichever comes first** (today only the 125 rule exists; the two-line rule is added after the capture). "… mais" expands in place; no "menos" |
| Author | Not drawn (decided 2026-11-04): the caption starts with its own text, because the profile name is already in the post header and Instagram does not repeat it in every view |
| Line breaks | Kept; blank lines collapse to one in the collapsed state |
| Hashtags and mentions | `#tag` and `@user` are drawn in the link color token, **not clickable** (SEC-8: no links from user text in this preview) |
| Emoji | Rendered as text; no replacement |
| Empty caption | Nothing is drawn, no author line and no reserved height (case 2 of "What is drawn when parts are missing") |
| Call to action | The existing `callToAction` line stays below the caption in a muted weight, because Instagram has no such line; it is shown to the client as information |
| Counter | Only in the editor (`showCounter`), never in the portal |

## What is drawn when parts are missing (decided 2026-11-04)

A content is sent to approval at different moments ([content.md](content.md#simplified-approval-decided-2026-10-30)), so a version can have a caption, files, both, or neither. The preview must never look broken and must never pretend that something exists.

**The source of truth is the server.** `content_submit_stage` (SQL) and `submitStageOf` (`shared/editorial`) decide the kind of version when it is sent: an **art** version when the content has a caption text or working files, a **planning** version otherwise. The result is stored in the request as `stage`. The feed **reads `request.stage`** and the files and caption of the shared snapshot; it never re-derives the rule on its own (GOLD-2). The four cases are therefore exactly the two stages plus the two partial art versions:

| # | Caption | Files (art) | `stage` | What the client sees |
|---|---|---|---|---|
| 1 | yes | yes | `art` | The full post: media by format, caption |
| 2 | no | yes | `art` | The post **without caption**: header, media, action bar; no author line and no empty space where the caption would be |
| 3 | yes | no | `art` | The post with the **fallback image** (below) in the format's frame, and the caption |
| 4 | no | no | `plan` | The **planning card** (below) instead of a post, because the team is asking for approval of the planning |

Planning files (`plan_media`, references that are not the art) never count as art files: a `plan` version is always drawn as the planning card, even if it carries reference images.

**Case 3, the fallback image.** A neutral placeholder, deliberately not an invented artwork, so the client does not mistake it for the final art.

| Aspect | Rule |
|---|---|
| Frame | The same ratio the format would use without media: `previewFrameRatio(platform, format, undefined)` (4:5 for `image`, `carousel` and `video`; 9:16 for `reel` and `story`) |
| Look | Surface token (`bg-muted`), the brand logo centered at about 30 % of the frame width (the initial letter on the avatar fallback when the brand has no logo), and the line "Imagem ainda não enviada" in the muted text token under it. No decorative graphic, no stock image, no text-on-color "quote card" |
| Carousel | A single fallback slide: no arrows, no dots, no counter |
| Reel and Story | The 9:16 frame keeps its chrome (progress bar, header, bottom bar or rail) over the placeholder; a Story caption is the one line above the reply bar |
| Video | No player; the placeholder only |
| Accessibility | `role="img"` with the label "Imagem ainda não enviada", never an empty `alt`, and the placeholder is announced once |
| Component | `InstagramMediaFallback`, used by `InstagramFeedMedia` and `InstagramImmersiveFrame`; the existing `showMediaPlaceholder` branch of `ChannelPreview` is replaced by it for Instagram rows and stays for the other platforms until they are migrated |

**Case 2, no caption.** The author line is not drawn and the caption area has no height, so the action bar follows the media directly. The call to action, when the revision has one, is still shown.

**Case 4, the planning card.** Same post shell (header, action bar, comments) with the word "Planejamento" (`approvalStageLabels` for `plan`) before the date line in the header ("Planejamento · Publicação: …"; not a chip, decided 2026-11-04), and the media frame is replaced by a **planning sheet**. It reuses and extends the existing `PlanRequestSummary` (no parallel component):

| Part | Content |
|---|---|
| Planning summary | The rich text `plan_summary` (`RichTextView`), when present |
| Channels and dates | One row per channel row: platform and profile, format with its icon and label, the planned date with its zone (`formatInZone`, the zone in a tooltip when rows differ). Every planning version has a planned date on at least one row (`plan_incomplete` otherwise), so the feed sort key always exists for it |
| Planning files | Optional reference images, shown as a small strip "Arquivos de referência (N)" with the signed URLs requested on demand; clearly labeled as reference, never in a post frame |
| Not shown | Briefing, internal notes, owner, internal deadlines (as in [portal.md](portal.md)) |

The actions are the same as for any post (heart "Aprovar", comment, "Solicitar alteração"). Only the confirmation copy differs, so the client knows what is being approved: **"Aprovar este planejamento?"** with the text "Você aprova o planejamento. A produção segue e você receberá a arte para aprovar depois." An approved planning does not set the approved art version, so the same content comes back later as an art version (cases 1 to 3) and the feed shows its **latest** request in the same position of the feed (the sort key follows the planned date).

**Transitions.** The post of a content changes shape as the content moves: planning card (case 4) → fallback post (case 3) or media-only post (case 2) → full post (case 1). Each is a new request and a new version; the feed never mixes two versions of the same content.

## Header details

| Part | Rule |
|---|---|
| Avatar | The brand logo (`brandLogoUrl`), with the gradient ring only for `story` and `reel` (Instagram draws the ring when there is a story; here it is the format marker) |
| Name | Channel `profile_name` without the "@" duplicated; verified mark is never drawn |
| Age or date | The planned publication date and zone, in the same wording as the date line of the feed ("Publicação: …"); never "há 2 d" because the post is not published yet |
| Location | Not stored today. Not drawn (open decision: whether a location field is added to the channel row) |
| Collab and "Patrocinado" | Not drawn (no data) |
| Overflow "⋯" | A dropdown menu (decided 2026-11-04) with "Ver detalhes" (icon `Maximize2`; opens the review; it is the only way in, since a click on the media opens nothing; the planning card has the same menu and the other platforms a "Ver detalhes" button under the preview) and, for Reel and Story only, the checkbox item "Mostrar áreas cobertas" (icon `SquareDashed`). Without a handler it stays a decoration |
| Tagged people | Not stored; not drawn |

## Where each layout is used

| Place | Layout |
|---|---|
| Portal feed card | Mobile-width post (header, media by format, action bar of the feed, caption, comments) in one column |
| Detail dialog and review screen | Two columns from the `lg` breakpoint: media on the left, right column with header, caption as first entry, the comments thread, the action bar and the comment field; one column below `lg` |
| Calendar hover and approval cards | Existing compact `ChannelPreview` until migrated (no change in this task) |

## Component design (to be added to [../standards/design-system.md](../standards/design-system.md) when built)

All under `src/components/shared/preview/instagram/` (no `index.ts`), one component per file, data in `src/lib/shared/preview/instagram.ts`. Names are proposals recorded here so that the code does not invent them (GOLD-4).

| Component | Role |
|---|---|
| `InstagramPost` | Picks the layout by `ContentFormat` and composes header, media, the `actions` slot, caption and the `footer` slot (the feed action bar and the comments are passed in as slots, so the preview stays free of portal logic); `onOpenDetails` only feeds the item "Ver detalhes" of the header menu; a click on the media opens nothing (decided 2026-11-04) |
| `InstagramPostHeader` | Avatar, name, date line, decorative "⋯" |
| `InstagramFeedMedia` | Frame and slides for `image`, `carousel`, `video`: ratio from `previewFrameRatio` (the single source of the clamp), arrows, keyboard and swipe, dots below, counter badge, Reels glyph |
| `InstagramImmersiveFrame` | Phone-like 9:16 frame for `reel` and `story`: Story progress segments, auto-advance, hold to pause, tap zones, header controls and reply bar (with heart and send); decorative rail, audio line and scrubbable progress line for `reel`; optional safe-zone outline (switched on from the header menu) |
| `InstagramVideoPlayer` | The Instagram-style player used by feed video, carousel video, Reel and Story (see "Video player") |
| `InstagramSlide` | Chooses the player for a video and `MediaSlide` for the other kinds |
| `InstagramCaption` | Author, truncation, "… mais", hashtag and mention styling; renders nothing when the caption is empty |
| `InstagramMediaFallback` | The placeholder of case 3 in the frame of the format |
| `InstagramDetailLayout` | Two-column arrangement for the dialog. **Not built yet** (2026-11-04): the dialog still shows the review screen |

Reuse (GOLD-2): the slide components `ImageSlide`, `VideoSlide`, `UnavailableSlide` and the media skeleton were **moved** out of `channel-preview.tsx` to `shared/preview/media-slide.tsx` (`MediaSlide`, `PreviewMedia`) and are used by both, not copied; `previewFrameRatio` and `FEED_RATIO_RANGES` stay the single source of the clamp and `platforms.ts` gains no second ratio table. `ChannelPreview` keeps serving the other platforms and the editor.

Data constants (in `instagram.ts`): the clamp range, the carousel item limit, the visible caption rule, the safe-zone percentages, the maximum frame widths. No loose numbers in components.

## States

| State | Behavior |
|---|---|
| Media loading | The media skeleton with the **final frame size** (ratio is known from the snapshot dimensions), so the feed does not jump |
| Media failed or unavailable | "Prévia indisponível" in the slot; the post stays decidable |
| No media, with caption | The fallback image and the caption (case 3). The client sees "Imagem ainda não enviada" |
| Media, no caption | The post without caption (case 2) |
| No media and no caption | The planning card (case 4), decided by `request.stage = plan` |
| Video | The Instagram-style player: muted autoplay while at least 60 % of the frame is visible, loop, tap to pause, no autoplay when `prefers-reduced-motion` is set (a play icon is shown instead), failed file shows "Prévia indisponível" |
| Superseded revision | The post shows the revision that was shared; the banner of the feed states that a newer one exists |
| Very long caption | Collapsed with "… mais"; the expanded text keeps the layout and never overflows horizontally |

## Accessibility and layout

- The post is an `article` with an accessible name "{canal} · {formato} · {título}"; the action bar is a toolbar of buttons (rules in [portal.md](portal.md#feed-decided-2026-11-04)).
- Every image keeps its `alt_text`, falling back to "Imagem {n} de {total}"; videos keep `aria-label`; decorative chrome (the "⋯", the right rail, the progress bar) is `aria-hidden`, except the Story progress, which exposes "Arquivo {n} de {total}" in text.
- The carousel works by keyboard and with touch swipe; swipe never prevents vertical page scroll.
- Works at 360 px with no horizontal overflow; the phone-like frames shrink to the column width.
- Colors only from existing tokens, no new token was added: the link color of hashtags and mentions is `text-violet`, the ring of Reels and Stories is `ring-platform-instagram`, the overlays use `bg-ink` and `text-ivory`. Contrast of `text-violet` on the card surface and of `text-ivory` on the media overlays still has to be verified in a browser (UI-9).

## Acceptance criteria

- A portrait, square and landscape image show the same frame ratio Instagram uses (clamped to 4:5 to 1.91:1); a file outside the range is cropped, not distorted.
- A carousel uses the first item's frame for every item, shows arrows, dots under the media and a counter, supports a video item, and is operable by keyboard.
- A Reel and a Story render in a 9:16 phone-like frame with their own chrome; the covered-area outline is switched on from the "⋯" menu of the post header.
- A video plays muted when visible, pauses when scrolled away or on a tap, loops (Reel, feed video) and never shows the native control bar or the "0:00 / 0:10" counter; a Story moves on by itself and pauses while pressed.
- A Story with a caption shows it on a single line with an ellipsis above the reply bar; a Reel shows its caption and its audio line on one line each, with an ellipsis.
- A caption truncates as the capture shows, expands in place, and styles hashtags and mentions without making them links.
- The feed actions are the same under every format; nothing in the preview implies a like count, a share or a save that does not exist.
- A post never shifts layout while its media loads.
- Caption and files: a full post. Files only: the post without caption. Caption only: the post with the fallback image and the text "Imagem ainda não enviada". Neither (`stage = plan`): the planning card with the summary, the channels with format and planned date and zone, and the optional reference files.
- The feed decides the case from `request.stage` and the snapshot, with no second copy of the `content_submit_stage` rule.
- The fallback is visibly a placeholder, never a stock or generated artwork, and a carousel with only the fallback shows no arrows, dots or counter.
- Approving a planning shows "Aprovar este planejamento?"; the same content later appears as an art post at its place in the feed.
- Each rule in the format table has an "Observed on" date, and a Vitest test covers the ratio clamp, the carousel limit, the caption rule and the safe-zone constants.

## Open decisions

Recommendations are already the behavior written above; change them here first if the answer differs (section 9.1 of [../standards/base.md](../standards/base.md)).

1. **Other platforms in the feed.** *Decided 2026-11-04:* Instagram first; the shell (card, action bar, comments) is the same for every channel and other platforms keep `ChannelPreview` until each gets its section here.
2. **A content with several channel rows.** *Decided and built 2026-11-04:* one post per content, with chips "Instagram · Carrossel", "Facebook · Imagem" above the media to switch the row (the earliest planned date first).
3. **Feed `video`.** *Decided and built 2026-11-04:* the feed-video frame with the Reels glyph. Alternative left open: render `video` as a Reel for Instagram, which matches the real app but changes the existing `previewFrameRatio` table for Instagram.
4. **Location and tagged people.** Recommended: not drawn now. If wanted, they need new fields on the channel row (data model, editor, snapshot) and are a separate change.
5. **Look of the fallback image.** *Decided and built 2026-11-04:* the neutral placeholder with the brand logo and "Imagem ainda não enviada". Alternative left open: the caption drawn as a text card, which looks nicer but can be mistaken for the final art.
6. **Planning files in the portal.** *Resolved 2026-11-04:* no SQL change was needed. `content_freeze_revision` stores the planning files of a `plan` version in `content_revision_media`, so `request.media` already carries them; `PlanRequestSummary` now shows them as "Arquivos de referência".
7. **Caption on a Story.** *Decided 2026-11-04 (reverses the decision of the same day that hid it):* the caption is drawn as one line with an ellipsis inside the frame, above the reply bar, so the text is still reviewed; the full text is in the review screen.
8. **Verification of numbers.** The ratio range, the 20-item carousel, the 125-character rule and the safe zones need the capture checklist before being treated as verified; the official-source check of limits is also item M-preparation of [instagram-publishing.md](instagram-publishing.md).

## Implementation status

2026-11-04 (emoji and reel): in a Reel the caption/audio group sits 1 rem from the bottom edge and the decorative rail 2.5 rem above it (they were 3 rem and 6 rem); the comment field of the feed has a working emoji picker (see [portal.md](portal.md#implementation-status)). Not tested in a browser.

2026-11-04 (name removed): the profile name is no longer drawn in front of the caption nor as a bold line in the Reel frame; it stays in the post header and in the Reel audio line. Files: `instagram-caption.tsx`, `instagram-post.tsx`, `instagram-immersive-frame.tsx`, `instagram-post.test.ts`. Validation: see [portal.md](portal.md#implementation-status).

2026-11-04 (feed review pass): a Reel keeps its caption and its audio line on one line each with an ellipsis; a Story caption comes back as one line with an ellipsis above the reply bar; the action icons are 24 px (the button style used to shrink them to 16 px) with tighter padding; "Aprovado pela equipe" is no longer drawn. Validation and what was not tested: see [portal.md](portal.md#implementation-status).

2026-11-04 (player pass): the "Mostrar áreas cobertas" button moved into the "⋯" menu of the header (with "Ver detalhes"); new `InstagramVideoPlayer` and `InstagramSlide` (muted autoplay at 60 % visibility with `useInView`, loop, tap to pause with a play icon, mute button, scrubbable thin line on a Reel, no native controls or time); a Story auto-advances (5 s per image, the length of a video), pauses while pressed or with its header button, has a left-third back zone and a reply bar with a heart and a send icon; a Story never shows a caption. New hooks `use-in-view.ts` and `use-prefers-reduced-motion.ts`, constants in `instagram.ts`. Validation performed: typecheck, lint, 5 render tests in `instagram-post.test.ts`. **Not tested**: any of the playback behavior in a browser (autoplay policy, `IntersectionObserver`, hold to pause, scrubbing, the mute state, touch screens), only the server-rendered markup. The timings and the one-third back zone are targets, not measurements of Instagram.

2026-11-04: **Implemented for Instagram** together with the feed ([portal.md](portal.md#implementation-status) lists every file, migration and check). Built: `InstagramPost`, `InstagramPostHeader`, `InstagramFeedMedia` (clamped frame, carousel up to 20 items, arrows, keyboard, swipe, dots below, counter, Reels glyph), `InstagramImmersiveFrame` (Reel and Story chrome, optional covered-area outline), `InstagramCaption` (125 characters or two lines, hashtags and mentions in `text-violet`, not clickable), `InstagramMediaFallback`, the four cases of "What is drawn when parts are missing" (`feedPostKind`) and the planning card with reference files. The rules live in `src/lib/shared/preview/instagram.ts` (7 Vitest tests) and `src/lib/portal/approvals/feed.ts` (7 tests). The numbers in "Formats" (safe zones, two-line caption) are **still not measured** against the capture checklist; they are targets. **Not built**: `InstagramDetailLayout` (the two-column dialog), the capture checklist itself, a check of the numbers against Meta's reference. **Not tested**: any format in a browser, `text-violet` and `text-ivory` contrast, real media.
