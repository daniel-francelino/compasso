# Module — Channels

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (tab "Canais" of a brand: `/admin/marketing/brands/$brandId/channels`).

## Goal and scope

A channel is a **concrete profile or destination of a brand**: "@cafeaurora on Instagram", "Café Aurora on LinkedIn", the brand's blog or newsletter. A brand can have at most one active channel per platform. Archived channels remain available as history and free the platform slot for a replacement.

**Registering a channel does not mean there is an authenticated integration with the platform.** In the MVP channels are descriptive: they classify the channel rows of contents, drive previews and calendar filters. Automatic publishing and token management are a separate future project.

Included: register, edit, archive, preview rules per platform. Not included: OAuth connections, token renewal, metrics, scheduling through platform APIs.

## Channel record

| Field | Rule |
|---|---|
| Brand | Required; fixed after creation |
| Platform | Required; one of `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube`, `x`, `pinterest`, `threads`, `email`, `blog`, `other` (constant `Platform`, same list as the `CHECK`) |
| Profile name | Required; for example `@cafeaurora` (the "@" is normalized) |
| Profile URL | Optional; `https` only |
| External identifier | Optional; an id on the platform, for reference |
| Notes | Optional, internal |
| Status | Active or archived |

The channel editor UI allows at most one active channel per platform for a brand. This is a front-end workflow rule; the current database uniqueness constraint remains `(platform, lower(profile_name))` among active channels, so writes outside this UI are not protected by the one-channel-per-platform rule.

## Platform rules (preview and validation guidance)

Each platform has a descriptor in `shared/preview` used by the content editor (the formats offered per channel row) and the portal preview. They are **guidance**, not enforcement of platform limits (which change); the team can override with a warning.

| Platform | Formats offered | Caption guidance | Preview |
|---|---|---|---|
| Instagram | image, carousel, video, story, reel | ~2,200 characters; first 125 visible before "mais" | Feed image 4:5; story/reel 9:16; caption truncation and carousel controls |
| Facebook | text, image, carousel, video, story, reel | Long text allowed | Image/carousel 1:1; video 16:9; story/reel 9:16 |
| LinkedIn | text, image, carousel, video, article | ~3,000 characters; first lines visible | Image/carousel 4:5; video/article 16:9 |
| TikTok | video, reel | ~2,200 characters | Vertical 9:16 player |
| YouTube | video, reel, text | Title + description | Video 16:9; Short 9:16 |
| X | text, image, video | ~280 characters | Image 1:1; video 16:9 |
| Threads | text, image, carousel, video | ~500 characters | Feed image/video 4:5 |
| Pinterest | image, carousel, video | Description | Pin 2:3; full-screen video 9:16 |
| Email | text, article, image | Subject + body | Email card with 16:9 media |
| Blog | article, text, image | Title + body | Article card with 16:9 media |
| Other | all formats | None | Generic square; immersive formats use 9:16 |

The shared `ChannelPreview` keeps the original media files, uses platform-and-format frame guidance, gives video its native controls, and provides keyboard-accessible carousel controls. Ratios are common preview targets rather than a promise of exact rendering; platforms may crop, expand or adapt media depending on placement and device.

The descriptors live in code (`Platform` constants with format, limits and preview component) and are the single source for the editor, the validation warnings and the portal.

## Screens and flows

- **Channels tab:** active platforms appear in a compact, responsive grid of square platform cards, with one card per platform and one active profile slot per card, ordered by social usage priority: Instagram, TikTok, Facebook, YouTube, LinkedIn, X, Threads, Pinterest, then E-mail, Blog and Outro. Each card uses the platform SVG mark (`PlatformIcon`); Outro uses a neutral globe mark. Clicking a card creates or edits its single channel. The profile name is shown when present, otherwise `-`; the card has no create/edit prompt. Configured channels retain their actions menu. Only active channels are displayed on this screen; archiving removes the channel from the grid.
- **Create/edit:** the existing sheet (`EditorSheet`) keeps profile name, URL, identifier and notes. Choosing an empty platform card supplies the platform; editing a configured card retains it. No new channel fields are introduced.
- **Archive:** archiving blocks **new** planned items on the channel; channel rows already planned or published stay linked to it and visible; a channel with planned (not yet published) rows lists them first and requires the person to confirm or reassign them. Archived channels are hidden from this screen.
- **Delete:** only a channel never used by any content channel row; otherwise archive.
- When a brand is created, the screen offers "Adicionar canais agora" but it is optional.

## Rules

1. A content channel row must reference an **active** channel of the **same brand** when it is planned or sent for approval (composite FK `(channel_id, brand_id)` guarantees the brand; a trigger guarantees the active status).
2. An archived channel is shown with a badge on existing channel rows; it cannot be chosen for new ones.
3. Changing the platform of a channel in use is refused (create a new channel instead); changing the profile name or URL is allowed and audited.
4. Registration never contacts the platform; no secrets are stored here.
5. Audit: `channel.created/updated/archived/reactivated/deleted`.

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

`channels` as in [../reference/data-model.md](../reference/data-model.md) section 4 (`unique (id, brand_id)`, partial index on active channels). The database currently permits multiple active profiles per platform; the one-active-channel-per-platform rule is enforced only by the channel grid UI.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `channels.view` | See the channels of linked brands | — |
| `channels.create` | Register channels | `channels.view` |
| `channels.update` | Edit, archive, reactivate | `channels.view` |
| `channels.delete` | Delete unused channels | `channels.update` |

External users never read channels directly; the portal receives only the platform name, icon and profile name of the channels used by the contents shared with them.

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`channel_duplicate`, `channel_in_use`, `channel_archived`, `platform_change_forbidden`, `conflict`, `denied`.

## Acceptance criteria

- A brand's active channel grid has exactly one card per platform; an unused platform card starts creation and a configured card opens that channel for editing.
- The active channel grid is ordered with the most-used social platforms first and displays an SVG mark for each platform.
- Archived channels do not appear in the channels screen or occupy an active platform card.
- A content channel row cannot be planned on an archived channel or on a channel of another brand (UI and database).
- Archiving a channel keeps the history of channel rows linked to it.
- No channel registration triggers external calls.
- The portal shows the preview of each channel according to its channel's platform descriptor.


## Implementation status

Phase 1 (task P1-06, 2026-10-18) plus platform grid update (2026-10-19). Same migrations as [clients.md](clients.md); no migration added or changed. Files: `src/lib/marketing/channels/*`, `src/lib/shared/preview/platforms.ts`, `src/components/marketing/channels/*`; route `/admin/marketing/brands/$brandId/channels`.

Done: active channel grid, create/edit in a sheet, handle normalization (@), duplicate rule among active channels, archive and delete; responsive square platform cards with SVG marks, one active channel slot per platform in this UI, and channel actions retained on configured cards. Archived channels are excluded from this screen; it has no reactivation control. The generic "Outro" platform uses a neutral globe SVG. A platform preselected from the grid is the initial form value and does not mark a new channel as dirty. Validation performed: `npm run typecheck`, targeted ESLint, `npm run check:consistency`, `npm run check:docs`, and `git diff --check`. **Not tested**: Vitest and production build could not start because the environment returned `spawn EPERM` (the build also could not load the Tailwind native binding); browser behavior and real Supabase. The one-channel-per-platform rule is a front-end rule and is not guaranteed by the database. No migration was added or changed. **Pending (phase 3)**: variant counters, `channel_is_used`, the preview components per platform and the "planned variants" confirmation when archiving.

2026-10-19: Compacted the platform cards and aligned the grid with the one-profile-per-platform flow: each tile shows a single profile or "-" and is directly clickable for create/edit, while configured channel actions remain in the overflow menu. Validation performed: targeted ESLint, typecheck, `check:consistency`, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser layout.

2026-10-20: Shared channel previews now choose their media frame by platform and format, matching the format options configured in `platformFormats`. Supported formats are covered by a table-driven aspect-ratio test. Files: `src/lib/shared/preview/platforms.ts`, `platforms.test.ts`, `src/components/shared/preview/channel-preview.tsx`. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: Vitest could not start because esbuild returned `spawn EPERM`; visual comparison with each live platform app.

2026-10-20: Instagram feed posts ("Post" and "Carrossel") no longer use a fixed 4:5 frame: `previewFrameRatio` takes the width and height of the first file and clamps its ratio between 4:5 (tallest) and 1.91:1 (widest), the range the network accepts (square and landscape posts show whole); without dimensions it falls back to the table, and Story, Reel, Video and the other platforms keep their fixed frame. Only the portal passes the dimensions (the editor and the internal approval screen do not have them yet, so they still show 4:5). Files: `platforms.ts`, `channel-preview.tsx`, `revision-view.tsx`, `request-preview.tsx`, `portal-approval-page.tsx`. Validation performed: see the portal entry. **Not tested**: other platforms' real ranges (Facebook, LinkedIn, X, Threads keep one fixed frame); a visual comparison with the live app.
