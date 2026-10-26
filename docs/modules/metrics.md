# Module — Metrics and reports

> **Status: decided to build (2026-10-26, product owner: "start the implementation of all phases"); first delivery implemented the same day in code and migrations, never opened in a browser or run with real data, see section 16.** The open decisions of section 14 take the recommended answer unless a row says otherwise. Per-chart table switch, help text and share button were dropped the same day. It specifies the screen where the manager reads the growth of a brand's social network and **explains it to the client**. It reads the data collected by the connection described in [instagram-publishing.md](instagram-publishing.md) (section 5.6) and extends [dashboard.md](dashboard.md) and [portal.md](portal.md), which today exclude metrics. Names below are proposals: per GOLD-4 they enter the registries ([../reference/README.md](../reference/README.md)) in the change that implements them. UI copy is Brazilian Portuguese (in quotes).

## 1. Objective

1. **Show growth clearly.** One screen per brand and channel with charts of followers, reach, interactions and the posts that performed best, for any period, compared with the period before.
2. **Make it easy for the manager to explain.** The screen does not only show numbers: it says in plain language what happened ("Você ganhou 214 seguidores a mais que no mês anterior"), lets the manager add notes and marks (a campaign, a viral post), and produces something the client can understand without help.
3. **Give the client a view that is already prepared.** The manager chooses what the client sees, adds a message, and publishes a **report** in the client portal. The client never sees raw dashboards that were not curated, and numbers do not change after the report is published.

Out of this module: data collection (it belongs to [instagram-publishing.md](instagram-publishing.md)), competitor benchmarking, paid ads metrics, other platforms in the first delivery, AI-written analysis (the highlights are produced by fixed rules, section 6).

## 2. Who uses it and how

| Person | Wants | Gets |
|---|---|---|
| **Manager** (internal, with `metrics.view`) | Understand a brand quickly, find what to repeat, prepare the monthly conversation | The analysis screen (section 4), notes and marks, the report builder (section 7) |
| **Client** (external, portal) | Know if the money and the effort are paying off, in two minutes, without jargon | The published reports and a simple "Resultados" page (section 8) |
| **Owner / leadership** | Compare brands and see which ones are growing | A summary row per brand on the existing dashboard (later) |

The test of the design: *can the manager open the screen, pick "Último mês", click "Criar relatório" and send the client a clear story in under five minutes?*

## 3. Data it reads

Only the tables of [instagram-publishing.md](instagram-publishing.md) section 5.6: `channel_metric_daily` (account and followers by day), `channel_audience_snapshot` (audience), `content_channel_metrics` (per post at 1 h, 24 h, 7 d, 30 d) and `channel_media_index` (post catalogue), plus the content and channel row records of Compasso (to link a post to its approved content, format and planned date). Everything is read in the **brand's time zone** ([brands.md](brands.md)); a day is cut there, and every chart and report states the zone (UI-11).

What the data cannot give (said on the screen, not hidden):

- **History starts at the connection** (plus what Meta returns for the backfill). The screen shows "Dados a partir de dd/mm/aaaa" and never invents earlier days.
- **Followers before the connection are unknown.** Growth is shown from the first stored day.
- **Audience needs 100+ followers** (Meta rule); below it the block says so.
- **Missing is not zero.** A day without data is a gap in the chart and "Sem dados" in text.
- **Today is incomplete.** The current day and the last day are marked "parcial" until Meta finishes them.
- **Posts made outside Compasso** appear (without the link to a content) and are labeled "Publicado fora do Compasso".

## 4. The analysis screen (internal)

Route: tab "Métricas" of the brand, `/admin/marketing/brands/$brandId/metrics` (proposal), guard `metrics.view`. It follows the tab layout of [brands.md](brands.md): full width, same page header, filters in the URL (UI-1, UI-6).

### 4.1 Controls

| Control | Behavior |
|---|---|
| Channel | Segmented selector (first delivery: Instagram only; the control exists so other platforms fit later). Remembered in the URL |
| Period | "Últimos 7 dias", "Últimos 30 dias", "Últimos 90 dias", "Este mês", "Mês passado", custom range (`date-range-picker`). Default: last 30 days |
| Compare with | "Período anterior" (default), "Mesmo período do ano passado" (when data exists), "Sem comparação" |
| Granularity | Day, week, month; chosen automatically by the period, changeable |
| Actions | "Criar relatório", "Exportar PDF", "Atualizar dados" (shows when the last collection ran) |

Changing a control updates the URL and every block together; the previous response never replaces a newer one (UI-1).

### 4.2 Blocks, top to bottom

The order is the order of the story the manager tells: **how are we, what grew, what worked, who is the audience, what next.**

| # | Block | What it shows | Chart |
|---|---|---|---|
| 1 | **Resumo do período** | Four to six tiles: Seguidores (total and net gain), Alcance, Visualizações, Interações, Visitas ao perfil, Posts publicados. Each tile: big number, **change against the comparison period** in absolute and percent with an arrow and a word ("subiu", "caiu", "estável"), and a small trend line | Stat tile with sparkline |
| 2 | **Frase-resumo** | One or two sentences generated from the numbers, for example "Em outubro, o perfil ganhou 214 seguidores (+18% em relação a setembro) e o alcance cresceu 32%." Always editable by the manager in the report (section 7) | Text |
| 3 | **Crescimento de seguidores** | Total followers over time; below it, bars of new followers and lost followers per day or week. Marks (section 5) appear as labeled vertical lines. The comparison period is drawn as a lighter line | Line/area + bars, shared time axis |
| 4 | **Alcance e visualizações** | Daily or weekly reach and views, split when possible into "seguidores" and "não seguidores" (growth beyond the current audience is the sign of discovery). Comparison line | Area / stacked bars |
| 5 | **Interações** | Likes, comments, saves, shares per period, and the **engagement rate** (interactions over reach, defined in the glossary) | Stacked bars + one line |
| 6 | **Melhores posts** | Ranked list (top 5 by the metric the manager picks: alcance, interações, salvamentos, compartilhamentos), each row with the post preview, date, format, caption excerpt, its numbers and a link to the post and, when it was made in Compasso, to the **content** (so the manager sees what was approved) | Table with inline bars |
| 7 | **O que funciona** | Average result **by format** (post, carrossel, reel, story) and **by day of week and hour** ("melhor horário"). Shows the number of posts behind each bar and hides a bar with fewer than three posts ("poucos posts para comparar") | Horizontal bars; heat grid (day × hour) |
| 8 | **Audiência** | Age and gender, top cities and countries, when followers are online. Weekly snapshot, with the comparison to the previous snapshot | Bars; grid |
| 9 | **Conteúdo planejado x publicado** | Posts planned in the period against published ones, how many were automatic, how many failed. Ties the metrics to the team's work | Small table |
| 10 | **Anotações** | The manager's notes and marks in the period (section 5) | List |

Blocks 3 to 8 each have a title that states the conclusion when it is clear (for example "Seguidores: +214 no mês") and use the same period and comparison as the page. Decided 2026-10-26: there is **no** per-chart "Ver como tabela" switch, no per-chart help text and no per-chart share button; the chart's `aria-label` states the conclusion instead (section 10).

### 4.3 Reading aids for the manager

- **Help text in plain language** for every metric (glossary, section 9). Hovering a term never hides essential information.
- **Highlights** (section 6) at the top: up to five facts, ordered by importance, each with a link that scrolls to its block.

### 4.4 States (UI-2)

Skeleton that keeps the layout height → error with retry → **not connected** ("Conecte o Instagram deste canal para ver as métricas", button to the channel panel) → **connected, collecting** ("Estamos coletando os primeiros dados; volte em um dia") → **no data in the period** → **partial** (tiles that have no data say "Sem dados", never 0) → complete.

## 5. Notes and marks (the manager's story)

Numbers alone do not explain growth. The manager records **what happened** on a day:

| Item | Rule |
|---|---|
| Mark | A date (or range), a short label ("Início da campanha de Dia das Mães"), a type (`campaign`, `viral_post`, `partnership`, `event`, `other`), and optionally a link to a content. Drawn on the time axes of blocks 3 to 5 and listed in block 10 |
| Note | Free text attached to the period or a block, for the manager's own memory. Internal by default; shown to the client only if the manager includes it in a report |
| Automatic marks | Compasso adds marks it already knows: the publication of each content ("Publicado: <title>") and a connection event. They can be hidden |
| Rules | Create, edit and delete by people with `metrics.report`; audited (ids only); each mark has the author and time |

## 6. Highlights (automatic text, no AI)

A fixed set of rules turns the data into sentences, so the result is predictable, testable and never invents a cause. A rule fires only when the change is above a threshold and the data is complete enough.

| Rule | Example sentence (pt-BR) |
|---|---|
| Follower growth against the comparison period | "Você ganhou 214 seguidores, 18% a mais que no mês anterior." |
| Reach growth or drop | "O alcance cresceu 32%: mais gente viu seus posts." |
| Best post | "O post de 12/10 foi o de maior alcance: 4.820 pessoas." |
| Best format | "Carrosséis tiveram, em média, 2,1 vezes mais salvamentos que posts de imagem." (only with enough posts) |
| Best time | "Quintas às 19h concentram os melhores resultados." (only with enough posts) |
| Reach beyond followers | "62% do alcance veio de quem ainda não segue você." |
| Posting rhythm | "Foram 9 posts, contra 14 no mês anterior." |
| Drop alert | "O alcance caiu 24%. Veja se houve menos posts ou mudança de horário." |
| Data limits | "Faltam dados do dia 03/10." |

The thresholds and the wording live in one module (`lib/shared/metrics/highlights.ts`, proposal) with unit tests per rule; every sentence is a template with the numbers filled in. A sentence never states a cause the data cannot prove; it states a fact and, at most, a question. Whether to add AI-written commentary later is an open decision (M-5).

## 7. Reports (what the manager sends)

A **report** is a frozen, curated view of one period for one channel, written for the client.

### 7.1 Building a report

"Criar relatório" opens a builder (a full page, not a dialog):

1. **Period and comparison** (taken from the analysis screen, editable).
2. **Blocks to include**: a checklist of the blocks of section 4.2 (default: summary, sentence, followers growth, reach, best posts, what works, next steps). Each block can have a custom title and a short **comment by the manager** ("Este mês o foco foi reels; veja que o alcance dobrou").
3. **Message to the client**: a short introduction (a few lines) and **"Próximos passos"** (up to five bullet items for the next period, which turns the report into a plan).
4. **Marks to show** (which of section 5).
5. **Preview** exactly as the client will see it, in the portal layout.
6. **"Publicar para o cliente"**: confirmation dialog naming the brand and period; the numbers are **frozen** at that moment.

### 7.2 Rules

| Rule | Detail |
|---|---|
| Snapshot | On publish, the numbers of every included block are copied into the report (JSON). The report never changes afterwards, even if Meta revises the data. A correction is a new version, linked to the previous one; the client sees the latest and the history |
| Draft | Auto-saved while editing; a draft is internal only |
| Status | `draft`, `published`, `withdrawn` (`withdrawn` hides it from the client but keeps the record, GOLD-8) |
| Notification | Publishing sends the portal notification "Novo relatório de resultados" to the brand's portal users who have the action, through `notify_users` in the same transaction |
| Audit | `metrics_report.published`, `metrics_report.withdrawn` (ids and period only) |
| Concurrency | `version` on the draft (DATA-5); two managers editing show the conflict instead of overwriting |
| Cadence | A "mensal" suggestion: on the first days of the month, the dashboard reminds the manager "Relatório de outubro ainda não enviado" (a scan like the other alerts) |

### 7.3 Delivery formats

| Format | Use | How |
|---|---|---|
| **In the portal** | The default: the client opens the report with login | Section 8 |
| **PDF** | To attach to an email or a meeting | A print stylesheet of the report page (`@media print`), so the browser produces the PDF; no new dependency. A server-side PDF engine is a later option and needs a reason (CODE-12) |
| **Public link** | **Not offered.** Anonymous access conflicts with the decision that external users always sign in ([../technical-architecture-v0.1.md](../technical-architecture-v0.1.md), out of scope: anonymous links). Revisit only by changing that rule first |

## 8. What the client sees (portal)

Routes (proposal): `/portal/brands/$brandId/metrics` (the list and the latest report) and `/portal/brands/$brandId/metrics/$reportId`, guard `portal.view` plus the action `metrics.portal_view` (so a brand can have the portal without metrics).

- **"Resultados"** opens on the **latest published report**: the message, the summary tiles, the growth story, the best posts, "Próximos passos". Language is plain, no abbreviations without explanation, large numbers, one idea per block, readable at 360 px (UI-7).
- **Older reports** in a list by month, each openable and printable.
- **Read-only**; the client can comment on a report block using the same comment component as approvals (a later improvement), which gives the manager a place to answer questions.
- **Data access**: the portal never reads the metrics tables; it calls `portal_metrics_report_list` and `portal_metrics_report_get`, which return the **frozen snapshot** and explicit columns only (DATA-2). The snapshot is **projected in SQL** (`metrics_snapshot_for_portal`) to the blocks the manager chose: data of a block that was left out comes back empty, and the posts never carry the internal content id, title or channel row id, whatever the stored snapshot holds. The internal marks and the publication counts reach the client only when the blocks "Marcas e anotações" and "Planejado e publicado" are in the report.
- Thumbnails of posts come from Compasso's own previews (display copies) for content made in the tool; for posts made outside it the report shows the caption excerpt and an "Abrir no Instagram" link, because Meta's image addresses expire and are not stored.

## 9. Glossary of metrics (UI copy)

Each term appears with the same label and explanation everywhere; the final list enters [../standards/ui-glossary.md](../standards/ui-glossary.md) when implemented.

| Label | Plain explanation shown to the manager and the client |
|---|---|
| Seguidores | Pessoas que acompanham o perfil |
| Novos seguidores / Deixaram de seguir | Quem começou e quem parou de seguir no período |
| Alcance | Quantas pessoas **diferentes** viram o conteúdo, ao menos uma vez |
| Visualizações | Quantas vezes o conteúdo foi visto (a mesma pessoa pode ver mais de uma vez) |
| Interações | Curtidas, comentários, salvamentos e compartilhamentos somados |
| Taxa de engajamento | Interações divididas pelo alcance: mostra quanto o conteúdo envolve quem o vê |
| Salvamentos | Pessoas que guardaram o post para ver depois: sinal de conteúdo útil |
| Compartilhamentos | Vezes em que o post foi enviado a outras pessoas: sinal de que vale indicar |
| Visitas ao perfil | Pessoas que abriram o perfil depois de ver o conteúdo |
| Alcance de não seguidores | Parte do alcance que veio de quem ainda não segue o perfil: mostra descoberta |
| Melhor horário | Dia e hora com melhor resultado médio nos posts do período |

The exact metric names depend on Meta's reference (see [instagram-publishing.md](instagram-publishing.md), section 3, Insights); a label is shown only for a metric that is confirmed and collected.

## 10. Charts: how they are built

| Topic | Decision |
|---|---|
| Library | The design system already plans a chart component "copied only if a screen needs it" ([../standards/design-system.md](../standards/design-system.md)): add the `shadcn` chart wrapper over a charting library (proposal: Recharts), with the reason in the commit message (CODE-12) and a note in the technical-architecture stack table |
| Colors | **Tokens only** (UI-9). New chart tokens (`chart-1` to `chart-5`, sequential and diverging ramps, comparison "muted" line) are added to [../standards/color-palette.md](../standards/color-palette.md) and `src/styles.css` with the contrast verified (at least 3:1 against the surface for lines and marks, 7:1 for text) **before** use. The categorical palette must stay distinguishable for color-blind people |
| Not by color alone | Every series also differs by label, line style or direct label at the end of the line; legends are keyboard-reachable; states are never only color (UI-8) |
| Accessible alternative | Each chart has an `aria-label` that states the conclusion ("Seguidores subiram de 3.120 para 3.334 no período") and its values are reachable by keyboard (focusable points with a visible value). No table switch (decided 2026-10-26) |
| Choice of chart | Line or area for change over time; bars for comparing categories and for counts per period; a grid (heat map) only for day × hour; **no pie or donut** (hard to compare) and no 3-D; the number always visible next to the shape |
| Axes and scale | Axes start at zero for bars; line charts may use a tight range but state it; dates in the brand zone through `format.ts`; numbers in pt-BR (thousands separator) through `format.ts` (UI-14) |
| Responsive | At 360 px: tiles in two columns, charts full width with fewer ticks, tables scroll inside their card; touch targets 44 px (UI-7). Charts do not rely on hover: the value of a point is also reachable by tap and keyboard |
| Motion | Entry animation off under `prefers-reduced-motion` |
| Small data | With fewer than 7 days of data the line charts show the points and a notice instead of a flat trend |
| Print | The report page has a print layout: one block per page break, the palette's ink on surface tokens (never pure black or white), charts rendered without interaction |
| Performance | The server returns already aggregated series for the chosen granularity (DATA-14); the browser never receives thousands of raw rows; the chart module is loaded only on the metrics routes |

## 11. Data, functions and permissions (proposals)

**Tables** (besides those of [instagram-publishing.md](instagram-publishing.md) 5.6, all with RLS by action and brand, DATA-1, DATA-3):

| Table | Purpose |
|---|---|
| `metric_marks` | Marks and notes: `brand_id`, `channel_id` nullable, `starts_on`, `ends_on` nullable, `kind`, `label`, `content_item_id` nullable, `created_by` |
| `metric_reports` | The report: `brand_id`, `channel_id`, `period_start`, `period_end`, `compare_mode`, `title`, `message`, `next_steps jsonb`, `blocks jsonb` (selection and comments), `snapshot jsonb` (frozen numbers, set on publish), `status`, `version`, `previous_report_id` nullable, `published_by`, `published_at` |

`snapshot` and the published columns are immutable after publish (DATA-6, trigger); a correction is a new row.

**Functions** (names to be added to [../reference/functions.md](../reference/functions.md) in the implementing change; all multi-step writes are one transaction with `audit_write`, DATA-4):

| Function | Role |
|---|---|
| `metrics_overview(p_brand, p_channel, p_from, p_to, p_compare, p_granularity)` | Series and totals for blocks 1 to 5, aggregated in SQL |
| `metrics_top_posts(p_brand, p_channel, p_from, p_to, p_by, p_limit)` | Block 6 |
| `metrics_breakdown(p_brand, p_channel, p_from, p_to, p_dimension)` | Block 7 (format, weekday, hour) |
| `metrics_audience(p_brand, p_channel, p_on)` | Block 8 |
| `metric_mark_save`, `metric_mark_delete` | Marks |
| `metrics_report_save`, `metrics_report_publish`, `metrics_report_withdraw` | Reports |
| `portal_metrics_report_list`, `portal_metrics_report_get` | Portal, snapshot only, `security definer`, explicit columns |

**Actions** (add to [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md)): `metrics.view` (read the analysis screen of linked brands), `metrics.report` (create marks, build, publish and withdraw reports; requires `metrics.view`), `metrics.portal_view` (external: read published reports; requires `portal.view`). Effective permission is the action **and** the brand link (SEC-2); the four layers apply (menu, route, server, RLS).

**Audit actions**: `metrics_report.published`, `metrics_report.withdrawn`, `metric_mark.created`, `metric_mark.deleted`. **Notification kinds**: `metrics.report_published` (portal), `metrics.report_due` (internal reminder). **Error codes**: `report_empty` (no block chosen), `report_period_invalid`, `report_already_published`, `no_data_in_period`, `conflict`, `denied`.

**Code placement**: SQL and server functions in `src/lib/marketing/metrics/` (functions, schemas, types); shared highlight rules and formatting in `src/lib/shared/metrics/`; UI in `src/components/marketing/metrics/` and the portal read-only report in `src/components/portal/metrics/`, with the pieces used by both (tile, chart wrappers, report view) in `src/components/shared/metrics/`. A space never imports from another (AGENTS.md). Query keys in `QueryKey.Metrics.*`.

## 12. Phases

| Phase | Delivers | Depends on |
|---|---|---|
| M1. Analysis screen, read-only | Controls, blocks 1 to 5 and 10, tables alternative, states, glossary | Collection (instagram-publishing phase 4b) with at least some days of history; chart tokens |
| M2. Posts and patterns | Blocks 6 to 9, highlights (section 6) | M1; per-post data at 24 h and 7 d |
| M3. Marks | Section 5 | M1 |
| M4. Reports in the portal | Builder, snapshot, publish, notification, portal pages, print/PDF | M1 to M3; portal action |
| M5. Reminders and summary on the dashboard | Monthly reminder, a row per brand | M4 |
| Later | Other platforms, client comments on a report, optional AI commentary, goals ("meta de 5 mil seguidores") | Decisions M-5, M-6 |

## 13. Acceptance criteria

- [ ] A manager with `metrics.view` and a link to the brand sees the analysis screen; one without the action, one linked to another brand, an external user and `anon` do not (pgTAP and route tests).
- [ ] Every tile and chart is computed over the chosen period and comparison, in the brand's time zone.
- [ ] A day without data is a gap and says "Sem dados"; it is never drawn or summed as zero. Today is marked partial.
- [ ] A bar by format or hour with fewer than three posts is hidden with the explanation.
- [ ] Highlight sentences are produced only by the rules of section 6, each with a unit test, and none states a cause.
- [ ] A report published to the portal keeps its numbers when the underlying data changes later; correcting it creates a new version.
- [ ] The client sees only published reports of brands they are linked to, through `portal_*` functions; the metrics tables are unreadable to external roles (pgTAP).
- [ ] The report prints to PDF in a readable layout at A4, and the portal report is usable at 360 px.
- [ ] All charts use design tokens whose contrast was verified, work by keyboard, have a descriptive `aria-label` and respect `prefers-reduced-motion`.
- [ ] Skeleton, error, not connected, collecting, no data, partial and complete states exist; no double submit when publishing a report; unsaved-changes warning in the builder.
- [ ] SQL and TS constants match (`check:consistency`); documents and registries updated (`check:docs`).

## 14. Open decisions (with a recommendation)

| ID | Question | Recommendation |
|---|---|---|
| M-1 | Charting library | Recharts through the shadcn chart wrapper (already planned in the design system); decide against a lighter option only if the bundle cost is a problem |
| M-2 | Is the first delivery internal-only, or does it include the portal report? | Internal screen first (M1 to M3) so history accumulates and the manager learns the data; the portal report (M4) right after, because it is the part the client sees |
| M-3 | Does the client see a live dashboard too, or only curated reports? | Only reports. A live view invites questions about every dip that the manager has not yet had a chance to explain |
| M-4 | PDF by the browser's print or by a server engine | Browser print first; revisit if the layout is not consistent enough |
| M-5 | AI-written commentary | Not in the first delivery. Fixed rules first; an optional "sugerir texto" that the manager edits can be proposed later, with its own privacy review (SEC-12) |
| M-6 | Goals and targets | Later; needs a place to set a target per brand and a progress block |
| M-7 | Does the client see posts made outside Compasso? | The manager decides per report by including the block; the data is collected either way |
| M-8 | Cadence of the report | Monthly by default, with the reminder; weekly and custom allowed |
| M-9 | Benchmarks (average of the brand's segment) | Not available through the API; do not promise them |

## 15. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Metrics definitions change on Meta's side | Charts break or lie | Names only from the reference, zod validation of every response, a label shown only for a confirmed metric |
| Numbers differ from what the client sees in the Instagram app | Loss of trust | A note on every report: "Os números vêm do Instagram e podem diferir de outros relatórios por data de corte e fuso"; use the account's own definitions and say so |
| Little data in the first weeks | Empty or flat charts | Collecting state, backfill, "Dados a partir de…" and the small-data notice |
| A drop is shown without context | Client worries | Marks and notes, drop highlight asking a question, the manager reviews before publishing |
| Too much on one screen | The manager cannot find the story | Fixed top-to-bottom order, a short summary first, blocks collapsible, reports choose blocks |
| Charts inaccessible | Excludes people, fails UI-8 | Tokens with verified contrast, descriptive `aria-label`, keyboard, direct labels |

## 16. Implementation status

2026-10-26, delivered together with [instagram-publishing.md](instagram-publishing.md) (migration `20261026100200_metrics.sql`, pgTAP `28_metrics`).

**Built (code complete, never run against real data or a browser):** the data tables and the collector functions; the analysis screen (`/admin/marketing/brands/$brandId/metrics`) with channel, period, comparison and ranking controls, summary tiles, the automatic highlights, growth, reach and views, interactions, best posts, formats, weekday and hour, audience, planned versus published, and the marks panel; the report builder (blocks, order, comments, message, next steps, preview), publishing with a frozen snapshot built on the server, list, correction (new version) and withdrawal; the portal pages `/portal/brands/$brandId/metrics` and `…/metrics/$reportId`; the dashboard block "Relatórios de resultados"; print to PDF through the browser; the chart tokens and Recharts.

**Differences from the specification:** no per-chart table switch, help text or share button (dropped on 2026-10-26); the notification `metrics.report_due` was not created (the dashboard block is the reminder); the reach tile shows the **average per day** (daily reach cannot be summed without overcounting); `follows`, `unfollows` and the online-hours audience are stored by the model but not collected; the comparison line is aligned by position, so periods of different length are compared bucket by bucket; the dashboard block ignores the brand filter; comments by the client on a report, goals and AI commentary are not built.

**Validation performed:** same commands as [instagram-publishing.md](instagram-publishing.md) section 12. The highlight rules, the period logic and the best-format and best-slot logic have Vitest tests.

**Review of 2026-10-26** (standards-reviewer): after it, the portal projection above, the composite foreign keys of `publish_attempts` and `channel_media_index`, the per-role pgTAP matrix and the confirmation before deleting a mark were added.

**Not done / not tested:** the screens in a browser (including 360 px and print to PDF), the contrast of the charts on screen, keyboard use of the charts, a real report published and read by a client, the metric names and the demographics breakdown against Meta ([../pending-external-setup.md](../pending-external-setup.md) I7, I9), Playwright flows.
