# Module — Channels

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (tab "Canais" of a brand: `/admin/marketing/brands/$brandId/channels`).

## Goal and scope

A channel is a **concrete profile or destination of a brand**: "@cafeaurora on Instagram", "Café Aurora on LinkedIn", the brand's blog or newsletter. A brand can have at most one active channel per platform. Archived channels remain available as history and free the platform slot for a replacement.

**Registering a channel does not mean there is an authenticated integration with the platform.** In the MVP channels are descriptive: they classify variants, drive previews and calendar filters. Automatic publishing and token management are a separate future project.

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

Each platform has a descriptor in `shared/preview` used by the variant editor and the portal preview. They are **guidance**, not enforcement of platform limits (which change); the team can override with a warning.

| Platform | Formats offered | Caption guidance | Preview |
|---|---|---|---|
| Instagram | image, carousel, video/reel, story | ~2,200 characters; first 125 visible before "mais" | Square/portrait frame, caption truncation, carousel dots |
| Facebook | image, carousel, video, text | long text allowed | Feed card |
| LinkedIn | image, carousel (document), video, text, article | ~3,000 characters; first lines visible | Feed card |
| TikTok | video | ~2,200 characters | Vertical frame |
| YouTube | video | title + description | Thumbnail + description |
| X / Threads | text, image | ~280 / ~500 characters | Post card |
| Pinterest | image | description | Pin |
| Email | text, image | subject + body | Email card |
| Blog | article, image | title + body | Article card |
| Other | any | none | Generic card |

The descriptors live in code (`Platform` constants with format, limits and preview component) and are the single source for the editor, the validation warnings and the portal.

## Screens and flows

- **Channels tab:** active platforms appear in a responsive grid of square platform cards, ordered by social usage priority: Instagram, TikTok, Facebook, YouTube, LinkedIn, X, Threads, Pinterest, then E-mail, Blog and Outro. Each card uses the platform SVG mark (`PlatformIcon`); Outro uses a neutral globe mark. Clicking a card creates or edits its channel. The profile name is shown when present, otherwise `-`; the card has no create/edit prompt. Archived history remains in the archived list.
- **Create/edit:** the existing sheet (`EditorSheet`) keeps profile name, URL, identifier and notes. Choosing an empty platform card supplies the platform; editing a configured card retains it. No new channel fields are introduced.
- **Archive/reactivate:** archiving blocks **new** planned items on the channel; variants already planned or published stay linked to it and visible; a channel with planned (not yet published) variants lists them first and requires the person to confirm or reassign them.
- **Delete:** only a channel never used by any variant; otherwise archive.
- When a brand is created, the screen offers "Adicionar canais agora" but it is optional.

## Rules

1. A variant must reference an **active** channel of the **same brand** when it is planned or sent for approval (composite FK `(channel_id, brand_id)` guarantees the brand; a trigger guarantees the active status).
2. An archived channel is shown with a badge on existing variants; it cannot be chosen for new variants.
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

External users never read channels directly; the portal receives only the platform name, icon and profile name of the channels used by the variants shared with them.

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`channel_duplicate`, `channel_in_use`, `channel_archived`, `platform_change_forbidden`, `conflict`, `denied`.

## Acceptance criteria

- A brand's active channel grid has exactly one card per platform; an unused platform card starts creation and a configured card opens that channel for editing.
- The active channel grid is ordered with the most-used social platforms first and displays an SVG mark for each platform.
- Archived channels remain accessible in the archived list and no longer occupy the active platform card.
- A variant cannot be planned on an archived channel or on a channel of another brand (UI and database).
- Archiving a channel keeps the history of variants linked to it.
- No channel registration triggers external calls.
- The portal shows the preview of the variant according to its channel's platform descriptor.


## Implementation status

Phase 1 (task P1-06, 2026-10-18) plus platform grid update (2026-10-19). Same migrations as [clients.md](clients.md); no migration added or changed. Files: `src/lib/marketing/channels/*`, `src/lib/shared/preview/platforms.ts`, `src/components/marketing/channels/*`; route `/admin/marketing/brands/$brandId/channels`.

Done: list by status, create/edit in a sheet, handle normalization (@), duplicate rule among active channels, archive/reactivate, delete; responsive square platform grid with platform SVG marks, one active channel slot per platform in this UI, and channel actions retained on configured cards. The generic "Outro" platform uses a neutral globe SVG. A platform preselected from the grid is the initial form value and does not mark a new channel as dirty. Validation performed: `npm run typecheck`, `npm run lint -- --no-cache`, `npm run check:consistency`, `npm run check:docs`, and `git diff --check`. **Not tested**: Vitest and production build could not start because the environment returned `spawn EPERM` (the build also could not load the Tailwind native binding); browser behavior and real Supabase. The one-channel-per-platform rule is a front-end rule and is not guaranteed by the database. No migration was added or changed. **Pending (phase 3)**: variant counters, `channel_is_used`, the preview components per platform and the "planned variants" confirmation when archiving.
