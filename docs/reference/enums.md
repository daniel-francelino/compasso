# Statuses, enums and keys

> Every closed set of values in Compasso, with its TypeScript constant, its database column and the pt-BR UI label. Values are English `snake_case` in the database; TypeScript constants are `PascalCase` objects (`as const`) with a derived type (`ValueOf`); schemas use `z.nativeEnum(Constant)`; never write the string values in code (rule CODE-4). `check:consistency` compares each row marked ✔ with the `CHECK` list of the mapped column. Where to put the code: shared sets in `src/lib/shared/enums.ts`; sets owned by one domain in that module's `types.ts` (or `lib/shared/editorial` when marketing and portal both use them).

## 1. Account and access

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `ProfileStatus` | `pending`, `approved`, `rejected`, `suspended` | `profiles.status` | "Em análise", "Ativo", "Recusado", "Suspenso" | authentication |
| `ProfileKind` | `internal`, `external` | `profiles.kind`, `brand_members.kind` | "Equipe", "Cliente" | authentication |
| `BrandMemberStatus` | `active`, `revoked` | `brand_members.status` | "Ativo", "Revogado" | brands |
| `InvitationStatus` | `pending`, `accepted`, `revoked`, `expired` | `invitations.status` | "Pendente", "Aceito", "Revogado", "Expirado" | authentication |
| `SystemRole` | `owner`, `manager`, `collaborator`, `external_approver`, `external_commenter` (keys of the seeded roles) | `roles.key` (not a CHECK) | "Proprietário", "Gestor", "Colaborador", "Aprovador externo", "Comentarista externo" | roles-and-actions |

## 2. Content and approvals

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `EditorialStatus` | `draft`, `planning`, `awaiting_plan_approval`, `plan_changes_requested`, `plan_approved`, `in_production`, `internal_review`, `awaiting_approval`, `changes_requested`, `approved`, `cancelled` | `content_items.editorial_status` | "Rascunho", "Em planejamento", "Planejamento em aprovação", "Alterações no planejamento", "Planejamento aprovado", "Em produção", "Em revisão interna", "Aguardando aprovação", "Alterações solicitadas", "Aprovado", "Cancelado" | content |
| `PublicationStatus` | `unplanned`, `planned`, `published_manually`, `cancelled` | `content_channels.publication_status` | "Não planejada", "Planejada", "Publicada manualmente", "Cancelada" | content |
| `RichNodeType` | `doc`, `paragraph`, `heading`, `bulletList`, `orderedList`, `listItem`, `hardBreak`, `text` | Tiptap JSON of `content_items.briefing` (not a database column check; validated by zod in `lib/shared/rich-text/types.ts`) | (not shown) | content |
| `RichMarkType` | `bold`, `italic` | Marks allowed in that JSON | (not shown) | content |
| `ContentFormat` | `image`, `carousel`, `video`, `text`, `story`, `reel`, `article`, `other` | `content_channels.format` | "Post", "Carrossel", "Vídeo", "Texto", "Story", "Reel", "Artigo", "Outro" | content |
| `ApprovalStage` | `plan`, `art` | `content_revisions.stage`, `approval_requests.stage` | "Planejamento", "Artes" | content, approvals |
| `ApprovalRequestStatus` | `pending`, `approved`, `changes_requested`, `superseded`, `cancelled` | `approval_requests.status` | "Pendente", "Aprovada", "Alterações solicitadas", "Substituída", "Cancelada" | approvals |
| `ApprovalOutcome` | `approved`, `changes_requested` | `approval_decisions.outcome` | "Aprovado", "Alterações solicitadas" | approvals |
| `CommentVisibility` | `internal`, `external` | `comments.visibility` | "Interno", "Externo" | content |
| `CalendarView` | `month`, `week`, `list` | URL param `view` (not stored in the database) | "Mês", "Semana", "Lista" | calendar |
| `CalendarEntryKind` | `publication`, `published`, `approval_deadline`, `production_deadline`, `idea`, `date`, `event` | `list_calendar_entries` output (`kind`, not stored) | "Publicação planejada", "Publicado", "Prazo de aprovação", "Prazo de produção", "Ideia", "Data", "Evento" | calendar |
| `CalendarNoteKind` | `idea`, `date`, `event` | `calendar_notes.kind` | "Ideia", "Data", "Evento" | calendar |
| `CalendarEventType` | `shoot`, `meeting`, `other` | `calendar_notes.event_type` | "Captação", "Reunião", "Outro evento" | calendar |
| `CalendarNoteRepeat` | `none`, `weekly`, `monthly`, `yearly` | `calendar_notes.repeat` | "Não repetir", "Toda semana", "Todo mês", "Todo ano" | calendar |
| `ContentObjective` | `awareness`, `engagement`, `traffic`, `leads`, `sales`, `community`, `other` | `content_items.objective_kind` | "Reconhecimento da marca", "Engajamento", "Tráfego para o site", "Geração de contatos", "Vendas", "Comunidade", "Outro" | content |
| `CalendarAlert` | `too_many_on_day`, `too_close`, `not_approved_yet`, `date_passed` | computed in the browser (not stored) | see `calendarAlertLabels` in `lib/shared/labels.ts` | calendar |
| `DashboardReason` | `approval_overdue`, `changes_requested`, `production_overdue`, `planned_date_passed`, `approver_without_access` | `dashboard_attention` output (`reasons`, not stored) | "Aprovação atrasada", "Alterações solicitadas", "Prazo de produção vencido", "Data prevista ultrapassada", "Ninguém pode aprovar" | dashboard |
| `Platform` | `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube`, `x`, `pinterest`, `threads`, `email`, `blog`, `other` | `channels.platform` | "Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "X", "Pinterest", "Threads", "E-mail", "Blog", "Outro" | channels |

Transition map (`EditorialTransitions`, in `lib/shared/editorial`): `draft → in_production | cancelled`; `in_production → internal_review | awaiting_approval | cancelled`; `internal_review → awaiting_approval | in_production | cancelled`; `awaiting_approval → approved | changes_requested | in_production (reopen) | cancelled`; `changes_requested → in_production | cancelled`; `approved → in_production (reopen) | cancelled`; `cancelled → ∅`. Only the transactional functions perform a transition; the map is shared by the editor, the board and tests.

## 3. Media

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `MediaScope` | `site`, `brand` | `media_assets.scope`, `media_collections.scope` | "Site", "Marca" | media-library |
| `MediaShareStatus` | `active`, `revoked`, `target_deleted` | `media_shares.status` | "Ativo", "Encerrado", "Arquivo removido" | media-library |
| `ShareKind` | `asset`, `collection` | argument of `media_share_create` and `media_share_list` | — | media-library |
| `SharePasswordAction` | `keep`, `set`, `clear` | `media_share_update` | — | media-library |
| `PublicShareState` | `ok`, `not_found`, `revoked`, `unavailable`, `expired`, `locked`, `exhausted`, `password_required`, `wrong_password`, `download_disabled` | answer of the public share functions | see `publicShareStateMessages` | media-library |
| `MediaVersionStatus` | `pending`, `processing`, `available`, `failed` | `media_versions.status` | "Enviando", "Processando", "Disponível", "Falhou" | media-library |
| `UploadSessionStatus` | `open`, `confirmed`, `expired`, `failed` | `media_upload_sessions.status` | — (internal) | media-library |
| `MediaUsageType` | `content_revision`, `site_page_revision`, `case_study`, `brand_identity`, `publication_evidence` | `media_usages.usage_type` | "Revisão de conteúdo", "Página do site", "Case", "Identidade da marca", "Evidência de publicação" | media-library |
| `MediaKind` | `image`, `video`, `document` (derived from MIME; not stored) | — | "Imagem", "Vídeo", "Documento" | media-library |

## 4. Site and CMS

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `SitePageKind` | `home`, `about`, `services`, `portfolio`, `case_study`, `contact`, `blog_post`, `generic` | `site_pages.kind` | "Início", "Sobre", "Serviços", "Portfólio", "Case", "Contato", "Artigo", "Página" | cms-site |
| `SitePageStatus` | `draft`, `published`, `unpublished` | `site_pages.status` | "Fora do site", "No ar", "Despublicada" | cms-site |
| `SitePageChangeState` (derived, not stored) | `out`, `enters_next`, `live`, `leaves_next` | — | "Fora do site", "Entra na próxima publicação", "No ar", "Sai na próxima publicação" | cms-site |
| `SiteEntryKind` | `service`, `testimonial` | `site_entries.kind` | "Serviço", "Depoimento" | cms-site |
| `SectionKind` | `hero`, `services_grid`, `portfolio_grid`, `testimonials`, `rich_text`, `image_text`, `gallery`, `faq`, `contact_form` | zod discriminator (not a column) | "Abertura", "Serviços", "Portfólio", "Depoimentos", "Texto", "Imagem e texto", "Galeria", "Perguntas frequentes", "Contato" | cms-dynamic-architecture |
| `LinkKind` | `page`, `anchor`, `case_study`, `url`, `whatsapp`, `email`, `phone` | zod discriminator | "Página", "Âncora", "Case", "Endereço", "WhatsApp", "E-mail", "Telefone" | cms-dynamic-architecture |
| `SectionBackground` | `ivory`, `cream`, `peach` | zod (appearance) | "Marfim", "Creme", "Pêssego" | cms-dynamic-architecture |
| `SectionSpacing` | `s`, `m`, `l` | zod (appearance) | "Compacto", "Médio", "Amplo" | cms-dynamic-architecture |
| `SectionAccent` | `violet`, `coral`, `orchid` | zod (appearance) | "Violeta", "Coral", "Orquídea" | cms-dynamic-architecture |
| `PortfolioSource` | `all`, `manual` | zod (`portfolio_grid`) | "Todos os cases autorizados", "Escolher à mão" | cms-dynamic-architecture |
| `ImageSide` | `left`, `right` | zod (`image_text`) | "Esquerda", "Direita" | cms-dynamic-architecture |
| `PublicSiteState` | `none`, `ok`, `redirect`, `not_found` | `site_published_page` answer (not stored) | — | public-site-delivery |
| `ProblemSeverity` | `error`, `warning` | publish checks (not stored) | "Corrigir", "Atenção" | cms-site |
| `ContactMessageStatus` | `new`, `answered`, `discarded` | `contact_messages.status` | "Nova", "Respondida", "Descartada" | cms-site |

## 5. Notifications, audit and system

| TS constant | Values | DB column ✔ | Notes | Owner |
|---|---|---|---|---|
| `NotificationSeverity` | `info`, `warning`, `urgent` | `notifications.severity`, `notification_kinds.severity` | | notifications |
| `NotificationStatus` | `active`, `resolved` | `notifications.status` | | notifications |
| `NotificationKind` | `approval.requested`, `approval.decided`, `approval.superseded`, `approval.overdue`, `content.due_soon`, `content.overdue`, `content.publish_due`, `comment.created`, `calendar.event`, `invitation.accepted`, `invitation.expiring`, `site.published`, `site.contact_message`, `media.upload_failed` | `notification_kinds.kind` (FK) | Authoritative list and recipients in notifications.md | notifications |
| `AuditActorKind` | `internal`, `external`, `system` | `audit_events.actor_kind` ✔ | | audit |
| `AuditAction` | See [../modules/audit.md](../modules/audit.md) | catalog in `audit_write` | | audit |
| `EmailStatus` | `queued`, `sent`, `failed` | `email_outbox.status` | | notifications |
| `ErrorCode` | `denied`, `not_found`, `conflict`, `in_use`, `invalid`, `unavailable`, `unknown` | — | Result-level codes; SQL codes are in [error-codes.md](error-codes.md) | auth |
| `AccessAuditAction` | `created`, `status_changed`, `role_changed`, `kind_changed` (`profile_audit.action`); `created`, `updated`, `deleted`, `actions_changed` (`role_audit.action`) | written by triggers | — | authentication |
| `AppRoute` | `lib/shared/routes.ts`: fixed URLs used in code (`Admin`, `Portal`, `Login`, `Pending`, `AccessDenied`, `Forbidden`, `Design`); grows with `routes.md` | — | — | project-structure |
| `Space` | `marketing`, `cms`, `site`, `portal`, `shared` | — | Used by `nav-config` and lint blocks | project-structure |

## 6. Keys

| Constant | Where | Content |
|---|---|---|
| `QueryKey` | `lib/shared/query-keys.ts` (+ per-module factories) | One namespace per module: `QueryKey.Clients.list(filters)`, `.detail(id)`, `QueryKey.Brands…`, `QueryKey.Content…`, `QueryKey.Approvals…`, `QueryKey.Calendar…`, `QueryKey.Media…`, `QueryKey.Notifications…`, `QueryKey.Site…`, `QueryKey.Portal…`, `QueryKey.Auth.state` |
| `StoredKey` | `lib/shared/stored-keys.ts` | `CalendarView`, `CalendarRange`, `CalendarUndatedOpen`, `SidebarOpen`, `LastSpace`, `ListColumns`, `ApprovalDraftComment` (all prefixed `compasso:`) |
| `Action` | `lib/shared/auth/actions.ts` | Generated shape: `Action.<Module>.<Verb>` for every row of the actions catalog |
| `AuditAction` | `lib/shared/audit/actions.ts` | `AuditAction.<Domain>.<Verb>` for the audit catalog |

## 7. How to add or change a value

1. Add or change the row here (values, constant, column, labels).
2. Change the `CHECK` in a **new** migration (expand → migrate → contract; never edit an applied one).
3. Change the constant, the zod schemas that use it (`z.nativeEnum`) and the status mapping (`StatusBadge` tone / `statusStyles`).
4. Update the module document (statuses and transitions) and, if it affects visuals, [../standards/color-palette.md](../standards/color-palette.md).
5. Run `npm run check:consistency`.
