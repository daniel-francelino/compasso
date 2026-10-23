# Data model (authoritative schema)

> The complete, consolidated schema of Compasso. It is the **single source** for tables, columns, constraints, indexes and triggers; migrations implement it and `database.types.ts` is generated from it. The architecture document only summarizes it. Module documents explain the behavior; this document says exactly what exists. Keep it in sync with migrations (GOLD-1, DOC-2). Conventions: `uuid` primary keys with `gen_random_uuid()`, `timestamptz` instants, statuses as `text` + `CHECK` (values in [enums.md](enums.md)), `created_at`/`updated_at` on mutable tables, snake_case, English.

## 1. Table index

| Table | Owner module | Brand-scoped (`brand_id`) | RLS access summary |
|---|---|---|---|
| `organizations` | organization-settings | no | read: approved **internal** accounts (external users read nothing here, DATA-2); write: `settings.manage` |
| `organization_settings` | organization-settings | no | read/write: `settings.manage` |
| `profiles` | authentication | no | own row; `users.view` for others |
| `roles`, `actions`, `role_actions` | roles-and-actions | no | read: approved internal accounts; write: `roles.manage` (via function) |
| `profile_audit`, `role_audit` | authentication | no | `users.view` / `roles.manage` read-only |
| `invitations` | authentication | no (grants hold brands) | `users.view`; writes via functions |
| `clients`, `client_contacts` | clients | no (reached through brands) | `clients.view` + link to a brand of the client |
| `brands`, `brand_members` | brands | yes (is the boundary) | `brands.view` + `can_access_brand` |
| `channels` | channels | yes | `channels.view` + `can_access_brand` |
| `content_items`, `content_channels`, `content_revisions`, `content_revision_media`, `comments` | content | yes | `content.view`/`approvals.view` + `can_access_brand`; **no policy for external roles** |
| `calendar_notes` | calendar | yes | `calendar.view` + `can_access_brand`; **no policy for external roles** |
| `approval_requests`, `approval_decisions` | approvals | yes | `approvals.view` + `can_access_brand`; external only via `portal_*` |
| `media_assets`, `media_versions`, `media_upload_sessions`, `media_collections`, `media_collection_items`, `media_usages` | media-library | scope `brand` or `site` | `media.view` + brand link (or `site.view` for site scope) |
| `media_shares`, `media_share_grants`, `media_share_events` | media-library | share links of a file or a collection: secret `token`, optional expiry, password (bcrypt hash), download limit, lock after 5 wrong passwords; grants hold only the hash of a password session; events are the access timeline. `status` is `active`, `revoked` or `target_deleted` | `media.share` + brand link (or `site.view`); never readable by `anon` |
| `sites`, `site_pages`, `site_page_revisions`, `site_entries`, `site_case_study_authorizations`, `site_redirects`, `contact_messages` | cms-site | no | `site.view` + specific `site.*`; **public read only through functions** |
| `notification_kinds`, `notifications`, `notification_preferences` | notifications | `notifications.brand_id` | own rows + action + brand scope |
| `email_outbox` | notifications | no | server only |
| `audit_events` | audit | `brand_id` nullable | `audit.view` + brand scope |

## 2. Organization and settings

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  default_timezone text not null default 'America/Sao_Paulo',
  logo_media_version_id uuid,
  contact_email text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_single on organizations ((true));

create table organization_settings (
  key text primary key,
  value jsonb not null,
  version int not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
```

The MVP has exactly one organization (the unique index `organizations_single`); migration 1 seeds that row with `on conflict do nothing`. `organizations.logo_media_version_id` and `organization_settings.updated_by` are plain `uuid` columns in migration 1; their foreign keys (to `media_versions` and `profiles`) are added by the migrations that create those tables. In migration 1 the tables have RLS enabled and **no policies yet** (nothing is readable); policies arrive in migration 2 when `has_action` exists. The shared trigger function `set_updated_at()` is created in migration 1.

`organization_settings.key` ∈ `policies.approvals`, `policies.calendar`, `policies.uploads`, `policies.urls`, `policies.retention`, `policies.invitations`, `policies.security`, `policies.email` (validated by zod per key).

## 3. Identity, roles and access

```sql
create table roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  portal_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table actions (
  key text primary key,
  module text not null,
  description text not null,
  admin_only boolean not null default false,
  portal boolean not null default false,
  requires text[] not null default '{}'
);

create table role_actions (
  role_id uuid not null references roles(id) on delete cascade,
  action_key text not null references actions(key) on delete cascade,
  primary key (role_id, action_key)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email citext not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  kind text not null default 'internal' check (kind in ('internal','external')),
  role_id uuid references roles(id),
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or role_id is not null)
);

create table profile_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  profile_id uuid not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table role_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  role_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  email citext not null,
  role_id uuid not null references roles(id),
  grants jsonb not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid references profiles(id),
  accepted_by uuid references profiles(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on invitations (organization_id, status);
create index on invitations (email);
```

- `invitations.grants` shape: `[{ "brand_id": uuid, "can_decide": boolean }]` (empty for roles with no brand scope). The `kind` of the brand links comes from the role (`portal_only` → `external`).
- Triggers: `profiles_guard` (protects `status`, `role_id`, `kind` from self-edit; blocks suspending/changing the last Owner; blocks assigning `owner` or `admin_only` actions without being Owner); `role_actions_guard` (rules 1, 4, 5, 6 of roles-and-actions); `*_audit` triggers write to `profile_audit`/`role_audit`.
- Implemented in migration `auth_roles_profiles`: the trigger functions are `profiles_guard`, `profiles_audit`, `roles_guard`, `roles_audit`, `role_actions_guard`, `role_actions_requires_check` (deferred constraint trigger) and `role_actions_audit`. `profiles` allows a client to update only `full_name` and `locale` (column grant); everything else goes through functions. The seed holds the whole action catalog with its `requires`.
- Seed: roles `owner`, `manager`, `collaborator`, `external_approver`, `external_commenter`; actions catalog; first Owner by `scripts/seed-owner.mjs` (no password in migrations).

## 4. Clients, brands and channels

```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null check (char_length(name) between 2 and 120),
  owner_user_id uuid references profiles(id),
  internal_notes text,
  tags text[] not null default '{}',
  version int not null default 1,
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index on clients (organization_id, archived_at);

create table client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  email text check (email is null or email = lower(email)),
  phone text,
  role_title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index client_one_primary_contact on client_contacts (client_id) where is_primary;

create table brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  target_audience text,
  tone_of_voice text,
  objectives text,
  references_notes text,
  visual_identity jsonb not null default '{}',
  logo_media_version_id uuid references media_versions(id),
  timezone text not null,
  version int not null default 1,
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, organization_id) references clients(id, organization_id),
  unique (id, organization_id)
);
create unique index brands_unique_name_per_client on brands (client_id, lower(name));
create index on brands (organization_id, client_id);

create table brand_members (
  brand_id uuid not null references brands(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('internal','external')),
  can_decide boolean not null default false,
  status text not null default 'active' check (status in ('active','revoked')),
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (brand_id, user_id),
  check (kind = 'external' or not can_decide)
);
create index on brand_members (user_id, brand_id) where status = 'active';

create table channels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  platform text not null check (platform in
    ('instagram','facebook','linkedin','tiktok','youtube','x','pinterest','threads','email','blog','other')),
  profile_name text not null,
  profile_url text check (profile_url is null or profile_url ~ '^https://'),
  external_id text,
  notes text,
  version int not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id)
);
create unique index channels_unique_active on channels (brand_id, platform, lower(profile_name)) where archived_at is null;
create index on channels (brand_id) where archived_at is null;
```

Triggers: `brand_members.kind` must equal `profiles.kind` of the user; the last internal member rule (`last_internal_member`); channel `platform` immutable once used by a content channel row.

## 5. Content, versions, comments and approvals

```sql
create table content_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  title text not null check (char_length(title) between 2 and 140),
  objective_kind text check (objective_kind is null or objective_kind in
    ('awareness','engagement','traffic','leads','sales','community','other')),
  objective text,
  briefing jsonb,
  internal_notes text,
  assignee_id uuid references profiles(id),
  tags text[] not null default '{}',
  production_due_date date,
  caption jsonb,
  call_to_action text,
  working_media jsonb not null default '[]',
  plan_required boolean not null,
  plan_summary text check (plan_summary is null or char_length(plan_summary) <= 4000),
  plan_media jsonb not null default '[]',
  plan_approved_revision_id uuid,
  editorial_status text not null default 'draft' check (editorial_status in
    ('draft','planning','awaiting_plan_approval','plan_changes_requested','plan_approved',
     'in_production','internal_review','awaiting_approval','changes_requested','approved','published','cancelled')),
  approval_due_date date,
  current_revision_id uuid,
  approved_revision_id uuid,
  version int not null default 1,
  cancelled_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id)
);
create index on content_items (brand_id, cancelled_at, production_due_date);
create index on content_items (brand_id, editorial_status) where cancelled_at is null;

create table content_channels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  content_item_id uuid not null,
  channel_id uuid not null,
  format text not null check (format in ('image','carousel','video','text','story','reel','article','other')),
  caption jsonb,
  position int not null default 0,
  publication_status text not null default 'unplanned' check (publication_status in
    ('unplanned','planned','published_manually','cancelled')),
  planned_at timestamptz,
  planned_timezone text,
  published_at timestamptz,
  published_url text,
  published_note text,
  published_evidence_media_version_id uuid references media_versions(id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_item_id, brand_id) references content_items(id, brand_id),
  foreign key (channel_id, brand_id) references channels(id, brand_id),
  unique (id, brand_id),
  check (planned_at is null or planned_timezone is not null),
  check (publication_status <> 'planned' or planned_at is not null)
);
create index on content_channels (brand_id, planned_at);
create index on content_channels (channel_id);
create index on content_channels (content_item_id);

create table content_revisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  brand_id uuid not null,
  revision_no int not null,
  stage text not null default 'art' check (stage in ('plan','art')),
  snapshot jsonb not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  foreign key (item_id, brand_id) references content_items(id, brand_id),
  unique (item_id, revision_no),
  unique (id, item_id)
);
alter table content_items
  add foreign key (current_revision_id, id) references content_revisions(id, item_id),
  add foreign key (approved_revision_id, id) references content_revisions(id, item_id),
  add foreign key (plan_approved_revision_id, id) references content_revisions(id, item_id);

create table content_revision_media (
  revision_id uuid not null references content_revisions(id),
  media_version_id uuid not null references media_versions(id) on delete restrict,
  position int not null,
  alt_text text,
  primary key (revision_id, position)
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  item_id uuid not null,
  revision_id uuid not null,
  stage text not null default 'art' check (stage in ('plan','art')),
  status text not null default 'pending' check (status in
    ('pending','approved','changes_requested','superseded','cancelled')),
  requested_by uuid references profiles(id),
  requested_at timestamptz not null default now(),
  due_date date,
  message text,
  viewed_at timestamptz,
  decided_at timestamptz,
  cancelled_reason text,
  foreign key (revision_id, item_id) references content_revisions(id, item_id),
  foreign key (item_id, brand_id) references content_items(id, brand_id)
);
create unique index approval_one_pending_per_item on approval_requests (item_id) where status = 'pending';
create index on approval_requests (brand_id, status, due_date);

create table approval_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references approval_requests(id),
  revision_id uuid not null references content_revisions(id),
  decided_by uuid not null references profiles(id),
  outcome text not null check (outcome in ('approved','changes_requested')),
  comment text,
  on_behalf boolean not null default false,
  reason text check (reason is null or char_length(reason) <= 500),
  decided_at timestamptz not null default now(),
  check (outcome <> 'changes_requested' or length(btrim(coalesce(comment,''))) >= 5)
);
create unique index approval_decision_once on approval_decisions (request_id);

create table comments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  item_id uuid not null,
  revision_id uuid,
  author_id uuid not null references profiles(id),
  visibility text not null check (visibility in ('internal','external')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (item_id, brand_id) references content_items(id, brand_id)
);
create index on comments (item_id, created_at);

create table calendar_notes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  kind text not null check (kind in ('idea','date','event')),
  title text not null check (char_length(title) between 2 and 140),
  description text,
  note_date date not null,
  end_date date,
  event_type text check (event_type in ('shoot','meeting','other')),
  all_day boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  location text check (char_length(location) <= 200),
  client_visible boolean not null default false,
  internal_notes text check (char_length(internal_notes) <= 4000),
  repeat text not null default 'none' check (repeat in ('none','weekly','monthly','yearly')),
  converted_item_id uuid,
  converted_at timestamptz,
  archived_at timestamptz,
  version int not null default 1,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (converted_item_id, brand_id) references content_items(id, brand_id),
  check ((converted_item_id is null) = (converted_at is null))
);
create index on calendar_notes (brand_id, note_date) where archived_at is null;
-- checks: event fields only on events; a timed event has start, end and zone; an idea is never shared;
-- a repeating note lasts one day. The portal reads shared notes only through portal_list_calendar.
```

Triggers: `content_revisions`, `content_revision_media`, `approval_decisions` → refuse `update` and `delete`; `content_items` → a change of brand and any editorial transition outside the map of [enums.md](enums.md) are refused; `content_channels` → a change of brand or content is refused; `approval_requests` → block `status` changes except through the functions; `comments` → `deleted_at` is the only mutable column and only by the author (audited).

Implemented in `20261018100900_content.sql`, `…100910_content_functions.sql`, `…100920_portal_functions.sql` and, for the single-aggregate refactor of 2026-10-19, `20261019130000_content_single_aggregate.sql`, `…130010_content_single_aggregate_functions.sql`, `…130020_calendar_notes.sql` and `…130030_content_single_aggregate_portal.sql` (the first migrations created `content_variants`; the refactor converted it into `content_channels`, moved the caption, files and editorial status up to `content_items` and renamed the `variant_id` columns to `item_id`). Notes:

- `caption` (content and channel row) is a `jsonb` object `{ "text": string }`; on a channel row it is the **adjustment** (null means the base caption is used). `briefing` is a Tiptap JSON document (closed set of nodes and marks); text saved earlier as `{ "text": string }` is read as paragraphs (decision D12 in [../pending-external-setup.md](../pending-external-setup.md) concerns the caption only).
- `working_media` is an ordered array of `{ "media_version_id": uuid, "alt_text": string | null }` (at most 20); `submit_for_approval` copies it into `content_revision_media` and `media_usages` (`content_revision`).
- `content_items` has composite foreign keys `(current_revision_id, id)` and `(approved_revision_id, id)` to `content_revisions (id, item_id)`, so a content can only point to its own versions; `comments (revision_id, item_id)` likewise. The "published manually requires an approved version" rule is enforced by `mark_published`, not by a check.
- `content_revisions.snapshot` keys: `title`, `caption`, `call_to_action`, `brand_timezone`, `channels` (an array of `{ row_id, id, platform, profile_name, format, caption, planned_at, planned_timezone }`). The ordered files are the `content_revision_media` rows.
- Policies: contents, channel rows and notes `content.view` (notes: `calendar.view`) + brand; versions `content.view` or `approvals.view` + brand; requests and decisions `approvals.view` + brand; comments (not deleted) `content.view` for internal ones and `content.view` or `approvals.view` for external ones. No policy for external roles on any of these tables; `authenticated` has `select` only.

## 6. Media

```sql
create table media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  scope text not null check (scope in ('site','brand')),
  brand_id uuid references brands(id),
  display_name text not null,
  tags text[] not null default '{}',
  current_version_id uuid,
  size_bytes bigint not null default 0,
  version int not null default 1,
  trashed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'brand') = (brand_id is not null))
);
create index on media_assets (organization_id, scope, brand_id) where trashed_at is null;

create table media_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references media_assets(id),
  version_no int not null,
  storage_key text not null unique,
  thumb_key text,
  display_key text,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  derivative_bytes bigint not null default 0,
  width int, height int, duration_ms int,
  checksum text,
  status text not null default 'pending' check (status in ('pending','processing','available','failed')),
  failure_reason text,
  public_published_at timestamptz,
  purge_requested_at timestamptz,
  purge_keep_preview boolean not null default true,
  original_purged_at timestamptz,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (asset_id, version_no)

  -- publication clean-up (20261020140000): purge_requested_at, purge_keep_preview, original_purged_at);
alter table media_assets add foreign key (current_version_id) references media_versions(id);
alter table organizations add foreign key (logo_media_version_id) references media_versions(id);
-- content_channels.published_evidence_media_version_id gets its foreign key in the content migration (the table does not exist yet)

create table media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references media_versions(id) on delete cascade,
  author_id uuid not null references profiles(id),
  purpose text not null,
  reserved_bytes bigint not null,
  status text not null default 'open' check (status in ('open','confirmed','expired','failed')),
  idempotency_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (author_id, idempotency_key)
);

create table media_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  scope text not null check (scope in ('site','brand')),
  brand_id uuid references brands(id),
  parent_id uuid references media_collections(id),
  name text not null,
  created_at timestamptz not null default now(),
  check ((scope = 'brand') = (brand_id is not null))
);
create unique index media_collections_unique_name on media_collections (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), scope, coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table media_collection_items (
  collection_id uuid not null references media_collections(id) on delete cascade,
  asset_id uuid not null references media_assets(id) on delete cascade,
  primary key (collection_id, asset_id)
);

create table media_usages (
  id uuid primary key default gen_random_uuid(),
  media_version_id uuid not null references media_versions(id) on delete restrict,
  usage_type text not null check (usage_type in ('content_revision','site_page_revision','case_study','brand_identity','publication_evidence')),
  usage_ref_id uuid not null,
  alt_text text,
  created_at timestamptz not null default now(),
  unique (media_version_id, usage_type, usage_ref_id)
);
create index on media_usages (usage_type, usage_ref_id);
```

Implemented in `20261018100800_media.sql`, `…100810_media_functions.sql` and `…100820_media_summary_and_jobs.sql`. `media_versions_immutable` blocks changing the key, name, type or size of a version and any change to a confirmed version (only `public_published_at` and the derivative fields of pending versions move); `media_collections_guard` enforces the depth and that a child shares its parent's scope and brand. `derivative_bytes` counts thumbnail and display copies in the quota. Rules: collection nesting max 3 levels (trigger); a version `available` only after `confirmUpload`; `public_published_at` set by `media_publish_derivative`; versions referenced by `content_revision_media` or `media_usages` cannot be deleted (`restrict`).

## 7. Site and CMS

```sql
create table sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  settings jsonb not null default '{}',
  settings_version int not null default 1,
  published_settings jsonb,
  published_settings_at timestamptz
);

create table site_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  kind text not null check (kind in ('home','about','services','portfolio','case_study','contact','blog_post','generic')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$' or slug = ''),
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  draft_content jsonb not null default '{}',
  published_revision_id uuid,
  is_system boolean not null default false,
  version int not null default 1,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table site_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references site_pages(id),
  revision_no int not null,
  content jsonb not null,
  note text,
  published_by uuid references profiles(id),
  published_at timestamptz not null default now(),
  live_from timestamptz,
  cancelled_at timestamptz,
  source_revision_id uuid references site_page_revisions(id),
  unique (page_id, revision_no)
);
alter table site_pages add foreign key (published_revision_id) references site_page_revisions(id);

create table site_entries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  kind text not null check (kind in ('service','testimonial')),
  content jsonb not null,
  sort_order int not null default 0,
  visible boolean not null default true,
  version int not null default 1,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table site_case_study_authorizations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references site_pages(id),
  brand_id uuid not null references brands(id),
  authorized_by uuid not null references profiles(id),
  authorized_at timestamptz not null default now(),
  consent_note text not null,
  withdrawn_at timestamptz,
  withdrawn_by uuid references profiles(id)
);
create unique index case_study_one_active_authorization on site_case_study_authorizations (page_id) where withdrawn_at is null;

create table site_redirects (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  from_path text not null,
  to_path text not null,
  permanent boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (site_id, from_path)
);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  name text not null,
  email text check (email is null or email = lower(email)),
  phone text,
  message text not null check (char_length(message) between 1 and 4000),
  source_slug text,
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new','answered','discarded')),
  internal_note text,
  handled_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index on contact_messages (site_id, status, created_at desc);
```

`draft_content` and `content` share the shape described in [../spaces/cms-dynamic-architecture.md](../spaces/cms-dynamic-architecture.md) section 5.1; `sites.settings` groups: `contacts`, `social`, `languages`, `seo_defaults`, `navigation`, `message_templates`, `announcement`. A case study page can only be published while it has an active authorization row. Phase 5 notes (migrations `20261018101100_site_cms.sql` and `…101110_site_functions.sql`): there is one `sites` row per organization (`site_ensure()` creates it with the system home page); `site_page_revisions.content` stores the resolved page (`format`, `draft_hash`, `page`, `media`) plus a `draft` copy used by rollback, and the public read strips `draft`; the revisions are immutable (trigger); `site_pages` cannot change `kind`, and the system page cannot change address or be deleted; scheduling (`live_from`, `cancelled_at`) is not implemented yet; `contact_messages.email` is `text` stored in lower case (the extension `citext` is not used).

## 8. Notifications, email and audit

```sql
create table notification_kinds (
  kind text primary key,
  title text not null,
  required_action text not null references actions(key),
  severity text not null default 'info' check (severity in ('info','warning','urgent')),
  default_lead_days int[],
  schedulable boolean not null default false,
  portal boolean not null default false,
  default_email boolean not null default false,
  available boolean not null default false
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null references notification_kinds(kind),
  brand_id uuid references brands(id),
  title text not null,
  body text,
  link text,
  ref_type text,
  ref_id uuid,
  severity text not null default 'info' check (severity in ('info','warning','urgent')),
  status text not null default 'active' check (status in ('active','resolved')),
  dedupe_key text not null,
  read_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on notifications (user_id, read_at, created_at desc);
create index on notifications (ref_type, ref_id);

create table notification_preferences (
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null references notification_kinds(kind),
  enabled boolean not null default true,
  email boolean not null default false,
  lead_days int[],
  primary key (user_id, kind)
);

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email citext not null,
  template text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on email_outbox (status, next_attempt_at);

create table audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  brand_id uuid,
  actor_id uuid,
  actor_kind text not null default 'internal' check (actor_kind in ('internal','external','system')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  request_id text,
  occurred_at timestamptz not null default now()
);
create index on audit_events (organization_id, occurred_at desc);
create index on audit_events (brand_id, occurred_at desc);
create index on audit_events (entity_type, entity_id);
```

## 9. Cross-cutting rules for every migration

Applies to **every** table above when the migration is written (base.md section 5.5):

- `enable row level security`; no policy for `anon`; policies combine `has_action(...)` with `can_access_brand(brand_id)` for brand-scoped tables; external roles get **no** policy on the tables of sections 5–7.
- `updated_at` trigger on mutable tables; `version` incremented by the save functions (optimistic locking).
- Composite foreign keys for anything under a brand.
- Immutability triggers as listed; audit written by `audit_write` inside the functions.
- Indexes listed here are the minimum; add others only with a measured need.
- Extensions: `pgcrypto`, `citext`; `pg_cron` before the notifications migration.

## 10. Migration order (suggested)

| # | Migration | Contains |
|---|---|---|
| 1 | `core_extensions_and_organization` | extensions, `set_updated_at()`, `organizations` (+ seed row), `organization_settings`; RLS on, policies deferred to migration 2 |
| 2 | `auth_roles_profiles` | `roles`, `actions`, `role_actions`, `profiles`, audit tables, guards, `has_action`, `is_admin`, `my_actions`, seeds |
| 3 | `auth_invitations` (built in P1-01, so its file is dated after migration 4) | `invitations`, `accept_invitation`, invitation functions |
| 4 | `audit_events` | `audit_events`, `audit_write` and its action catalog, immutability trigger (purge only with `compasso.audit_purge`). Its read policy is organization-level only until migration 6 replaces it with the brand-scoped one |
| 5 | `notifications` | notification tables, `notify_users`, `resolve_notifications`, `generate_due_notifications`, `pg_cron` schedule |
| 6 | `clients_brands_channels` | tables of section 4, `can_access_brand`, `is_external_brand_member`, save functions |
| 7 | `media` | tables of section 6, upload/confirm/publish functions, quota |
| 8 | `content_and_approvals` | tables of section 5, transactional functions, `portal_*` functions |
| 9 | `calendar` | `list_calendar_entries`, `portal_list_calendar` |
| 10 | `site_cms` | tables of section 7, publish and public read functions |
| 11 | `dashboard` | dashboard functions and supporting indexes |

Files created so far (chronological): `20261018100000_core_extensions_and_organization`, `…100100_auth_roles_profiles`, `…100200_audit_events`, `…100300_clients_brands_channels` and `…100310_clients_brands_channels_functions`, `…100400_notifications`, `…100500_auth_invitations`, `…100600_access_and_settings_functions` (dated in dependency order: invitations come after clients/brands and notifications because `accept_invitation` links brands and notifies).

Phase 4 and 5 files: `…101000_calendar`, `…101100_site_cms`, `…101110_site_functions` (the public read, publish and media publish functions) and `…101120_site_overview`.

Each migration is accompanied by its pgTAP test file, its `db:types` regeneration and the registry updates (actions, kinds, error codes, audit actions).
