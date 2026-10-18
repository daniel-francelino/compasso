# Module — Channels

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (tab "Canais" of a brand: `/admin/marketing/brands/$brandId/channels`).

## Goal and scope

A channel is a **concrete profile or destination of a brand**: "@cafeaurora on Instagram", "Café Aurora on LinkedIn", the brand's blog or newsletter. Two Instagram profiles are two channels. A brand can exist before its channels are registered.

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

Uniqueness: among **active** channels of the same brand, `(platform, lower(profile_name))` is unique.

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

- **Channels tab:** table with platform icon (`ChannelIcon`), profile name, link, status, number of variants planned/published. Main action "Novo canal". Filter by platform and status.
- **Create/edit:** a sheet (`EditorSheet`) with platform, profile name, URL, identifier and notes.
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

`channels` as in [../reference/data-model.md](../reference/data-model.md) section 4 (`unique (id, brand_id)`, partial index on active channels). Indexes: `(brand_id) where archived_at is null`, unique `(brand_id, platform, lower(profile_name)) where archived_at is null`.

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

- Two Instagram profiles of the same brand coexist as two channels; the same profile cannot be registered twice while active.
- A variant cannot be planned on an archived channel or on a channel of another brand (UI and database).
- Archiving a channel keeps the history of variants linked to it.
- No channel registration triggers external calls.
- The portal shows the preview of the variant according to its channel's platform descriptor.


## Implementation status

Phase 1 (task P1-06, 2026-10-18). Same migrations as [clients.md](clients.md); `src/lib/marketing/channels/*`, `src/lib/shared/preview/platforms.ts` (descriptors: caption limits, @ prefix), `src/components/marketing/channels/*`; route `/admin/marketing/brands/$brandId/channels`.

Done: list by status, create/edit in a sheet, handle normalization (@), duplicate rule among active channels, archive/reactivate, delete. Validation performed: SQL assertions (duplicate, https URL, platform list, archived name reuse). **Not tested**: real Supabase, browser. **Pending (phase 3)**: variant counters, `channel_is_used`, the preview components per platform and the "planned variants" confirmation when archiving.