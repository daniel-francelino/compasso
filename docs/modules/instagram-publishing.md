# Module — Instagram automatic publishing

> **Status: decided to build (2026-10-26, product owner: "start the implementation of all phases"); first delivery implemented the same day in code and migrations, never run against Meta or in a browser, see section 12.** This closes decision A1 (build now) and takes the recommended answer for A2 to A12 unless a row says otherwise. Decided on 2026-10-26 by the product owner: (D1) the provider token **is stored** in Supabase (encrypted) so the client authorizes once and is not asked again until the token cannot be renewed; (D2) the connection and the configuration of the account happen **in the channel** (tab "Canais"); (D3) the design already prepares the data the future **client metrics screen** will need. The other items are still proposals. It describes what is needed to publish the scheduled Instagram contents automatically, what it costs, and which documented rules it would change. It extends [channels.md](channels.md), [content.md](content.md), [calendar.md](calendar.md) and [content-publication.md](content-publication.md); it does not replace them. Names below are proposals: per GOLD-4 they enter the registries ([../reference/README.md](../reference/README.md)) in the change that implements them.

## 1. Objective

When a content is **approved** and its Instagram channel row is **planned** for a date and time, Aura Creative publishes it on the brand's Instagram account at that time, records the result (link, date, errors) and tells the team when something fails. Today the team publishes by hand and records it ("Marcar como publicado").

The same connection also **collects the data the client metrics screen will show** (account, audience and per-post results), starting on the day of the connection, because Meta keeps user-level data for a limited time (section 5.6).

Out of this document: the metrics screen itself (a future module), other platforms (the adapter is shaped so another can follow), reading or answering comments and direct messages, ads.

## 2. Where we are today

| Topic | Today |
|---|---|
| Channels | Descriptive only: a name, a URL and an optional external id. No connection, no token. Rule 4 of [channels.md](channels.md): registration never contacts the platform and stores no secret |
| Scheduling | `content_channels.planned_at` (UTC) + `planned_timezone`, status `planned`. It is an editorial date, not a promise ([README.md](README.md), shared conventions) |
| Publication | `unplanned → planned → published_manually` (or `cancelled`), recorded by `mark_published` only when the content has an approved revision. Nothing calls a social network |
| What was approved | `content_revisions.snapshot` (title, caption, channels with format, caption adjustment, date) plus the ordered `content_revision_media` rows. Immutable |
| Files | Private R2 bucket, opaque keys. Per version: original (`storage_key`, any of JPEG, PNG, WebP), `display_key` and `thumb_key` generated in the browser as **WebP** (`resize.ts`). Presigned GET URLs are generated on demand and never stored |
| Jobs | Three **daily** Vercel Cron routes (`vercel.json`: media cleanup 04:00, email outbox 08:00, due notifications 09:00), protected by `CRON_SECRET`. The Hobby plan allows one run a day ([../pending-external-setup.md](../pending-external-setup.md), S13) |
| After the post | The dashboard block "Marcar como publicado" lists approved contents whose planned time passed ([dashboard.md](dashboard.md)); `publish_content` closes the content and purges heavy files ([content-publication.md](content-publication.md)) |
| Scope decision | "Automatic publishing" is **out of the MVP** and "a separate future project" ([../technical-architecture-v0.1.md](../technical-architecture-v0.1.md) sections 2 and 23; ADR-13; [channels.md](channels.md)) |

## 3. How the Instagram API publishes (verified against Meta on 2026-10-26)

Source: Meta's page [Publish Content using the Instagram Platform](https://developers.facebook.com/docs/instagram-platform/content-publishing/) (read on the date above). Items marked **(third party)** come only from blogs and must be checked on Meta's pages before the build.

| Topic | Fact |
|---|---|
| Accounts | Instagram **professional** accounts only. The page does not say whether Business and Creator both work; **(third party)** says both do with Instagram Login. Personal accounts cannot publish by API |
| Login paths | (a) **Instagram Login** (`graph.instagram.com`; permissions `instagram_business_basic`, `instagram_business_content_publish`; an Instagram user token; **no Facebook Page needed**). (b) **Facebook Login for Business** (`graph.facebook.com`; `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`; Page access token; the Instagram account must be linked to a Page). (c) Unified Login with a Business Integration System User token |
| Native scheduling | **None.** The API publishes now. Scheduling is the application's job, so Aura Creative needs its own scheduler |
| Flow | 1) `POST /<IG_ID>/media` creates a **container** (`image_url` or `video_url`, `caption`, `media_type`). 2) `GET /<CONTAINER_ID>?fields=status_code` until `FINISHED` (values: `IN_PROGRESS`, `FINISHED`, `ERROR`, `EXPIRED`, `PUBLISHED`; Meta suggests one poll a minute for at most five minutes). 3) `POST /<IG_ID>/media_publish` with `creation_id`. A container not published within 24 hours expires |
| Media source | Meta **downloads** the file itself (cURL) from a **publicly reachable URL** at publish time. Alternative for video: resumable upload to `rupload.facebook.com`, offered only to apps using Facebook Login for Business |
| Images | **JPEG only.** MPO and JPS are not supported. Aura Creative's display copy is WebP, so a JPEG must be produced (section 5.2) |
| Types | Feed image, **carousel** (up to 20 images/videos, all cropped to the first item's ratio), **Reels** (`media_type=REELS`), **Stories** (`media_type=STORIES`). Video size, length and codec limits are **not on the page** and must be read from the Reels/Stories reference before phase 3 |
| Rate limit | 100 API-published posts per rolling 24 hours per account, a carousel counts as one, enforced at `media_publish`. **Meta's own page contradicts itself** (the carousel section says 50). The real quota is read from `GET /<IG_ID>/content_publishing_limit`; the code must read it, never assume |
| Tokens | **(third party)** short-lived token (1 h) exchanged for a long-lived one (60 days), refreshable only while still valid and at least 24 h old; an expired token needs the person to authorize again |
| Insights (metrics) | Meta's page [Insights](https://developers.facebook.com/docs/instagram-platform/insights) (read 2026-10-26): permission `instagram_business_manage_insights` with Instagram Login (`instagram_manage_insights` with the Facebook paths); account metrics are read by `period=day`; media metrics by `period=lifetime`; **user-level metrics are kept for up to 90 days**; some metrics are unavailable below 100 followers; an empty set (not zero) is returned when data does not exist; the `story_insights` webhook exists only with Facebook Login. The page is short and names only `impressions`, `reach` and `profile_views`: the **complete metric list, the demographics metrics, the deprecations and the rate limits are in the API reference and were not read**. **(third party)** Meta has been replacing `impressions` with `views` and has limited story metrics to a short window; check before the build |
| Access level | Standard Access works for accounts the app's own developers/testers manage. Publishing on **client accounts** means Advanced Access: App Review (screencasts per permission) and, **(third party)**, Business Verification |

## 4. What is needed outside the code (people and accounts)

These are the long-lead items; start them first, in parallel with development.

| ID | Item | Owner | Notes |
|---|---|---|---|
| M1 | **Meta developer account and app** (type Business) with the product "Instagram" and Business Login for Instagram enabled | Agency | Free. Needs a person with a verified Facebook profile |
| M2 | **Business Verification** of the agency in Meta Business Manager | Agency | Legal documents (CNPJ). Takes days to weeks; required for Advanced Access (third party) |
| M3 | **App Review** for `instagram_business_content_publish`, `instagram_business_manage_insights` and `instagram_business_basic` (Advanced Access). Ask for **all the scopes the product will use in the first review**, so the client authorizes once and never has to authorize again for metrics. Ask only for what is used (Meta rejects unused permissions) | Agency | Needs: privacy policy URL, terms URL, data-deletion callback or instructions URL, app icon, a screencast of the whole flow, a test account. Review commonly returns once or twice. Until approved, only the app's roles can connect accounts |
| M4 | Public **HTTPS pages**: privacy policy, terms of use, data-deletion instructions, and the OAuth **redirect URI** (production domain only; Meta does not accept localhost for live mode) | Agency + dev | Texts in Brazilian Portuguese. Pages live in the `site` space and come from the CMS |
| M5 | Each client's Instagram account is **professional** and the client person **authorizes the connection** (OAuth screen) or hands the login to the team | Client + team | Onboarding step per brand. A client without a professional account must switch it in Instagram settings (free) |
| M6 | A scheduler that can run **every few minutes** (section 5.4) | Agency | Vercel Pro, or an external free scheduler |
| M7 | Secret storage: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, token encryption key | Dev | Server only, never `VITE_` (SEC-4); entered by a person, never read by the assistant |

Development can start before M2 and M3 finish, using Standard Access on the agency's own test account, but **nothing can go live for a client until M3 is approved.**

## 5. What is needed in the product (proposal)

### 5.1 Connection and configuration of the channel (decisions D1 and D2)

The channel stays the single place where the account is connected and configured: the card in the tab "Canais" ([channels.md](channels.md)) gets a **connection panel**, opened from the card (an `EditorSheet` section, no new route).

**Connect.** Button "Conectar ao Instagram" starts OAuth (Instagram Login, no Facebook Page) asking for **all the scopes of section 4 (M3) at once**. The callback is a server route that exchanges the code, calls the long-lived exchange, reads the account id, username, account type, name, profile picture and follower count, checks that the account is professional, stores the connection and returns to the tab. The state parameter is signed and single-use (SEC-9). The client is shown Instagram's own screen and authorizes **once**.

**Store the token (D1).** The long-lived token is stored in `channel_connections`, **encrypted**, and the server **renews it automatically** before it expires. The client is asked again only when renewal is impossible (password change, access revoked in Instagram, 60 days with no renewal, scopes changed). Recommendation: Supabase Vault, or AES-GCM in the server with a key from the environment; decrypted only inside a server-only module that uses the service-role client (SEC-5 list gets one more entry). The token is never returned to the browser, never logged and never put in audit metadata (SEC-4, SEC-12).

**Configure (what the panel shows and lets the team set):**

| Block | Content |
|---|---|
| Account | Username, name, picture, account type, follower count, account id (read from Instagram, read-only); "Atualizar dados" |
| Connection | Status (`active`, `expiring`, `expired`, `revoked`), connected by and when, token expiry, scopes granted (and which are missing), button "Testar conexão", "Reconectar", "Desconectar" (revokes and deletes the token) |
| Publishing | "Publicar automaticamente" on/off for the channel (the default for new channel rows), today's quota read from `content_publishing_limit`, the lateness window (section 6) |
| Metrics | "Coletar métricas" on/off (default on), last collection and its result |
| History | Last connection events and the last failures (codes only) |

Table `channel_connections` (proposal): `channel_id`, `brand_id`, `provider`, `external_account_id`, `username`, `account_type`, `token_encrypted`, `token_expires_at`, `scopes`, `status`, `auto_publish_default`, `collect_metrics`, `connected_by`, `last_refreshed_at`, `last_error_code`; composite foreign key `(channel_id, brand_id)` (DATA-3); RLS with the action and brand scope; **only `status`, `username`, `account_type`, `token_expires_at`, `scopes` and the switches** are returned to the client, through a safe function; one connection per channel and the channel's platform must be `instagram`.

**Refresh job.** A scan renews tokens with 15 days or less left and raises `channel.connection_expiring` (brand owner and the integration owner) only when renewal failed. An expired token fails the next publication and the next metrics collection with a clear message and a notification. The scan also keeps the project active on the free Supabase plan (see the scheduler note in 5.4).

### 5.2 Media preparation

| Need | Proposal |
|---|---|
| **JPEG** | The display copy is WebP, so it cannot be sent as is. **As built (first delivery): the job publishes the original and only when it is a JPEG of at most 8 MiB**; a PNG or WebP original fails with `media_not_ready` before anything is sent. The JPEG derivative proposed here (long side up to 1440 px, made in the browser when the content is scheduled, validated by the server like the other derivatives) is **not built** and is the next step to remove this limit |
| **Public URL** | Create a **presigned GET URL** (10 to 15 minutes) with `ServerStorage` right before creating the container and pass it as `image_url`/`video_url`. The bucket stays private, the URL is not stored (DATA-15, `r2-storage.md`). Check that Meta accepts the R2 presigned host (query-string signed URL, no redirects) in the first test |
| **Purge** | The original and planning files are purged only after the content is `published`; automatic publishing must run **before** that, and `publish_content` must be allowed only when the channel rows are `published_auto`/`published_manually` |
| **Ratios** | Instagram feed accepts a range of ratios (see [content-publication.md](content-publication.md) section 7: still not verified against Meta). Block scheduling when the first file is outside the verified range instead of letting Meta crop it |
| **Carousel** | 2 to 20 **images** (as built), ordered by `content_revision_media.position`; each child is a container with `is_carousel_item=true`, then a parent container. Videos inside a carousel are not supported yet (a child video needs its own processing wait) |
| **Video** | A Post (`image`) may carry one image (JPEG) **or one MP4 video**; a video in a Post is published as a Reel (`media_type=REELS`), because the API publishes feed videos that way (decision 2026-10-28). Reels and Stories accept one MP4 original (`video/mp4`) as built (the library also stores MOV, WebM and other videos, but only `video/mp4` can be published; any other type is refused with `media_not_ready`); Meta's size, length and codec limits were **not read** and the library keeps no reduced copy (content-publication.md P3), so a large video may be refused by Meta (`instagram_rejected` or `media_not_ready`) |

### 5.3 What is published

The **approved revision**, never the draft: caption = the channel row's caption adjustment, else the base caption, taken from `content_revisions.snapshot`; files = `content_revision_media` of `approved_revision_id`; format from the snapshot (`post`, `carousel`, later `reel`, `story`). Rules before scheduling or publishing:

- Caption length up to 2,200 characters (the editor already warns); more than 30 hashtags is refused by Instagram, so warn.
- A channel row with a format the adapter does not support in the current phase (for example `reel` in phase 1) stays manual and the editor says so.
- Changing the date of an **approved** item already audits and notifies; with automation it also changes the job's due time. A content reopened after approval loses its approved revision and its auto-publication is cancelled in the same transaction.

### 5.4 Scheduler (the hard constraint)

The current jobs run **once a day** on Vercel Hobby. Publishing "at 18:30" needs a trigger every few minutes.

| Option | Cost | Precision | Notes |
|---|---|---|---|
| Vercel **Pro** crons | Paid plan | Down to 1 minute | Simplest: one more route, same `CRON_SECRET` model |
| External free scheduler (cron-job.org, GitHub Actions `schedule`, Cloudflare Workers Cron) calling `GET /api/cron/publish-due` with the secret | Free | 1 to 5 minutes (GitHub Actions can drift by minutes) | No new platform in the stack if Cloudflare is already used for R2; the secret lives in the scheduler |
| Supabase `pg_cron` + `pg_net` calling the route | Free (if the extension is enabled) | 1 minute | The database wakes the route; keeps scheduling inside the stack already planned for `pg_cron` |

Recommendation: **`pg_cron` + `pg_net` every minute, with the daily Vercel route as a safety net** (needs the extension enabled, which `pending-external-setup.md` already asks for); fall back to an external scheduler if `pg_net` is not available on the plan. Decide with the owner (open decision A2).

How the recommended option works: a `pg_cron` job runs every minute inside the database and uses `pg_net` to send an HTTP `GET` to `/api/cron/publish-due` on the Vercel app with `Authorization: Bearer <CRON_SECRET>`; the route runs the jobs of this module (publish, renew tokens, collect metrics) and answers quickly. The secret for the database call is kept in Supabase Vault, not in the migration (SEC-4, DATA-13). One job in the database, one route in the app: the same route can also be called by the daily Vercel cron as a backup.

Free-plan caveats (**not verified in Supabase's official pages; only the Edge Functions limits were**): the free plan **pauses a project after 7 days without database activity**, and a paused project runs no cron job; a job that writes a row each run (for example a "last tick" record) counts as activity, but a project left alone for long is still at risk. This is acceptable for development; for clients, use a paid plan before go-live (decision A12). `pg_net` limits (request rate, timeout, retention of responses) must be read before the build.

**Two-phase processing.** A serverless request must stay short and Meta takes up to minutes to process a container, so one tick does not wait:

1. **Claim and create:** pick due rows (`planned_at <= now()`, approved, automatic, connection `active`) with `for update skip locked`, mark `publishing`, create the container, **save the `container_id` immediately**.
2. **Check and publish:** a later tick (same route, same job) finds rows with a `container_id`, reads `status_code`; `FINISHED` → `media_publish` → save `external_media_id` and permalink → `published_auto`; `IN_PROGRESS` → leave for the next tick; `ERROR`/`EXPIRED` → failure path.

**Idempotency (the double-post risk).** Never create a second container for a row that has a `container_id`; if `media_publish` times out, read the account's recent media (or the container's `PUBLISHED` status) before retrying; every attempt is a row in the attempts table so a crash is recoverable. A row stuck in `publishing` for more than 30 minutes goes to `publish_failed` for a person to decide.

### 5.5 States, data and records (as built, 2026-10-26)

The first proposal added three publication statuses. To keep the change small (GOLD-5) and not rewrite the large content functions, the built design keeps `publication_status` as is and adds columns. `published_manually` therefore means "recorded as published"; `published_via` says how.

| Item | As built |
|---|---|
| Mode | `content_channels.publish_mode` (`manual` default, `automatic`), set per channel row by `channel_row_set_publish_mode` after the row exists; only for a connected channel and the formats image, carousel, reel and story |
| State while automatic | `auto_publish_state`: null (waiting for its time), `publishing`, `failed`. The row stays `planned` in all three, so the dashboard, the calendar and the reminders keep working |
| Result | `published_via = 'instagram_api'`, `external_media_id`, `published_url` (the permalink), `published_at`; `attempt_count` and `last_error_code` explain a failure |
| Retry / publish now | `publish_retry_at`: the job treats `coalesce(publish_retry_at, planned_at)` as the due moment; `channel_row_publish_now` sets it. Rescheduling a failed row clears the failure (trigger) |
| Attempts | `publish_attempts` (`attempt_no`, `container_id`, `status`, `error_code`, `provider_error`). Not immutable: its status moves `claimed → container_created → published / failed / uncertain / released`; it is written only by service functions and never deleted |
| Guard | trigger `content_channels_guard`: a row `publishing` cannot be rescheduled, cancelled, or have its mode changed (`publish_in_progress`) except by the job |
| Audit actions | `content_channel.published_auto`, `content_channel.publish_failed`, `content_channel.publish_mode_changed`, `content_channel.publish_requested`, `channel.connected`, `channel.disconnected`, `channel.connection_lost` (ids only, SEC-12) |
| Notification kinds | `content.publish_failed`, `content.published_auto`, `channel.connection_expiring`, `channel.connection_expired` |
| Actions | `channels.connect` (requires `channels.update`, starting role `manager`); `content.publish_manual` covers mode, retry and publish now |
| Error codes | see [../reference/error-codes.md](../reference/error-codes.md), section "Instagram, publishing and metrics" (the Meta subcode stays in `publish_attempts.provider_error`, never in a message) |
| Screens | Channel card (status badge and connection button, connection panel); content editor (section "6. Publicação automática": switch per row, state, retry, publish now); dashboard block "Marcar como publicado" with failed rows; no change to the calendar yet |

### 5.6 Data for the client metrics screen (decision D3)

The metrics screen is a future module, specified in [metrics.md](metrics.md) (charts, highlights, notes and the report the manager sends to the client), but **the data cannot be recovered later**: Meta keeps user-level metrics for up to 90 days, and post metrics change over time. So the connection collects and stores a history from day one, and the screen only reads it. The full catalogue of metrics must be read from Meta's API reference before phase 5 (section 3, "Insights"); the table below fixes the **shape**, not the final metric list.

| Data | Source | Collected | Stored as (proposal) |
|---|---|---|---|
| Account performance (reach, views/impressions, profile views, accounts engaged, interactions, link taps) | Account insights, `period=day` | Daily, for the previous day, plus a backfill of the last 30 to 90 days at connection | `channel_metric_daily` (`channel_id`, `brand_id`, `metric`, `day`, `value`; unique on the three keys; upsert) |
| Followers (total, new, lost) | Account fields and insights | Daily snapshot | Same table, metric `followers_count` and the follows/unfollows metrics |
| Audience (age, gender, city, country, when followers are online) | Demographics insights (only with 100+ followers) | Weekly snapshot | `channel_audience_snapshot` (`channel_id`, `brand_id`, `captured_on`, `dimension`, `breakdown jsonb`) |
| Per post: reach, views, likes, comments, saves, shares, interactions; for video also plays and watch time | Media insights, `period=lifetime` | At 1 hour, 24 hours, 7 days and 30 days after publication, for posts Aura Creative published **and** for posts published outside it (a sync of the recent media list) | `content_channel_metrics` (`channel_id`, `brand_id`, `external_media_id`, `content_channel_id` nullable, `captured_at`, `age_bucket`, `metrics jsonb`) |
| Post catalogue (permalink, type, caption, date, thumbnail URL) | Media list | With each sync | `channel_media_index` (`channel_id`, `brand_id`, `external_media_id`, `permalink`, `media_type`, `posted_at`, `caption_excerpt`); thumbnails are **not** stored (Meta's URLs expire) |
| Stories | Story insights | Only inside Meta's short window (see below); webhook only with Facebook Login | Same `content_channel_metrics`, `age_bucket` `story_final` |
| Comments and mentions (counts) | Account insights | Daily count only | `channel_metric_daily` |

Rules:

- **Link results to content.** A post that Aura Creative published keeps `content_channel_id`, so the screen can show "this approved content, published on this date, got these results" and compare formats, days and hours. This is the data that is unique to the product.
- **Posts published outside Aura Creative** are indexed too (the client keeps posting by hand); they have no `content_channel_id`.
- **History is append-only** (GOLD-8): snapshots are never edited; a metric that Meta later revises is a new row.
- **Empty is not zero.** Meta returns an empty set when data is unavailable; the screen shows "Sem dados" and the tables store no row.
- **Storage is small**: a few hundred rows per account per month; no files. Keep everything; decide any retention later.
- **Minimal personal data** (SEC-12): only aggregates. Audience is aggregated by Meta; nothing about individual followers or commenters is collected.
- **Client visibility.** The portal never reads these tables; a future `portal_*` function returns explicit columns, per the portal rules (DATA-2). Whether the client sees all metrics is a decision of the metrics module.
- **Cost of collection.** One scheduled job (daily for the account, hourly ticks for the post age buckets) using the same scheduler and the same token reader as publishing; failures are recorded per channel and surface on the connection panel. Respect Meta's rate limits (to be read from the reference) and stop on `connection_expired`.
- **Permissions.** A new action to read metrics (`metrics.view`) belongs to the metrics module; collection itself runs as the job and needs none.

### 5.7 Code placement

Following the pattern of email ([../standards/base.md](../standards/base.md) section 2): an adapter in `src/lib/shared/social/instagram.server.ts` (the only place that calls Meta; typed, zod-validated responses, `Result`, `logError`), the jobs in `src/lib/shared/jobs/` (`publish-due.server.ts`, `channel-connections.server.ts` for renewal, `collect-metrics.server.ts`), one route `/api/cron/publish-due` that runs the three jobs, the OAuth return page `/admin/marketing/instagram/callback` (a page that calls the server function `completeInstagramConnection`, so the user's session is available), SQL functions as above, UI in `components/marketing/channels` and `components/marketing/content`. No component calls Meta.

## 6. Failure handling

| Case | Behavior |
|---|---|
| Token expired or revoked by the client | Row becomes `publish_failed` (`connection_expired`); notification with "Reconectar"; nothing retried until reconnected |
| Meta cannot download the file | One retry with a fresh URL; then `publish_failed` (`media_not_ready`) |
| `ERROR` in the container | `publish_failed` with the mapped code; the person fixes the file (new version → new approval) or publishes manually |
| 24-hour limit reached | Row stays `planned` and is retried on the next ticks; the team is notified once (`publish_limit_reached`) |
| Late job | Publishes if within a grace window (proposal: 6 hours); beyond it the row becomes `publish_failed` instead of surprising the client with an old post |
| Content cancelled or date changed while `planned` | The job reads the current row inside the claim, so the change wins; a row already `publishing` cannot be cancelled, only reconciled afterwards |
| Account rate-limited or Meta outage (HTTP 5xx, code 1/2) | Exponential delay between ticks, at most 5 attempts, then `publish_failed` |
| Post deleted on Instagram later | Aura Creative keeps its record; no sync in this scope |

## 7. Phases

| Phase | Delivers | Depends on | Rough size |
|---|---|---|---|
| 0. Preparation | Decisions A1 to A6; items M1 to M7 started; official-source check of limits and video specs | People | Calendar time, not development |
| 1. Single image post, own account | Connection and configuration panel in the channel (Standard Access), encrypted token storage and automatic renewal, JPEG derivative, `publish-due` job in two phases, statuses, attempts, audit, failure notifications, dashboard block, pgTAP and unit tests with a fake Meta | A1, A2, A4, M1, M4, M6, M7 | The largest step |
| 2. Go live for clients | App Review passed, onboarding flow for client accounts, runbook | M2, M3, M5 | Review time |
| 3. Carousel | Children containers, ordering, ratio rule | Phase 1 | Small |
| 4. Reels and Stories | Video derivative, longer processing, limits | content-publication.md P3 | Medium |
| 4b. Metrics collection | Daily account metrics and followers, weekly audience, post metrics at 1 h / 24 h / 7 d / 30 d, index of posts made outside Aura Creative, backfill at connection, collection status on the panel. **Can start right after phase 1 and should not wait for the metrics screen**, so history accumulates | Phase 1, the metric list read from Meta's reference | Medium |
| 4c. Metrics screen and reports | Separate module, specified in [metrics.md](metrics.md): reads the tables of 5.6, curated reports to the portal through `portal_*` functions | 4b | Separate project |
| 5. Other platforms | The adapter contract, one platform at a time | Their own review rules | Per platform |

Each phase is one purpose per change (GOLD-5) and updates this document's implementation status.

## 8. Rules this changes (GOLD-3: decide first, then code)

| Rule or document | Today | Needed change | Cost |
|---|---|---|---|
| [../technical-architecture-v0.1.md](../technical-architecture-v0.1.md) sections 2 and 23, ADR-13 | Automatic publishing out of the MVP; persistent queue only in the automatic phase | Move it into scope; ADR-13 is the "automatic-publishing phase" it anticipated, so the queue is the `publishing` state plus attempts table, not a new infrastructure | Text only |
| [README.md](README.md) shared conventions ("No automatic publishing") and [channels.md](channels.md) scope and rule 4 | Registration never contacts the platform, stores no secret | Connection and configuration live in the channel (D2) as a separate, explicit action; plain registration still contacts nothing. Rule 4 of channels.md is reworded in this change; "No automatic publishing" in this README waits for decision A1 | Wording |
| **DATA-15** and AGENTS.md ("no secrets in the database") | No secrets or signed URLs in the database | **Decided 2026-10-26 (D1):** one exception: provider access tokens, **encrypted**, never readable by the client, deleted on disconnect. Signed URLs stay forbidden. Applied in [../standards/base.md](../standards/base.md) and [../../AGENTS.md](../../AGENTS.md) in this change | Done |
| SEC-5 (service-role allowed modules) | Invitation acceptance, jobs, audit, signing | Add the token reader and the publishing job | List entry + lint config |
| Base section 2 canonical patterns | No row for social platforms | Add a row: `lib/shared/social` adapter, forbidden: calling Meta elsewhere | One row |
| [content.md](content.md) / enums | `PublicationStatus` has four values | Three more (section 5.5) | `CHECK`, constant, labels, badge, docs together (DATA-8) |
| [content-publication.md](content-publication.md) | `publish_content` needs every row `published_manually` | Accept `published_auto` too | One condition |
| [calendar.md](calendar.md) | "planned" is an editorial date | For an automatic row it is a promise; the calendar shows the mode and status | Copy and badge |

## 9. Decisions

All the questions of the proposal were answered on 2026-10-26 by taking the recommendation, unless the person decided otherwise. What is still open is in [../pending-external-setup.md](../pending-external-setup.md).

| ID | Decision |
|---|---|
| A1 | Build now, all phases (the product owner asked for it) |
| A2 | The trigger is `pg_cron` + `pg_net` every minute (or an external scheduler, or Vercel Pro), with the daily Vercel run only as a backup. **Not wired yet**: until it is, a row published through the daily run only starts at 09:30 UTC and the 6-hour lateness window fails most rows. Automatic publishing is therefore not usable in practice before pending item I5 |
| A3 | New action `channels.connect` |
| A4 | Instagram Login (no Facebook Page) |
| A5 | JPEG: not built; the job accepts only JPEG originals (section 5.2) |
| A6 | The team starts the connection from the channel card; the client logs in on Instagram's own screen |
| A7 | Lateness window: 6 hours |
| A8 | Hashtags stay in the caption |
| A9 | First review asks for basic, content publish and manage insights |
| A10 | Metric history is kept without a limit |
| A11 | Posts made outside Aura Creative are collected; whether the client sees them is chosen per report (block "Melhores posts") |
| A12 | Free Supabase plan accepted only for development |
| D1 | The access token is stored encrypted in `channel_connections`; disconnecting **deletes** it (a hard delete on purpose: the token must not outlive the connection; the audit events `channel.connected`, `channel.disconnected` and `channel.connection_lost` keep the trace, and the metrics and publication history stays with the channel) |

## 10. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| App Review rejected or slow | Cannot publish for clients | Start early; complete screencast and policy pages; keep manual flow as fallback (it never goes away) |
| Double posting | Client sees the same post twice | Save `container_id` before publishing, claim with `skip locked`, check before retry, attempts table |
| Token leak (the token is now stored, D1) | Control of a client's account | Encrypted at rest with a key outside the database, server only, never logged, never in DTOs, no `select` policy exposing the column, deletion on disconnect, a pgTAP test that no role reads it |
| Metrics not collected from day one | History lost (Meta keeps 90 days) | Phase 4b right after phase 1; backfill at connection |
| Scopes added later | Every client must authorize again | Request every scope the roadmap needs in the first review (A9) |
| Meta changes limits or fields (already inconsistent: 50 vs 100) | Silent failure | Read `content_publishing_limit`, validate every response with zod, pin the Graph API version, review quarterly |
| Scheduler drift | Post minutes late | Grace window, show "publicado às" with the real time |
| Image mismatch (WebP, ratio, crop) | Rejected or cropped post | JPEG derivative and ratio check before scheduling |
| Client changes password or switches the account type | Connection breaks | `connection_expired` flow with notification |

## 11. Acceptance criteria (for the phase 1 delivery)

- [ ] A person with `channels.connect` connects an Instagram professional account to its channel; a person without it, an external user and `anon` cannot; the token is never returned by any function (pgTAP and unit tests).
- [ ] An approved content with an automatic Instagram row is published once, within the scheduler's interval of its planned time, using the **approved** caption and files.
- [ ] A forced crash between container creation and publishing does not create a second post.
- [ ] An expired token, an unreachable file and the 24-hour limit each produce the documented state, notification and message.
- [ ] A cancelled, reopened or rescheduled content is not published at the old time.
- [ ] The post link, date, status and attempts are visible in the content, the calendar and the dashboard; each publication writes one audit event with ids only.
- [ ] After one authorization, the connection stays active through at least two automatic token renewals without asking the client again; when renewal is impossible, the panel shows "Reconectar" and the team is notified.
- [ ] The channel's connection panel shows the account data, the status and the switches of 5.1; no function returns the token to any role (pgTAP).
- [ ] (Phase 4b) A connected account gets its history backfilled and then daily account rows, weekly audience rows and post rows at 1 h, 24 h, 7 d and 30 d; a post made outside Aura Creative is indexed; missing data is stored as no row, not zero.
- [ ] Manual publication still works for every channel and for a failed automatic row.
- [ ] SQL and TS constants match (`check:consistency`); documents and registries updated (`check:docs`).

## 12. Implementation status

2026-10-26, first delivery of phases 1 to 4b (and the whole of the metrics module, see [metrics.md](metrics.md)).

**Migrations:** `20261026100000_channel_connections.sql`, `20261026100100_instagram_publishing.sql`, `20261026100200_metrics.sql`, `20261026100300_channel_connection_store.sql` (replaces `channel_connection_connect` with the service-only `channel_connection_store`, I11). **Tests:** pgTAP `26_channel_connections`, `27_instagram_publishing` (with the per-role matrix: anon, external user, manager of another brand, composite key), `28_metrics` (with the portal projection); Vitest `token-crypto`, `oauth-state`, `instagram.server` (faked `fetch`), `dates`, `period`, `highlights`, `insights`, `format`.

**Code:** `src/lib/shared/social/` (`token-crypto.server.ts`, `oauth-state.server.ts`, `graph.server.ts`, `instagram.server.ts`, `instagram-publish.server.ts`, `instagram-insights.server.ts`, `publish-codes.ts`, `scopes.ts`); `src/lib/shared/jobs/` (`connection-token.server.ts`, `channel-connections.server.ts`, `publish-due.server.ts`, `collect-metrics.server.ts`, `connection-test.functions.ts`); `src/routes/api/cron/publish-due.ts` (one route runs the publishing, the token renewal and the metrics collection; `vercel.json` has the daily backup run); `src/lib/marketing/channels/connection*.ts`; `src/lib/marketing/content/publishing.functions.ts`; UI `src/components/marketing/channels/{channel-connection-sheet,connection-badge,instagram-callback-page}.tsx`, `src/components/marketing/content/publish-automation-section.tsx`, the dashboard blocks; route `/admin/marketing/instagram/callback`.

**Decisions taken while building:** the token is encrypted in the server with AES-256-GCM and a key from `CHANNEL_TOKEN_KEY` (not Supabase Vault, so it works in the local test database); the OAuth state is signed and expires in 10 minutes (single use comes from Meta's one-time code); the publishing is two-phase with the container id saved first, and an unconfirmed `media_publish` is marked `uncertain` for a person to check instead of being retried; a row more than 6 hours late fails with `publish_too_late`; `pg_cron` was not wired (the scheduler is an external item, see [../pending-external-setup.md](../pending-external-setup.md) I5).

**Validation performed:** `npm run db:verify` (1097 assertions, 0 failures, 101 of them new), `npm run typecheck`, `npm run lint`, `npm run check:consistency`, `npm run check:docs`, `npm run test` (Vitest), `npm run build`. The three migrations were applied to the linked project on 2026-10-26 (`supabase db push --linked`, after a dry run) and the database types were regenerated with `npm run db:types -- --linked`. On 2026-10-27 the fourth migration (`channel_connection_store`, I11) was applied the same way, the types were regenerated, and the date handling was moved into `src/lib/shared/dates.ts` (date-fns and `@date-fns/tz`, with an ESLint rule against raw `Date`); then `npm run db:verify` (1101 assertions, 0 failures), `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run check:consistency`, `npm run check:docs`, `npm run test` (231 passed) and `npm run build` all passed.

**Not done / not tested:** **no call to Meta was ever made** (the adapter is tested only against a faked `fetch`; response shapes, metric names and parameters come from Meta's public documentation and must be checked, [../pending-external-setup.md](../pending-external-setup.md) I7); no browser pass, no Playwright flow (including the date pickers and the calendar after the dates refactor, and the I11 connection flow against a real Meta account); the JPEG derivative (I8); carousel with video, resumable upload, Stories insights; follows and unfollows and the online-hours audience are not collected (I10); the `pg_cron` trigger and the `pg_net` limits (I5); the portal never saw a published report in a real session.

## Sources

- Meta, [Publish Content using the Instagram Platform](https://developers.facebook.com/docs/instagram-platform/content-publishing/) (read 2026-10-26).
- Third party, for tokens, access levels and the 100-post quota discrepancy: [Instagram API 100-Post Limit](https://social-api.ai/blog/instagram-accounts-are-limited-to-100-api-published-posts), [Instagram Official APIs reference (April 2026)](https://gist.github.com/jameschapman2c/65eff9f54a2d350b17a6ce5127b9fe42), [Instagram Graph API production guide](https://bundle.social/blog/instagram-graph-api).
