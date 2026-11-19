# Statuses, enums and keys

> Every closed set of values in Aura Creative, with its TypeScript constant, its database column and the pt-BR UI label. Values are English `snake_case` in the database; TypeScript constants are `PascalCase` objects (`as const`) with a derived type (`ValueOf`); schemas use `z.nativeEnum(Constant)`; never write the string values in code (rule CODE-4). `check:consistency` compares each row marked ✔ with the `CHECK` list of the mapped column. Where to put the code: shared sets in `src/lib/shared/enums.ts`; sets owned by one domain in that module's `types.ts` (or `lib/shared/editorial` when marketing and portal both use them).

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
| `EditorialStatus` | `planning`, `in_production`, `awaiting_approval`, `changes_requested`, `approved`, `published`, `cancelled` | `content_items.editorial_status` | "Em planejamento", "Em produção", "Em aprovação", "Alterações solicitadas", "Aprovado", "Publicado", "Cancelado" | content (simplified on 2026-10-30; see [../modules/content.md](../modules/content.md#simplified-approval-decided-2026-10-30)) |
| `PublicationStatus` | `unplanned`, `planned`, `published_manually`, `cancelled` | `content_channels.publication_status` | "Não planejada", "Planejada", "Publicada", "Cancelada" | content; `published_manually` means "recorded as published", how it happened is in `content_channels.published_via` (null = by hand, `instagram_api` = automatic) |
| `RichNodeType` | `doc`, `paragraph`, `heading`, `bulletList`, `orderedList`, `listItem`, `hardBreak`, `text` | Tiptap JSON of `content_items.briefing` (not a database column check; validated by zod in `lib/shared/rich-text/types.ts`) | (not shown) | content |
| `RichMarkType` | `bold`, `italic` | Marks allowed in that JSON | (not shown) | content |
| `ContentFormat` | `image`, `carousel`, `video`, `text`, `story`, `reel`, `article`, `other` | `content_channels.format` | "Post", "Carrossel", "Vídeo", "Texto", "Story", "Reel", "Artigo", "Outro" | content |
| `ApprovalStage` | `plan`, `art` | `content_revisions.stage`, `approval_requests.stage` | "Planejamento", "Artes" | content, approvals |
| `ApprovalRequestStatus` | `pending`, `approved`, `changes_requested`, `superseded`, `cancelled` | `approval_requests.status` | "Pendente", "Aprovada", "Alterações solicitadas", "Substituída", "Cancelada" | approvals |
| `ApprovalOutcome` | `approved`, `changes_requested` | `approval_decisions.outcome` | "Aprovado", "Alterações solicitadas" | approvals |
| `CommentVisibility` | `internal`, `external` | `comments.visibility` | "Interno", "Externo" | content |
| `FeedPostKind` | `full`, `media_only`, `caption_only`, `plan` | `lib/portal/approvals/feed.ts`: which post the portal feed draws for a request (computed in the browser from `stage`, caption and files; not stored) | see [../modules/portal-feed-previews.md](../modules/portal-feed-previews.md) | portal |
| `CalendarView` | `month`, `week` | URL param `view` (not stored in the database) | "Mês", "Semana" | calendar |
| `EditorStep` | `planning`, `briefing`, `content` | Local state of the content editor (not stored, not a URL param) | "Planejamento", "Briefing", "Conteúdo" | content |
| `CalendarEntryKind` | `publication`, `published`, `approval_deadline`, `production_deadline`, `idea`, `date`, `event` | `list_calendar_entries` output (`kind`, not stored) | "Publicação planejada", "Publicado", "Prazo de aprovação", "Prazo de produção", "Ideia", "Data", "Evento" | calendar |
| `CalendarNoteKind` | `idea`, `date`, `event` | `calendar_notes.kind` | "Ideia", "Data", "Evento" | calendar |
| `CalendarEventType` | `shoot`, `meeting`, `other` | `calendar_notes.event_type` | "Captação", "Reunião", "Outro evento" | calendar |
| `CalendarNoteRepeat` | `none`, `weekly`, `monthly`, `yearly` | `calendar_notes.repeat` | "Não repetir", "Toda semana", "Todo mês", "Todo ano" | calendar |
| `ContentTypeColor` | `violet`, `orchid`, `rose`, `peach`, `coral`, `sage`, `cactus`, `ink_soft` | `content_types.color` | "Violeta", "Orquídea", "Rosa", "Pêssego", "Coral", "Sálvia", "Cacto", "Azul-marinho" | content, organization-settings |
| `ContentObjective` (legacy: no longer edited, 2026-10-28) | `awareness`, `engagement`, `traffic`, `leads`, `sales`, `community`, `other` | `content_items.objective_kind` | "Reconhecimento da marca", "Engajamento", "Tráfego para o site", "Geração de contatos", "Vendas", "Comunidade", "Outro" | content |
| `CalendarAlert` | `too_many_on_day`, `too_close`, `not_approved_yet`, `date_passed` | computed in the browser (not stored) | see `calendarAlertLabels` in `lib/shared/labels.ts` | calendar |
| `DashboardReason` | `approval_overdue`, `changes_requested`, `production_overdue`, `planned_date_passed`, `approver_without_access` | `dashboard_attention` output (`reasons`, not stored) | "Aprovação atrasada", "Alterações solicitadas", "Prazo de produção vencido", "Data prevista ultrapassada", "Ninguém pode aprovar" | dashboard |
| `Platform` | `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube`, `x`, `pinterest`, `threads`, `email`, `blog`, `other` | `channels.platform` | "Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "X", "Pinterest", "Threads", "E-mail", "Blog", "Outro" | channels |

Transition map (`EditorialTransitions`, in `lib/shared/editorial`): `planning → in_production | awaiting_approval | approved | cancelled`; `in_production → planning | awaiting_approval | approved | cancelled`; `changes_requested → planning | in_production | awaiting_approval | approved | cancelled`; `awaiting_approval → planning | in_production | approved | changes_requested | cancelled`; `approved → planning | in_production | published | cancelled`; `published` and `cancelled → ∅`. Only the transactional functions perform a transition (`content_move` only between `planning` and `in_production`); the map is shared by the editor, the board and tests, and `editorial.test.ts` checks it against `editorial_transition_allowed` in `20261030100000_simplified_approval.sql`.

## 2b. Instagram, publishing and metrics

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `PublishMode` | `manual`, `automatic` | `content_channels.publish_mode` | "Manual", "Automática" | instagram-publishing |
| `AutoPublishState` | `publishing`, `failed` (null = waiting or not automatic) | `content_channels.auto_publish_state` | "Publicando", "Falhou" | instagram-publishing |
| `PublishedVia` | `instagram_api` (null = recorded by hand) | `content_channels.published_via` | "Publicado automaticamente" | instagram-publishing |
| `ConnectionStatus` | `active`, `expiring`, `expired`, `revoked` | `channel_connections.status` | "Conectado", "Perto de expirar", "Reconectar", "Acesso removido" | instagram-publishing |
| `PublishAttemptStatus` | `claimed`, `container_created`, `published`, `failed`, `uncertain`, `released` | `publish_attempts.status` | (internal) | instagram-publishing |
| `PublishErrorCode` | `connection_expired`, `connection_missing`, `format_not_supported`, `media_not_ready`, `publish_limit_reached`, `instagram_rejected`, `instagram_unavailable`, `publish_uncertain`, `publish_stuck`, `publish_too_late` (TypeScript only, in `src/lib/shared/social/publish-codes.ts`; stored in `content_channels.last_error_code`; messages in [error-codes.md](error-codes.md)) | `content_channels.last_error_code`, `publish_attempts.error_code` (not a CHECK) | see error-codes.md | instagram-publishing |
| `MetricKey` | `followers_total`, `follows`, `unfollows`, `reach`, `views`, `profile_views`, `accounts_engaged`, `interactions`, `likes`, `comments`, `saves`, `shares`, `profile_link_taps` | `channel_metric_daily.metric` | see [../modules/metrics.md](../modules/metrics.md) section 9 | metrics |
| `AudienceDimension` | `age_gender`, `city`, `country`, `online_hours` | `channel_audience_snapshot.dimension` | "Idade e gênero", "Cidades", "Países", "Horários" | metrics |
| `PostAgeBucket` | `h1`, `h24`, `d7`, `d30`, `story_final` | `content_channel_metrics.age_bucket` | (internal) | metrics |
| `MetricMarkKind` | `campaign`, `viral_post`, `partnership`, `event`, `other` | `metric_marks.kind` | "Campanha", "Post que viralizou", "Parceria", "Evento", "Outro" | metrics |
| `MetricReportStatus` | `draft`, `published`, `withdrawn` | `metric_reports.status` | "Rascunho", "Publicado", "Retirado" | metrics |
| `MetricCompare` | `previous`, `year`, `none` | `metric_reports.compare_mode` | "Período anterior", "Mesmo período do ano passado", "Sem comparação" | metrics |
| `MetricGranularity`, `PostRanking`, `PeriodPreset`, `MetricBlockKind`, `HighlightTone` | TypeScript only (no column): see `src/lib/shared/enums.ts` and `src/lib/shared/metrics/` | — | — | metrics |

## 2c. Client feedback

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `FeedbackStatus` | `snoozed`, `answered`, `declined` | `feedback_responses.status` | (internal) | feedback |
| `FeedbackQuestion`, `FeedbackPromptState`, `FeedbackListStatus`, `FeedbackCardState`, `FeedbackScoreTone` | TypeScript only (no column): see `src/lib/shared/feedback/types.ts`. Prompt states `none`, `due`, `banner`; list status `answered`, `pending`; card state `answered`, `not_opened`, `snoozed`, `declined`; tone `attention`, `neutral`, `positive` | — | Questions in `src/lib/shared/feedback/questions.ts`; tones "Precisa de atenção", "Dentro do esperado", "Positivo" | feedback |

## 2d. Image editor

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `DesignPreset` | `feed_square`, `feed_portrait`, `story` | `designs.preset` | "Feed quadrado (1080 × 1080)", "Feed retrato (1080 × 1350)", "Story ou Reel (1080 × 1920)"; short labels on the gallery cards "Feed 1:1", "Feed 4:5", "Story 9:16" | image-editor |
| `DesignElementKind`, `DesignFont`, `DesignTextAlign`, `DesignStatusFilter` | TypeScript only (no column; the first three live inside the document JSON): see `src/lib/shared/design/types.ts`. Kinds `text`, `image`, `rect`, `ellipse`, `line` and, from document version 3 (P5a), `raster`, `adjustment`, `group`; fonts `dm_sans`, `cormorant`, `montserrat`, `playfair_display`, `poppins`, `lora`, `bebas_neue`, `inter`; alignment `left`, `center`, `right`; list filter `active`, `templates`, `trash` | — | Kinds "Texto", "Imagem", "Retângulo", "Elipse", "Linha", "Camada", "Ajuste", "Grupo"; fonts "DM Sans", "Cormorant Garamond", "Montserrat", "Playfair Display", "Poppins", "Lora", "Bebas Neue", "Inter"; alignment "À esquerda", "Centralizado", "À direita"; filter "Ativos", "Modelos", "Lixeira" | image-editor |
| `DesignBlendMode` | TypeScript only, `src/lib/shared/design/types.ts`; stored in the document JSON as `blendMode` on every element (P1, decided 2026-11-17, default `normal`). `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity` (the Canvas 2D `globalCompositeOperation` values) | — | "Normal", "Multiplicar", "Tela", "Sobrepor", "Escurecer", "Clarear", "Subexposição de cores", "Superexposição de cores", "Luz direta", "Luz suave", "Diferença", "Exclusão", "Matiz", "Saturação", "Cor", "Luminosidade" | image-editor |
| `DesignTool`, `DesignToolGroup`, `DesignAlign`, `DesignDistribute`, `DesignPanel` | TypeScript only, `src/lib/shared/design/types.ts` (editor UI state, never stored in the document). Tool group (P3, which tools share a rail button; a group with no enabled tool is not shown) `move`, `selection`, `crop`, `eyedropper`, `paint`, `tone`, `fill`, `text`, `shapes`, `hand`, `zoom`; tool `move`, `text`, `rect`, `ellipse`, `line`, `hand`, `zoom`, `eyedropper`, `brush`, `eraser` (enabled; the last three from P5b1); `clone` (enabled from P11, key S), `dodge` and `burn` (P11, group `tone`, key O, Shift+O alternates); `crop` is enabled from P9 (group `crop`, key C); from P8 `fill` and `gradient` are enabled (group `fill`, key G, Shift+G alternates); align `left`, `center_x`, `right`, `top`, `center_y`, `bottom`; distribute `horizontal`, `vertical`; panel (tab of the dock, P3) `layers`, `properties`, `adjustments`, `history`, `brand` | — | Tools "Mover", "Texto", "Retângulo", "Elipse", "Linha", "Mão", "Zoom", "Seleção retangular", "Laço", "Varinha mágica", "Cortar", "Conta-gotas", "Pincel", "Carimbo", "Subexposição", "Superexposição", "Borracha", "Balde de tinta", "Gradiente"; align and distribute as in the glossary 4d; panels "Camadas", "Propriedades", "Ajustes", "Histórico", "Marca" | image-editor |
| `PaintSampleMode` | TypeScript only, `src/lib/shared/design/paint.ts` (P5b1, eyedropper option, editor UI state): `layer`, `all`. Tools `brush`, `eraser` and `eyedropper` are enabled from P5b1; keys `X` (swap colors), `D` (default colors), `[` `]` (brush size), `{` `}` or Shift+`[` `]` (hardness), digits `1`..`9`, `0` (tool opacity 10..100%) | — | "Camada atual", "Camadas de pixels" | image-editor |
| `AdjustmentType`, `ChannelTarget`, `ToneRange` | TypeScript only, `src/lib/shared/design/raster/adjustment-types.ts` (P2; labels added in P8). Adjustment `brightness_contrast`, `levels`, `curves`, `hue_saturation`, `color_balance`, `black_white`, `invert`, `threshold` (the `type` of `adjustment` inside an element of kind `adjustment`, validated by `adjustmentSchema`); channel `rgb`, `red`, `green`, `blue`; tone range `shadows`, `midtones`, `highlights` | — | Adjustments "Brilho/contraste", "Níveis", "Curvas", "Matiz/saturação", "Equilíbrio de cores", "Preto e branco", "Inverter", "Limiar"; channels "RGB", "Vermelho", "Verde", "Azul"; tones "Sombras", "Tons médios", "Realces" | image-editor |
| `GradientKind` | TypeScript only, `src/lib/shared/design/fill-tools.ts` (P8, gradient tool option, editor UI state): `linear`, `radial` | — | "Linear", "Radial" | image-editor |
| `DesignFilter` | TypeScript only, `src/lib/shared/design/raster/filter-types.ts` (P11, destructive filter of a raster layer, editor UI state): `gaussian_blur`, `sharpen`, `noise`, `pixelate` | — | "Desfoque gaussiano", "Nitidez", "Ruído", "Mosaico" | image-editor |
| `CropRatio` | TypeScript only, `src/lib/shared/design/crop.ts` (P9, crop tool option, editor UI state): `free`, `original`, `square`, `portrait`, `story`, `landscape` (`original` is the ratio of the page; `square` 1:1, `portrait` 4:5, `story` 9:16, `landscape` 16:9). The cropped size is stored as `width` and `height` of the page in the document (version 3, 64 to 4096), no new field | — | "Livre", "Original", "1:1", "4:5", "9:16", "16:9" | image-editor |
| `LayerMaskKind` | TypeScript only, `src/lib/shared/design/layer-mask.ts` (P10, how a layer mask is created, editor UI state; the mask itself is the `mask` field of the document): `reveal_all`, `hide_all`, `reveal_selection`, `hide_selection` | — | "Revelar tudo", "Ocultar tudo", "Revelar seleção", "Ocultar seleção" | image-editor |
| `DesignImportFormat` | `src/lib/shared/design/import/types.ts` (import of a file into the editor; the format is also stored as `design_import_metadata.source_format`, Phase 1; moved there from `design-import.ts` in Phase 0 item 0-2; the code holds all six since Phase 0 item 0-8; later formats are added per phase with their handler): `psd`, `ai`, `pdf`, `png`, `jpeg`, `webp`, `svg` (Phase 3a), `sketch` (Phase 4; handler registered, produces no metadata yet), `tiff`, `avif`, `gif`, `ase`, `aco`, `gpl` (the code holds all 14 values; a handler is registered for each; `font` is not a format) | `design_import_metadata.source_format` (the CHECK lists the 14 values since migration `20261119120000_design_import_metadata_formats`) | "PSD", "AI", "PDF", "PNG", "JPEG", "WebP", "SVG", "Sketch", "TIFF", "AVIF", "GIF", "ASE", "ACO", "GPL" | image-editor |
| `DesignImportKind` | TypeScript only, `src/lib/shared/design/import/types.ts` (what a handler returns): `document`, `image`, `palette` (Phase 2 item 2-0: ASE, ACO and GPL swatches, routed to a palette consumer, never to the page placer; `needs_choice` is an outcome of the orchestrator seam and not a handler kind, see image-editor 8h.1 item 4) | — | — | image-editor |
| `WorkerStatus` | TypeScript only, `src/lib/shared/design/import/worker/protocol.ts` (internal discriminant of the import worker responses, never stored or shown): `progress`, `result`, `error` | — | — | image-editor |
| `DesignImportFailure` | TypeScript only, `src/lib/shared/design/import/types.ts` (why the PSD worker refused a file; mapped to `DESIGN_IMPORT_MESSAGE` by `worker-client.ts`): `corrupt`, `memory`, `too_many_layers`, `layer_too_large`, `no_layers`, `image_too_large` (the image decoder refused a size; carried as a typed `reason` on the failure so a message edit never changes the remap of the GIF and AVIF handlers) | — | see glossary "Recusas da importação" | image-editor |
| `DesignImportNoteKind` | TypeScript only, `src/lib/shared/design/import/types.ts` (what an import could not keep; sentences in `DESIGN_IMPORT_MESSAGE`): `text_as_pixels`, `smart_object_as_pixels`, `layer_style_dropped`, `adjustment_layer_dropped`, `blend_mode_fallback`, `clipping_partial`, `groups_flattened`, `flattened_image_only`, `cmyk_converted`, `depth_reduced`, `first_page_only`, `downscaled`, `animation_ignored`, `swatch_converted` (Phase 2: palette swatches converted from CMYK, Lab, gray or HSB to RGB by naive formulas; `count` is the number converted), `metadata_truncated` (Phase 1: a list of the import metadata was cut at its cap; `count` is the number of cut lists); `unsupported_node` (Phase 4: Sketch layers or nodes with no equivalent, dropped and counted; `count` is the number dropped); `vector_rasterized` (Phase 3a: an SVG was drawn into pixels and can no longer be edited as a vector; `count` is 1); `fonts_not_imported` (Phase 3a: the SVG has text that uses system fonts, the fonts of the file are not imported; `count` is the number of `text` elements); the code holds all 18 values | — | see glossary "Observações da importação" | image-editor |
| `DesignFontLicenseClass` | TypeScript only, `src/lib/shared/design/import/handlers/font-parse.ts` (Phase 3b, parser only; stored only after the SEC-7 change and the 3-9 and 3-10 decisions, image-editor 8h.2 A4): `installable` (fsType 0x0000, accepted), `editable` (0x0008, accepted), `bitmap_only` (0x0200, refused), `preview_print` (0x0004, refused), `restricted` (0x0002, refused); the most restrictive set bit wins, 0x0100 (no subsetting) is allowed, any reserved bit (for example 0x0001) counts as `restricted` | — | not shown yet (the dialog is blocked) | image-editor |
| `SketchRefusal` | TypeScript only, `src/lib/shared/design/import/types.ts` (why the Sketch engine or its ZIP and schema readers refused a file; carried as a typed `reason` and `args` on the failure and across the worker boundary, mapped to `DESIGN_IMPORT_MESSAGE` by `refusal.ts`): `corrupt`, `not_zip`, `unsupported_version`, `no_artboards`, `no_layers`, `memory`, `layer_too_large`, `timed_out`, `read_failed`, `encrypted`, `zip_entries`, `zip_too_large`, `zip_ratio`, `zip_path`, `canvas_too_large`, `canvas_too_small`, `too_many_layers`, `image_too_large` | — | see glossary "Recusas da importação" | image-editor |
| `TiffRefusal` | TypeScript only, `src/lib/shared/design/import/worker/tiff-header.ts` (why the TIFF pre-pass or worker refused a file; mapped to the TIFF catalog sentences by `tiff-client.ts`): `corrupt`, `unsupported`, `too_large` | — | see glossary "Recusas da importação" | image-editor |
| `FontParseFailure` | TypeScript only, `src/lib/shared/design/import/handlers/font-parse.ts` (why the font parser refused bytes; mapped to catalog texts when the font handler is registered): `too_large`, `corrupt`, `collection`, `unsupported`, `no_license_info` | — | not shown yet | image-editor |
| `DesignImportColorMode` | TypeScript only, `src/lib/shared/design/import/types.ts` (Phase 1: color mode of the source file, a field of `ImportedDesign.metadata`, 8h.5; stored inside the metadata JSON, never shown): `grayscale`, `rgb`, `cmyk`, `indexed`, `bitmap`, `unknown` | — | — | image-editor |
| `DesignExportFormat` | `png`, `jpeg` | `design_exports.format` | "PNG", "JPEG" | image-editor |
| `DesignSaveState`, `LayerMove` | TypeScript only, `src/lib/shared/design/types.ts`. Autosave state `saved`, `pending`, `saving`, `conflict`, `failed`, plus the pixel flush states `uploading`, `upload_failed` (P5b2); layer move `up`, `down`, `top`, `bottom` | — | Save state "Rascunho salvo", "Alterações não salvas", "Salvando…", "Alterado em outra aba", "Não foi salvo", "Enviando pixels…", "Pixels não enviados"; layer moves "Trazer para frente", "Enviar para trás" | image-editor |

## 2e. Video editor

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `DesignPreset` (reused) | `feed_square`, `feed_portrait`, `story` | `video_projects.preset` | the labels of section 2d | video-editor |
| `VideoClipKind`, `VideoFit`, `VideoTrack`, `VideoTrimEdge`, `VideoStatusFilter` | TypeScript only (no column; the first two live inside the document JSON): see `src/lib/shared/video/types.ts`. Clip kind `video`, `image`; fit `cover`, `contain`; track `main`, `overlay`, `text`, `audio`; trim edge `start`, `end`; list filter `active`, `trash` | — | Kinds "Vídeo", "Imagem"; fit "Preencher", "Ajustar"; tracks "Principal", "Sobreposição", "Texto", "Música"; filter "Ativos", "Lixeira" | video-editor |
| `ExportMessage` | TypeScript only, `src/lib/shared/video/export-protocol.ts`: messages between the editor and the export worker, `start`, `cancel`, `progress`, `done`, `failed`, `cancelled` | — | — | video-editor |
| `VideoExportStage` | TypeScript only, `src/lib/shared/video/types.ts`: `preparing`, `rendering`, `uploading`, `done`, `failed`, `cancelled` | — | "Preparando…", "Gerando o vídeo…", "Enviando para a biblioteca…", "Vídeo exportado", "Não foi possível exportar", "Exportação cancelada" | video-editor |

## 3. Media

| TS constant | Values | DB column ✔ | pt-BR labels | Owner |
|---|---|---|---|---|
| `MediaScope` | `site`, `brand`, `profile` | `media_assets.scope` (`media_collections.scope` has only `site`, `brand`) | "Site", "Marca", "Fotos de perfil" | media-library |
| `MediaShareStatus` | `active`, `revoked`, `target_deleted` | `media_shares.status` | "Ativo", "Encerrado", "Arquivo removido" | media-library |
| `ShareKind` | `asset`, `collection` | argument of `media_share_create` and `media_share_list` | — | media-library |
| `SharePasswordAction` | `keep`, `set`, `clear` | `media_share_update` | — | media-library |
| `PublicShareState` | `ok`, `not_found`, `revoked`, `unavailable`, `expired`, `locked`, `exhausted`, `password_required`, `wrong_password`, `download_disabled` | answer of the public share functions | see `publicShareStateMessages` | media-library |
| `MediaVersionStatus` | `pending`, `processing`, `available`, `failed` | `media_versions.status` | "Enviando", "Processando", "Disponível", "Falhou" | media-library |
| `UploadSessionStatus` | `open`, `confirmed`, `expired`, `failed` | `media_upload_sessions.status` | — (internal) | media-library |
| `MediaUsageType` | `content_revision`, `site_page_revision`, `case_study`, `brand_identity`, `publication_evidence`, `profile_avatar`, `design_version`, `video_project_version` | `media_usages.usage_type` | "Revisão de conteúdo", "Página do site", "Case", "Identidade da marca", "Evidência de publicação", "Foto de perfil", "Versão de design", "Versão de vídeo" | media-library |
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
| `NotificationKind` | `approval.requested`, `approval.decided`, `approval.superseded`, `approval.approved_by_team`, `approval.overdue`, `content.due_soon`, `content.overdue`, `content.publish_due`, `comment.created`, `calendar.event`, `invitation.accepted`, `invitation.expiring`, `site.published`, `site.contact_message`, `media.upload_failed`, `channel.connection_expiring`, `channel.connection_expired`, `content.publish_failed`, `content.published_auto`, `metrics.report_published`, `feedback.received` | `notification_kinds.kind` (FK) | Authoritative list and recipients in notifications.md | notifications |
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
| `StoredKey` | `lib/shared/stored-keys.ts` | `CalendarView`, `CalendarRange`, `SidebarOpen`, `LastSpace`, `ListColumns`, `ApprovalDraftComment`, `FeedbackDraft` (per brand and month: the unsent answers of the monthly survey), `PortalFeed` (per brand: last filter and first visible post of the portal feed), `DesignPanelTab` (the active tab of the design editor's docked panels, a `DesignPanel` value) (all prefixed `aura:`) |
| `Action` | `lib/shared/auth/actions.ts` | Generated shape: `Action.<Module>.<Verb>` for every row of the actions catalog |
| `AuditAction` | `lib/shared/audit/actions.ts` | `AuditAction.<Domain>.<Verb>` for the audit catalog |

## 7. How to add or change a value

1. Add or change the row here (values, constant, column, labels).
2. Change the `CHECK` in a **new** migration (expand → migrate → contract; never edit an applied one).
3. Change the constant, the zod schemas that use it (`z.nativeEnum`) and the status mapping (`StatusBadge` tone / `statusStyles`).
4. Update the module document (statuses and transitions) and, if it affects visuals, [../standards/color-palette.md](../standards/color-palette.md).
5. Run `npm run check:consistency`.
