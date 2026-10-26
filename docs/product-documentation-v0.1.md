# Marketing management platform — Product document

Version 0.3 • October 18, 2026 • Technical decisions closed; product scope still under validation

Language convention for the whole project: **documentation, folder names, file names, code, routes, tables and SQL are in English. Only the user interface (UI copy) is in Brazilian Portuguese.** Where this document names a screen or a status, the Portuguese UI label is shown in quotes.

The technical detail (stack, folder structure, data model, security, deploy) is in [technical-architecture-v0.1.md](technical-architecture-v0.1.md). If the two documents diverge, `AGENTS.md` at the repository root prevails, and then the technical document for anything related to implementation.

## 1. Goal and decision status

Centralize the public presence of a marketing professional and the operation of client service, planning, production and approval of their clients' content.

Confirmed requirements: public website; entry at /admin; back office organized in spaces; CMS; client management with several channels; client access for approvals; editorial calendar; cross-cutting media library; Supabase as the database and Cloudflare R2 as file storage.

Technical decisions closed in version 0.3:

- Framework: TanStack Start (React + Vite), using the same skeleton, code rules and patterns as the Memoria Print project.
- Hosting: Vercel.
- Authentication: Supabase Auth, with sign-up by invitation only.
- UI language: Brazilian Portuguese. Everything else (documentation, folders, files, code, routes, SQL) in English.
- Permissions: configurable profiles (roles) made of actions, as in Memoria Print, combined with the user's link to each brand.
- Color palette and typography: defined in [standards/color-palette.md](standards/color-palette.md).

The remaining choices in this document are still proposals. A single marketing operation is assumed at first, with room for collaborators. A SaaS product with subscriptions is not assumed. Automatic publishing to social networks stays out of the proposed MVP, with one exception decided on 2026-10-26: Instagram publishing and metrics ([modules/instagram-publishing.md](modules/instagram-publishing.md), [modules/metrics.md](modules/metrics.md)).

## 2. Product reference

mLabs is the functional reference for the calendar, organization by brands and the creation and approval flow. Its public page describes those features. That reference does not allow concluding how mLabs' internal architecture works; the technical model is our own proposal.

Source: https://www.mlabs.com.br/

## 3. Naming and navigation

The product brand is **Aura Creative**, with the visual wordmark stored in `public/aura-creative-logo.png` and the sparkle mark stored in `public/aura-mark.svg`. User-facing application copy, browser titles, invitations and email templates use Aura Creative. `compasso` remains the repository and package identifier only.

| Element | Recommended name | UI label (pt-BR) | Responsibility |
|---|---|---|---|
| Editorial space | Site and CMS | "Site e CMS" | Content and settings of the public website |
| Operational space | Marketing Management | "Gestão de Marketing" | Clients, brands, channels and editorial operation |
| Cross-cutting module | Media Library | "Biblioteca de Mídia" | Files of the site and the brands, with controlled visibility |
| External experience | Client Portal | "Portal do Cliente" | Calendar, content and approvals for the authorized brands |
| Administrative area | Settings | "Configurações" | Team, access, profiles and general settings |

"Marketing Management" holds clients and editorial work without being confused with the CMS. "Spaces" are navigation areas and capabilities; they are not entities that own the clients, nor data isolation boundaries. In the code, each space has its own folder (`marketing`, `cms`, `site`, `portal`, `shared`) and a space never imports from another.

The back office has a space selector and a contextual menu. The library can be opened from the global menu or from the file picker of each space. Inside Marketing Management, the user can look at a global view or select a brand. The context must stay visible.

### Site and CMS

- Editorial overview.
- Pages and sections.
- Services.
- Portfolio and case studies.
- Testimonials.
- SEO, navigation and contacts.
- Library access filtered to the site.

### Marketing Management

- Dashboard: upcoming content, deadlines and pending approvals.
- Clients and brands.
- Channels.
- Editorial calendar.
- Content: list and board by status.
- Approvals.
- Library filtered by the brand.

## 4. Data organization

Proposed hierarchy: Organization → Client → Brand → Channel.

| Concept | Definition | Example |
|---|---|---|
| Organization | The professional's operation and its team | Marketing studio |
| Client | Commercial relationship being served | Restaurant group |
| Brand | Unit of identity and editorial planning | Café Aurora |
| Channel | Concrete profile or destination of a brand | @cafeaurora on Instagram |

A client has one or more brands; a brand has zero or more channels. Two Instagram profiles are two distinct channels. A brand can be created before its channels are registered. A user can take part in several brands through an explicit link.

The commercial client is different from the user who signs into the portal. A client can have several contacts, but only invited contacts have access. An invitation grants access to specific brands, never implicitly to all brands of the client.

For the simple case, registering a client can create the first brand with the same name, keeping the entities separate in the database.

## 5. Profiles and permissions

Access control combines two things, both checked in the database (RLS) and on the server:

1. **Profile (role)**: a named set of actions (for example `content.update`, `approvals.decide`), assigned to the user when access is approved. Administration creates and edits profiles without touching the code.
2. **Brand link**: the user only acts on the brands they were linked to. Belonging to the team does not give access to every brand.

Starting profiles (editable, except the system one):

| Profile (key) | UI label (pt-BR) | Type | Summary |
|---|---|---|---|
| `owner` | "Proprietário" | System, protected | All actions, including future ones; sees every brand |
| `manager` | "Gestor" | Pre-created | Manages clients, brands, content and sending for approval on linked brands |
| `collaborator` | "Colaborador" | Pre-created | Views clients and creates/edits content on linked brands |
| `external_approver` | "Aprovador externo" | Pre-created, external | Portal: sees what was sent, comments and decides on linked brands |
| `external_commenter` | "Comentarista externo" | Pre-created, external | Portal: sees and comments, without deciding |

| Action | Owner | Manager | Collaborator | External approver |
|---|---|---|---|---|
| Configure organization, profiles and access | Yes | No | No | No |
| Manage the CMS | Yes | With permission | With permission | No |
| Manage clients and brands | Yes | Linked brands | View linked | No |
| Create and edit content | Yes | Linked brands | Linked brands | No |
| Send for approval | Yes | Linked brands | With permission | No |
| Approve or request changes | Not by default | Not by default | No | Content sent on the brands where they have the right to approve |
| View the library | Authorized scope | Authorized scope | Authorized scope | Shared files only |

"With permission" means the user's profile includes the corresponding action. Model rules:

- The Owner profile cannot be edited or deleted, and at least one active Owner account always exists.
- Nobody changes their own profile or suspends themselves. Anyone who is not an Owner cannot assign the Owner profile or administration-only actions.
- Write actions require the read action of the same module.
- Changing a profile or revoking a link takes effect immediately on new operations.
- If a manager can skip approval, it must be an explicit action, with a reason and an audit trail, to be validated after the MVP.

The external approver sees the content that was sent to them and its authorized history. Internal notes, other clients, unshared drafts and settings stay private.

## 6. Public website and CMS

Initial page proposal: home, about, services, portfolio, case study detail and contact. A blog is optional. Page addresses (slugs) are CMS data and can be in Portuguese.

The CMS uses structured templates and predefined sections in the MVP. A free-form page builder is not proposed at this stage.

Requirements: text and image editing; section ordering; draft and publish; authenticated preview; SEO title and description; social image; alternative text; unique slugs; basic change history. Only the published version is shown to the visitor.

The site keeps no content in the code: texts, images and case studies come from the CMS.

Publishing client work in the portfolio requires explicit selection and authorization. A private file does not become public just because it is selected in the editor.

## 7. Clients, brands and channels

Client: name, contacts, internal owner, active/archived status and internal notes. Billing, contracts and advanced commercial CRM are not part of the MVP.

Brand: name, visual identity, description, target audience, tone of voice, goals, references, time zone and authorized members.

Channel: platform, profile name, identifier or URL, active/archived status and reference to the brand. Registering a channel does not mean there is an authenticated integration with the platform.

Archiving preserves history. An archived channel cannot receive new planned items but stays associated with earlier posts.

## 8. Content with several channels

A content item is an editorial idea that belongs to a brand. It holds an internal title, goal, briefing, owner, tags, deadlines and internal notes.

A content is written once and goes to one or more channels. Each channel row (channel, format and publication occurrence) has its own format, optional caption adjustment and planned date; the caption, files, call to action and the approval cycle are shared. For example, a campaign can generate a carousel and a story on Instagram and a text on LinkedIn from one content.

A content sent for approval creates an immutable version with the texts, files, order and, per channel, the format, adjustment and date shown to the client. File references must point to immutable object versions.

### Editorial statuses

Draft → In production → In internal review → Awaiting approval → Approved.

| Status key | UI label (pt-BR) |
|---|---|
| `draft` | "Rascunho" |
| `in_production` | "Em produção" |
| `internal_review` | "Em revisão interna" |
| `awaiting_approval` | "Aguardando aprovação" |
| `changes_requested` | "Alterações solicitadas" |
| `approved` | "Aprovado" |
| `cancelled` | "Cancelado" |

A change request moves the content to "changes requested"; the team prepares a new version and submits it again. A content can also be cancelled without deleting its history.

Publication status is separate: Unplanned ("Não planejada"), Planned ("Planejada"), Published ("Publicada", by hand or by the Instagram integration) or Cancelled ("Cancelada"). "Planned" means an editorial date exists; it does not mean the platform will publish automatically. "Scheduled" is reserved for a future integration that actually confirms a scheduling.

### Approval rules

1. Any approver of the brand (an external member with the right to decide) can decide a request; the first decision wins and the others see who decided. Other external members can comment, if authorized. Content goes through two approvals: the planning first and, only after it, the art.
2. The decision identifies the revision, approver, date and result; requesting changes requires a comment.
3. Changing text, files, order, channel or date requires a new revision and a new approval.
4. A superseded revision accepts no new decisions. Concurrent submissions must be checked in a transaction to avoid approving an outdated version.
5. Revoking a member's access blocks new decisions while preserving the history already recorded.
6. Delay or silence never equals approval.
7. Manual publishing can only be recorded for the currently approved revision, with the real date and a URL or evidence when available.
8. Cancellation and reopening are audited. An approved revision is not edited directly.

## 9. Editorial calendar

Month, week and list views. The internal view aggregates the authorized brands; the portal is restricted to the brands and contents shared with the user.

Each entry corresponds to a channel row of a content (shown with the channel logo); ideas and dates created by the team also appear. Filters: client, brand, channel, owner, editorial status and publication status. Production and approval deadlines must be distinct from the publication date and visually identifiable.

Store instants in UTC and the applicable IANA time zone (for example America/Sao_Paulo or Europe/Lisbon). The default time zone comes from the organization and each brand can have its own. Show the time zone in the calendar and handle daylight-saving changes where they exist. Deadlines without a time must be modeled as local dates.

Dragging an entry changes the date after confirmation. If the content was already submitted or approved, the new-version rule applies. Content without a date stays in a pending list. An approval received after the planned date raises a warning and requires rescheduling; it does not trigger publishing.

## 10. Client Portal

Entry by invitation and authentication, using the same identity as the system. A user with several brands can switch between the authorized ones.

MVP features: pending-items dashboard, calendar, preview per channel, caption and file viewing, external comments, approval, change request and decision history. The experience must work well on mobile.

Invitations have an expiry, controlled use and can be revoked. Acceptance verifies the invited identity. Direct URLs never replace authorization. Anonymous approval links are out of the MVP.

Notifications are internal in the first version (bell with counter and real time, as in Memoria Print). Email for invitations and alerts requires a transactional provider, configuration and controlled resending. A delivery failure must not delete the approval request; it stays available in the portal.

## 11. Media Library

One logical library serves the CMS and Marketing Management. Each file has an owner, an organization context and, as applicable, a site or brand. Sharing is not inherited merely from the folder where the file appears.

Metadata in Supabase: original name, object key, bucket, validated MIME type, size, dimensions, duration when applicable, checksum, version, author, context, visibility, tags and processing status. Alternative text can be set per use, because the same file can have different meanings on different pages.

Features: multiple upload, search, filters, logical collections/folders, preview, authorized download and a view of where the file is used. File size limits and formats must be configured before implementation; proposed initial formats: JPEG, PNG, WebP, MP4 and PDF.

Collections organize references, without necessarily duplicating the bytes. The usage relation links files to revisions, pages and case studies. A replacement creates a new version; it does not overwrite an already approved object.

Files in use are not permanently deleted. Deletion goes through a trash and a reference check; the retention period will be defined. A client upload, if included later, is not automatically public or approved.

## 12. Technical architecture (summary)

Modular application with four surfaces: public website, internal back office (Site and CMS and Marketing Management spaces), external portal and what is shared among them. A single TanStack Start project, published on Vercel, with a server layer (server functions) and domains separated by space in the code.

| Component | Responsibility |
|---|---|
| Supabase PostgreSQL | Structured data, revisions, access and audit |
| Supabase Auth | Identities, sessions, password recovery; sign-up by invitation only |
| Row Level Security | Restrict rows by profile (actions) and brand link |
| Server functions (TanStack Start) | Business rules, validation, transitions, R2 access signing and privileged tasks |
| Cloudflare R2 | Originals, versions and media derivatives, behind a storage interface |
| pg_cron and Vercel Cron | Scheduled notifications, cleanup of incomplete uploads, email resending |

File bytes live in R2, not in Supabase Storage.

### File upload and read

1. The user asks the server for an upload, stating the context and expected metadata.
2. The server validates session, permissions and limits; creates a pending record and a unique, opaque object key.
3. It issues a temporary signed upload URL. The browser sends the file to R2, with CORS limited to the required origins.
4. Finalization checks that the file exists, its size and its real content; data declared by the browser is not enough. Until validation finishes, the file stays unavailable for publishing.
5. The record becomes available or failed. A job cleans up incomplete uploads and orphan objects with a safety margin.
6. To read a private file, the server checks authorization and issues a short-lived read URL.

Signed URLs grant access to whoever holds them until they expire. Removing portal access prevents new issuance but does not by itself invalidate an already issued URL. Private originals and public derivatives use distinct buckets. Publishing a public derivative is an explicit action; removing it must take caches into account.

Supabase security does not automatically protect R2 objects. Every file operation checks the same permissions on the server. R2 secrets and privileged Supabase keys never reach the browser. Object keys do not include client names and are not used as access control.

Technical sources: https://supabase.com/docs/guides/database/postgres/row-level-security and https://developers.cloudflare.com/r2/api/s3/presigned-urls/

## 13. Initial data model

| Entities | Role and relations |
|---|---|
| profiles, roles, actions, role_actions | Authenticated identity, profiles and the action catalog |
| profile_audit, role_audit | History of access decisions and profile changes |
| organizations | Organization (one, at first) |
| clients, client_contacts | Commercial client and contacts |
| brands, brand_members | Brands and explicit internal/external links |
| channels | Editorial destinations of a brand |
| content_items | Editorial idea and briefing of a brand |
| content_channels | Channel, format and publication occurrence of a content |
| calendar_notes | Ideas and dates on the calendar, convertible into contents |
| content_revisions, content_revision_media | Immutable versions of the content and the files shown |
| approval_requests, approval_decisions | Request per version (planning or art) and the decision of whoever approved |
| comments | Comments with internal or external visibility |
| media_assets, media_versions | Logical identity and file versions in R2 |
| media_collections, media_collection_items | Logical organization of the library |
| media_usages | Explicit use of versions in revisions and in the CMS |
| sites, site_pages, site_page_revisions | Editorial content and the published revision of the site |
| invitations | Invitations with expiry, single use and revocation |
| notification_kinds, notifications, notification_preferences | Internal alerts |
| audit_events | Traceability of critical business actions |

Subordinate entities carry a verifiable brand context. Composite foreign keys or equivalent validations prevent linking a content channel row to another brand's channel. Adding a context identifier is not enough without guaranteeing the consistency of the relations.

Decisions and critical transitions are transactional. Audit records actor, action, entity and instant, with restricted access. Indexes must cover the authorization fields and the calendar filters. Public content is exposed through a read function limited to published revisions.

## 14. Proposed routes

Routes, files and identifiers are in English; only UI texts are in Brazilian Portuguese. Public site addresses come from the CMS.

| Route | Purpose |
|---|---|
| / and other CMS addresses (for example /servicos, /portfolio, /contato) | Public site, resolved from the published pages |
| /admin/login | Sign-in; if authenticated, redirects according to profile and permissions |
| /admin/invite/:token | Invitation acceptance and password setup |
| /admin/recover-password, /admin/reset-password | Password recovery |
| /admin | Back office home |
| /admin/site | Site and CMS space |
| /admin/marketing | Marketing Management overview |
| /admin/marketing/clients/:clientId | Client and brands |
| /admin/marketing/brands/:brandId | Context of one brand |
| /admin/marketing/calendar | Authorized global calendar |
| /admin/library | Internal library |
| /admin/settings | Authorized settings (team, profiles, invitations, organization) |
| /portal | Selection of authorized external brands |
| /portal/brands/:brandId | Portal of a brand |
| /portal/brands/:brandId/approvals/:requestId | Review and decision |

Everyone signs in at /admin/login; the external approver is sent to /portal. Separating routes improves the experience, but authorization is enforced on the server and in the database. Hiding menu items is not an isolation measure.

## 15. MVP and evolution

### Proposed MVP

Authentication and invitations; two internal spaces; structured CMS; registered clients, brands and channels; content with several channels; revisions and approval by one responsible person; internal/external comments; calendar; library in R2; manually recorded publishing; audit of critical actions.

### Later evolution

Automatic publishing through official APIs; credentials and token renewal; persistent queue with idempotent execution and controlled retries; handling of uncertain results; metrics and reports; multiple approvers; campaigns and advanced tasks; billing; CRM; AI assistance; SaaS operation with several independent organizations.

Automatic publishing must be its own integration project. Having a calendar and a registered channel does not guarantee publishing support on a platform.

## 16. Main acceptance criteria

- A client with two brands can have several channels without mixing content.
- An external member of brand A cannot obtain data, comments or private URLs of brand B, even by changing identifiers in requests.
- The approver sees exactly the revision that was sent. Editing approved content requires a new approval.
- A decision on a superseded revision is refused, including under concurrency.
- Only shared contents appear in the external calendar.
- Content with two channels can have different dates, formats and decisions per channel.
- A private file is not reachable through a public domain; temporary URLs expire.
- An invalid or incomplete upload does not become available for public selection.
- A file used in an approved revision cannot be overwritten or permanently deleted.
- CMS drafts do not appear on the public site; publishing identifies a specific revision.
- Calendar dates are consistent in the brand's time zone, including daylight-saving changes where they exist.
- Recording manual publishing does not trigger calls to social networks.
- A user without the corresponding action is refused by the database, even when calling the API directly.
- Changing a profile or revoking a brand link takes effect immediately, even with an open session.

## 17. Operational requirements

Responsive interface, keyboard navigation and clear error and loading states. Pagination and filters executed on the server for lists that grow. Separate development and production environments, versioned migrations and secrets outside the repository.

Define retention, export and deletion of data; backup and recovery tests for PostgreSQL and for R2 objects are separate responsibilities. Monitor upload failures, approval requests, jobs and deliveries. Performance targets, file volume and budget will be sized once a usage estimate exists.

Quality, code and interface standards follow the project's `AGENTS.md` and the technical document.

## 18. Decisions to validate in the next revision

1. Confirm whether the MVP will have manual publishing only or whether a social integration is indispensable.
2. Confirm the one-approver-per-request model and whether internal review is mandatory.
3. Define the initial team, number of clients and file volume/size.
4. Confirm the site pages, blog and the level of editorial freedom of the CMS.
5. Confirm whether the client needs to upload files or only view and approve.
6. Choose the email provider, upload limits, retention (trash, audit, backups) and the organization's default time zone. Framework, hosting, language and visual identity are already decided (section 1).

## 19. Sources consulted

- mLabs, public functional reference: https://www.mlabs.com.br/
- Supabase, Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Cloudflare R2, signed URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Memoria Print project (author's local repository): code rules, permissions, authentication, R2 storage and notifications, adopted as the base.

Consulted on 10/18/2026. External sources support the providers' capabilities; the organization of spaces, entities, rules and scope are proposals of this document.
