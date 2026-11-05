# Module — Client feedback (monthly survey)

> **Status: implemented on 2026-11-05 in code and one migration; never opened in a browser, not applied to the linked project (section "Implementation status").** It specifies a monthly survey the client answers in the portal and the card view where the marketing manager reads the answers. The names of the sections below are registered in [../reference/README.md](../reference/README.md). Open decisions took the recommended answer unless a row says otherwise (section 14). UI copy is Brazilian Portuguese (in quotes); everything else is English.

## 1. Objective

1. **Collect feedback regularly.** Once a month, each client contact is asked how the work went, without the team having to chase anyone.
2. **Help the client judge the work.** A client is not an expert in marketing. The survey asks short questions in plain language, each with a hint of what to think about, and the meaning of each score written next to it. The client should never face a bare "rate 1 to 5". The survey shows **no summary of the work** (decided 2026-11-05): it asks, it does not report.
3. **Give the manager a clear reading.** A page of **cards**, one per answer, with the scores and the comments, plus a summary of the month and the contacts who have not answered.

Cadence: **once a month** per contact and brand, and only for brands that already completed one month since their creation date (section 4).

Out of this module: public or anonymous surveys (external users always sign in), per-content ratings (approvals already carry that conversation), team-configurable questionnaires, NPS (section 14), sending the survey by email, answering on the client's behalf.

## 2. Analysis (what the repository already gives, and what it does not)

| Need | What exists | Consequence |
|---|---|---|
| A place the client opens every time | The brand feed `/portal/brands/$brandId` ([portal.md](portal.md#feed-decided-2026-11-04)) | The modal and the banner live in the feed; no new portal route |
| Read data safely for an external user | `portal_*` functions with explicit columns (DATA-2) | Two new `portal_feedback_*` reads/writes; no policy for external roles on the new table |
| Month boundaries | `brands.timezone` (IANA), `date`/`timestamptz` rules (DATA-7), `dates.ts` | A "month" is cut in the brand's zone, like the metrics periods |
| Tell the team something arrived | `notify_users(...)` in the same transaction ([../foundations/notifications.md](../foundations/notifications.md)) | New kind `feedback.received` |
| Switches that belong to the organization | `organization_settings` policy groups ([organization-settings.md](organization-settings.md)) | One policy group, key `policies.feedback` |
| Star input, dialog, stat tiles | `lost-ui`: `FormInputRating`, `Form`, dialog and `Sheet`, stat/`ChartCard` pieces | Nothing is rebuilt here (CLAUDE.md item 10) |
| List of cards with server paging | `useListState` + `PaginationBar` + `ListSkeleton` + `EmptyState` | Cards replace only the `DataTable` body; URL state, paging and the five states are unchanged (UI-1, UI-2) |

**Risks the design answers.** (a) A client who does not open the portal never sees the modal, so the manager needs the "pending" view to follow up by hand (section 7). (b) Survey fatigue: one survey a month, "Responder depois", "Agora não" and a hard stop on re-opening (section 5). (c) Vague answers: guided questions with a hint each, a word for each score, and an optional "Prefiro não avaliar" on the dimensions the client cannot judge (section 5). (d) Asking about a month in which nothing happened: no survey is created for a brand without work in the period (section 4).

## 3. Who uses it

| Person | Wants | Gets |
|---|---|---|
| **Client contact** (external member with `feedback.answer`) | Say how it is going in two minutes, without jargon | The monthly modal in the portal feed (section 5) |
| **Marketing manager** (internal, `feedback.view`) | See satisfaction per brand, spot a problem early, know who did not answer | The "Feedbacks" page of cards (section 7) and the notification when an answer arrives |
| **Owner** | Compare brands and months | The same page without a brand filter (all brands the Owner can see) |

The test of the design: *can the client finish the survey on a phone in under two minutes, and can the manager tell from one card what went well, what went badly and why?*

## 4. The period and when a survey exists

- **Period.** The calendar month being evaluated, stored as `period_month` (the first day of that month, a `date`), cut in the **brand's time zone**.
- **Opening.** From day `openDay` (policy, default 1) of the **next** month, the survey for the closed month is due: from 1 November the survey for October. Only the **most recent closed month** is ever asked; a missed month is not asked later.
- **Closing.** The survey for a period can be answered until the end of the month in which it opened. After that it stays as "not answered" for the manager and the next month starts a new one.
- **Who is asked.** An external member of the brand whose link is `active`, whose role has `feedback.answer`, and whose link was granted **before the end of the period** (a person who joined in November is not asked about October).
- **Only after the brand completed one month (decided 2026-11-05).** The brand's creation date (`brands.created_at`, read in the brand's zone) decides whether it has completed a month: the survey is due only when `created_at + 1 month` has already passed. A brand created on 20 October is first asked on 20 November, about October; a brand created on 25 November is first asked on 25 December, about November. Before that date `portal_feedback_prompt` answers `none`. The month asked stays the latest closed calendar month; the creation date only decides *when the brand becomes eligible*, so the first survey may cover a partial month.
- **Only if there was work.** A survey is due only when the brand had at least one content with a revision **shared with the client** in the period (`requested_at` inside the month). Otherwise `portal_feedback_prompt` answers `none`.
- **Once per person, brand and period.** Unique `(brand_id, respondent_id, period_month)`. Two contacts of the same brand each answer; the manager sees both (O1).
- **Switch.** Policy `feedback.enabled` (default on). Turning it off stops new prompts; answers already given stay.

## 5. What the client sees (portal)

### 5.1 When and where

The prompt is evaluated when the person opens the brand feed. It never appears on the review screen (so it cannot interrupt a decision), in the calendar, in the notifications or in the profile. A person linked to several brands is asked **for the brand whose feed they open**, one at a time, never several at once.

| Prompt state (`FeedbackPromptState`) | Meaning | What shows |
|---|---|---|
| `none` | Nothing due: the brand has not completed a month yet, no work in the period, already answered, declined, feature off, or no `feedback.answer` | Nothing |
| `due` | Due and not snoozed | The **modal** opens once per visit |
| `banner` | Due, but the person snoozed the maximum number of times | A non-blocking **banner** at the top of the feed: "Conte como foi o trabalho em outubro" with "Responder agora". No modal |

### 5.2 The modal

A dialog that is full screen on a phone (360 px) and about 32 rem wide on desktop, as a **single step** (one scrollable form, no progress indicator, no "Continuar"; decided 2026-11-05). Closing with Escape or the X counts as "Responder depois". Focus moves into the dialog and returns to the feed on close; the question blocks are fieldsets with legends; every control has a text label (UI-8).

**Part 1 — "Como foi o trabalho em outubro?"** Five questions, each with a 1–5 star input (`FormInputRating`), a one-line help and the **word of the chosen score** shown under the stars. All five scores use the same scale:

| Score | Word shown |
|---|---|
| 1 | "Muito abaixo do esperado" |
| 2 | "Abaixo do esperado" |
| 3 | "Dentro do esperado" |
| 4 | "Acima do esperado" |
| 5 | "Superou as expectativas" |

| `FeedbackQuestion` | Label | Question | Help |
|---|---|---|---|
| `overall` (required) | "No geral" | "Como você avalia o trabalho de outubro?" | "Pense no mês inteiro." |
| `quality` | "Criação e qualidade" | "Os conteúdos combinam com a sua marca e com o que você esperava?" | "Pense no visual, nos textos e no tom de voz." |
| `communication` | "Comunicação" | "A equipe explica as ideias e responde com clareza e rapidez?" | "Pense nas mensagens, nas explicações e nos retornos." |
| `deadlines` | "Prazos" | "Os conteúdos chegam para aprovação e saem no dia combinado?" | "Pense nas datas de envio e de publicação." |
| `results` | "Resultados" | "O trabalho está ajudando a marca a chegar onde você quer?" | "Pense no que a marca queria alcançar com os conteúdos." |

Each question except `overall` has a checkbox "Prefiro não avaliar" that clears the stars and stores no score (never zero). A score of 1 or 2 in `overall` reveals the hint "Conte o que podemos melhorar logo abaixo." (encouraged, not required).

**Part 2 — "Quer contar mais?"** Right below the scores, two optional text areas, up to 1000 characters each, with a counter: "O que você mais gostou?" (`highlight`) and "O que podemos melhorar?" (`improvement`). At the bottom of the form: the primary button "Enviar respostas", enabled once `overall` has a score, loading and disabled while sending (no double submit, UI-5); on success a toast "Obrigado! Sua avaliação foi enviada." only after the server confirms (UI-4); on failure the typed data stays.

**Leaving.** "Responder depois" (a secondary button next to the send button) snoozes. "Agora não quero responder" (a text button under them, with a light confirmation naming the month) declines the month. Unsaved typed text is kept in the browser per brand and period (`StoredKey.FeedbackDraft`, through `readStored`/`writeStored`) so a closed modal or a failed request loses nothing; it is removed after a confirmed send.

### 5.3 Snooze and decline

| Action | Effect (`feedback_responses.status`) |
|---|---|
| "Responder depois" | `snoozed`, `snoozed_until = now + 3 days`, `snooze_count + 1`. The modal does not open again before `snoozed_until` |
| Snooze count reaches 3 | The prompt state becomes `banner` for the rest of the open window |
| "Agora não quero responder" | `declined` for the period. No modal, no banner. The manager sees the contact as "Dispensou" |
| Send | `answered`. Final (section 8, immutability) |

Snooze and decline are server state (not browser state), so they follow the person across devices.

## 6. What is stored

An answer stores the five scores (each 1 to 5 or empty), the two texts, the form version and the brand's zone at the moment of sending. Nothing else about the month is copied: the survey shows and stores no counts of the team's work (decided 2026-11-05). The server takes the period and the eligibility from the database; the client sends only the brand, the period it was shown and its answers (SEC-3).

## 7. What the marketing manager sees

Route: `/admin/marketing/feedback`, guard `feedback.view`, menu item "Feedbacks" in the Marketing group of `nav-config.ts`. It lists every brand the person may see ([../foundations/roles-and-actions.md](../foundations/roles-and-actions.md) section 3). It follows [../standards/admin-layout-and-standards.md](../standards/admin-layout-and-standards.md): `PageHeader`, filters in the URL, the five list states.

### 7.1 Filters (URL params)

| Param | Values | Default |
|---|---|---|
| `brand` | A brand the person can see, or all | All |
| `period` | A closed month (`YYYY-MM`) | The latest closed month |
| `status` | `answered`, `pending` (contacts who have not answered, including snoozed and declined) | `answered` |
| `attention` | `true` shows only overall score 2 or lower | Off |
| `page` | Server-side page, 12 cards | 1 |

Changing a filter resets the page; an old response never replaces a newer one (UI-1).

### 7.2 Summary strip

Four tiles for the filtered brand and period, with the change against the previous month: **Média geral** (average of `score_overall`, one decimal), **Taxa de resposta** (answered ÷ expected contacts), **Pedem atenção** (overall 2 or lower), **Dispensaram ou ainda não responderam** (count). The tiles say "Sem dados" when there is nothing, never 0. A second line lists the average of each dimension (only the answers that rated it).

### 7.3 The cards

One card per answer, in a responsive grid (1 column at 360 px, 2 on tablet, 3 on desktop). Card anatomy, top to bottom:

| Part | Content |
|---|---|
| Header | Brand avatar, brand name, client name; the period as "Outubro de 2026" |
| Score | The overall score as stars with the number and a `StatusBadge`: "Precisa de atenção" (1–2), "Dentro do esperado" (3), "Positivo" (4–5). Tone through the badge, never loose color classes; the state is also in the text (UI-8) |
| Dimensions | Four rows (qualidade, comunicação, prazos, resultados), each with a small bar and the number, or "Não avaliou" |
| Comments | `highlight` and `improvement` clamped to three lines each with "ver mais", labelled "Gostou" and "Melhorar" |
| Footer | Respondent name; "Respondido em 03/11/2026 14:20" with the brand's zone visible (UI-11); the button "Ver detalhes" |

**Pending cards** (`status = pending`) show the brand, the contact, the state ("Ainda não abriu", "Adiou 2 vezes", "Dispensou este mês") and the date of the last interaction, so the manager knows whom to call. They have no score.

**Detail** (`EditorSheet`, opened by "Ver detalhes" or by clicking the card): all texts in full, and all scores with their words. Read-only.

### 7.4 States (UI-2)

Skeleton with the card layout (stable height) → error with retry → empty ("Nenhum feedback neste período", with the hint that the survey opens on day {openDay}) → no results for the filters (clear filters) → cards. Pending view empty: "Todos responderam".

### 7.5 Notification

`feedback.received` goes to people with `feedback.view` on the brand when an answer is sent. Severity `info`, because the severity belongs to the kind; a score of 1 or 2 is flagged in the body instead ("Precisa de atenção." is appended). Title "Novo feedback de cliente". Body: "{Marca} respondeu a pesquisa de {mês}: nota {n}." The body carries no free text from the client (private content stays in the page). Dedupe key `feedback.received:<response_id>`. The link opens the page filtered by brand and period.

## 8. Rules

1. The client reads and writes only through `portal_feedback_*`; the new table has **no policy for external roles** (DATA-2). Nobody outside the internal team sees another contact's answer.
2. Effective permission = action AND brand link ([../standards/base.md](../standards/base.md) SEC-2): `feedback.answer` plus an active external link for the client side; `feedback.view` plus `can_access_brand` for the team side.
3. The period and the eligibility are computed in SQL from the brand's zone; the client sends only the brand, the period it was shown and its answers (SEC-3).
4. `portal_feedback_submit` is one transaction: lock the row, check the window, write the answer, `audit_write`, `notify_users` (DATA-4). A second send for the same person and period fails with `feedback_already_answered`.
5. An `answered` or `declined` row is immutable (trigger `feedback_responses_guard`); history is preserved, nothing is deleted (GOLD-8, DATA-6).
6. `score_*` are 1 to 5 or null; `score_overall` is not null when `answered`; the scores and texts are null when `snoozed` or `declined` (CHECK).
7. Missing is not zero: a dimension left out is stored as null and shown as "Não avaliou".
8. Free text is rendered as plain text, never as HTML (SEC-8), and never written to audit metadata or logs (SEC-12).
9. Revoking the brand link or the role blocks the next prompt and the next send immediately (SEC-13).
10. Time values are shown with the brand's zone visible; date work only through `dates.ts`, display through `format.ts` (UI-11, UI-14).
11. Failure of anything outside the transaction (the notification email, a refresh of the page) never removes a saved answer.

## 9. Data model

Registered in [../reference/data-model.md](../reference/data-model.md) section 4c. Migration `20261105100000_feedback.sql`.

**`feedback_responses`** — one row per contact, brand and period, created on the first interaction (snooze, decline or send):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` primary key | |
| `brand_id` | `uuid not null` | Boundary. Composite foreign key `(brand_id, respondent_id)` to `brand_members` |
| `respondent_id` | `uuid not null` | `profiles.id` |
| `period_month` | `date not null` | First day of the evaluated month; a `CHECK` that the day is 1 |
| `status` | `text not null` | `CHECK` in `snoozed`, `answered`, `declined` (`FeedbackStatus`, DATA-8) |
| `snoozed_until` | `timestamptz` | Set while `snoozed` |
| `snooze_count` | `smallint not null default 0` | `CHECK` between 0 and 3 |
| `score_overall`, `score_quality`, `score_communication`, `score_deadlines`, `score_results` | `smallint` | 1 to 5; only `score_overall` is required when `answered` |
| `highlight`, `improvement` | `text` | At most 1000 characters |
| `form_version` | `smallint not null default 1` | Version of the question set, so old answers stay readable if the questions change later |
| `timezone` | `text` | IANA zone of the brand at the moment of sending |
| `answered_at` | `timestamptz` | |
| `created_at`, `updated_at` | | Standard; `updated_at` trigger |

Constraints: `unique (brand_id, respondent_id, period_month)`; the CHECKs of rule 6. Indexes: `(brand_id, period_month)` for the list and summary, `(respondent_id, period_month)` for the prompt. RLS enabled; `select` for `feedback.view` and `can_access_brand(brand_id)`; **no** insert, update or delete policy for any client role (writes only by `security definer` functions); no policy for external roles or `anon`.

**Policy group `policies.feedback`** in `organization_settings`: `enabled` (boolean, default true) and `openDay` (integer 1 to 28, default 1), validated by zod, audited like the other policies, shown on the policies screen as "Pesquisa mensal com o cliente".

## 10. Functions

Registered in [../reference/functions.md](../reference/functions.md) sections 5 and 9c.

| SQL function | Server function | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `portal_feedback_prompt(p_brand)` returns `{ state, period_month, snooze_count }`; never any text | `getPortalFeedbackPrompt` | `feedback.answer` + external link | — | — | `denied`, `not_found` |
| `portal_feedback_submit(p_brand, p_period, p_answers jsonb)` | `submitPortalFeedback` | `feedback.answer` + external link | `feedback.answered` | `feedback.received` | `denied`, `not_found`, `invalid_input`, `feedback_not_open`, `feedback_already_answered` |
| `portal_feedback_snooze(p_brand, p_period)` | `snoozePortalFeedback` | same | — | — | `denied`, `not_found`, `feedback_not_open`, `feedback_already_answered` |
| `portal_feedback_decline(p_brand, p_period)` | `declinePortalFeedback` | same | `feedback.declined` | — | same |
| `feedback_list(p_brand, p_period, p_status, p_attention, p_page, p_page_size)` | `listFeedback` | `feedback.view` + brand link | — | — | `invalid_input`, `not_found` |
| `feedback_summary(p_brand, p_period)` | `getFeedbackSummary` | same | — | — | `invalid_input`, `not_found` |
| `feedback_policy_enabled`, `feedback_policy_open_day`, `feedback_brand_has_work`, `feedback_period_for`, `feedback_member_eligible`, `feedback_expected`, `feedback_score`, `feedback_text`, `feedback_lock_row`; trigger `feedback_responses_guard` | — | internal | — | — | `feedback_not_open`, `feedback_already_answered`, `invalid_input` |

Rules from the registry apply: one write RPC per user action, outputs validated with `parseOutput`, explicit DTOs, errors through `fail` (base.md 5.1). `feedback_list` for `status = pending` derives the expected contacts from `brand_members` (active, external, role with `feedback.answer`) without a row or with a `snoozed`/`declined` row.

## 11. Registered names

| Registry | New names |
|---|---|
| Actions ([../foundations/roles-and-actions.md](../foundations/roles-and-actions.md)) | `feedback.view` (internal; requires `brands.view`), `feedback.answer` (external, `portal = true`; requires `portal.view`). Starting roles: `manager` gets `feedback.view`; `external_approver` and `external_commenter` get `feedback.answer` (O2). Portal-only roles may hold `feedback.answer` only if the seed marks it as a portal action (rule 6 of that document) |
| Notification kind | `feedback.received` (required action `feedback.view`, `portal = false`, not schedulable) |
| Audit actions ([audit.md](audit.md)) | `feedback.answered`, `feedback.declined` (entity `feedback_response`; metadata: the month and, for answers, the overall score; never text) |
| Error codes ([../reference/error-codes.md](../reference/error-codes.md)) | `feedback_not_open` "A pesquisa deste mês não está aberta.", `feedback_already_answered` "Você já respondeu ou dispensou a pesquisa deste mês." |
| Enums ([../reference/enums.md](../reference/enums.md)) | `FeedbackStatus` (`snoozed`, `answered`, `declined`; column `feedback_responses.status`); TypeScript only: `FeedbackQuestion`, `FeedbackPromptState`, `FeedbackListStatus`, `FeedbackCardState`, `FeedbackScoreTone` |
| Keys | `StoredKey.FeedbackDraft`; `QueryKey.Portal.feedbackPrompt(brandId)`, `QueryKey.Feedback.list(filters)`, `.summary(filters)` |
| Routes ([../reference/routes.md](../reference/routes.md)) | `/admin/marketing/feedback` (`feedback.view`). The portal has no new route |
| Constants (`lib/shared/feedback/limits.ts`) | `FEEDBACK_SNOOZE_DAYS = 3`, `FEEDBACK_MAX_SNOOZES = 3`, `FEEDBACK_TEXT_MAX = 1000`, `FEEDBACK_ATTENTION_SCORE = 2`, `FEEDBACK_PAGE_SIZE = 12` |
| UI glossary ([../standards/ui-glossary.md](../standards/ui-glossary.md)) | The labels of sections 5 and 7: "Feedbacks", "Pesquisa mensal", "Precisa de atenção", "Não avaliou", "Prefiro não avaliar", "Responder depois", "Dispensou" |
| Policy group | `policies.feedback` (`enabled`, `openDay`) |

## 12. Code layout

Spaces never import each other (base.md section 4), so what both sides use lives in `shared`.

| Folder | Content |
|---|---|
| `src/lib/shared/feedback/` | `types.ts`, `schemas.ts` (answers, zod), `limits.ts`, `questions.ts` (the five questions, labels, help and score words), `score-tone.ts` (score to tone), `period.ts` (month parameters and labels), with unit tests in `feedback.test.ts` |
| `src/lib/portal/feedback/` | `feedback.functions.ts` (the four client-side server functions), DTO and output schemas |
| `src/components/portal/feedback/` | `feedback-prompt.tsx` (mounted in the brand feed), `feedback-prompt-dialog.tsx`, `feedback-form.tsx`, `feedback-banner.tsx` |
| `src/hooks/portal/` | `use-feedback-prompt.ts` (the prompt query), `use-feedback-draft.ts` (the unsent answers in the browser) |
| `src/lib/marketing/feedback/` | `feedback.functions.ts` (list, summary) |
| `src/components/marketing/feedback/` | `feedback-page.tsx`, `feedback-card.tsx`, `feedback-summary.tsx`, `feedback-detail-sheet.tsx` |
| `src/routes/admin/_app/(marketing)/marketing/feedback/index.tsx` | Only guard, search params and the page component (base.md 5.2) |

Shared UI comes from `lost-ui` (forms with `rules`, `FormInputRating`, dialog, sheet, tiles). The `Form` migration pattern applies: client rules with pt-BR messages, the submit through `useFormSubmit().send`, the server still validates with zod and returns `fields` errors ([../standards/base.md](../standards/base.md) section 5.4). If `lost-ui` lacks something (for example a full-screen dialog on phones or a card grid), list it in [../lost-ui-requests.md](../lost-ui-requests.md) instead of rebuilding it.

## 13. Acceptance criteria

**Client**
- [ ] On the first open of the brand feed on or after `openDay`, a contact with `feedback.answer` of a brand that had shared work in the previous month sees the modal for that month, once per visit.
- [ ] A brand younger than one month (counted from `brands.created_at` in its zone) is not asked; on the day it completes the month it becomes eligible for the latest closed month, if that survey is still inside its open window.
- [ ] A brand with no work shared in the period, an already answered or declined period, a switched-off policy, or a contact without `feedback.answer` never sees a modal or banner.
- [ ] The modal is one single-step form (five scores, then two comments, then the buttons) and shows no counts or summary of the team's work.
- [ ] The five scores carry their word; `overall` is required; the other four accept "Prefiro não avaliar" and are stored as null.
- [ ] "Responder depois" hides the modal for 3 days across devices; after 3 snoozes only the banner remains; "Agora não quero responder" removes both.
- [ ] A second send for the same period fails with `feedback_already_answered`, also with two open tabs; a double click sends once.
- [ ] A closed or failed modal keeps the typed text; a confirmed send clears it.
- [ ] It works at 360 px and by keyboard only; focus returns to the feed; state is never by color alone.

**Manager**
- [ ] The page lists answers as cards, server-paginated, with the filters in the URL and the five states.
- [ ] The summary shows average, response rate, cases that need attention and pending contacts, with "Sem dados" instead of 0.
- [ ] The pending view lists the contacts without an answer, with the state and the last interaction.
- [ ] A card shows the brand, period, scores (null as "Não avaliou"), comments and the time with the brand's zone; the detail shows the full texts.
- [ ] An answer creates `feedback.received` for the people with `feedback.view` on that brand only; the notification carries no client text.

**Security and data**
- [ ] pgTAP: Owner, a manager linked to the brand, a manager not linked, a collaborator without `feedback.view`, an external member of brand A, an external member of brand B, a member without `feedback.answer`, a revoked link and `anon`, on every function and on the table (base.md 5.6).
- [ ] An external user cannot read any `feedback_responses` row, not even their own, except through the prompt (which carries no text).
- [ ] `answered` and `declined` rows cannot be updated or deleted; scores outside 1 to 5 and an `answered` row without `overall` are refused by the database.
- [ ] `npm run check:consistency` and `npm run check:docs` pass with the registries updated.

## 14. Open decisions

Recommended answers are what the specification above already assumes. Confirm or change them before the migration (base.md 9.1).

| # | Question | Recommendation |
|---|---|---|
| O1 | One answer per **contact** or one per **brand**? | Per contact. Different people see the work differently, the manager reads each view, and nobody blocks anybody (unlike approvals, where the first decision wins) |
| O2 | Which external roles are asked? | Both `external_approver` and `external_commenter`. If only approvers should answer, `feedback.answer` goes to that role only |
| O3 | Fixed questions or configurable by the team? | Fixed in the first delivery, with `form_version` ready for a later change. A configurable questionnaire needs its own editor, versioning and translation of old answers |
| O4 | Add an NPS question ("de 0 a 10, quanto você indicaria?")? | Not now. It adds a sixth item to a two-minute survey; revisit after three months of real answers |
| O5 | Remind the client by notification or email when the survey opens? | Not in the first delivery: the modal is the channel and the manager has the pending view. Revisit if the response rate is low (a `feedback.requested` portal kind and a scanner would be added, as in [../foundations/notifications.md](../foundations/notifications.md) 7.2) |
| O6 | A switch per brand (for example for a brand in its first month)? | No. The "one month since creation" and "work shared in the period" rules already cover a brand that just started; revisit if the team needs an exception |
| O10 | Should the cycle follow the brand's **anniversary** (a brand created on the 12th is asked every 12th, about the month just lived) instead of the calendar month? | No in the first delivery: calendar months keep every brand comparable on the manager's page and match the metrics periods. Say so if you prefer the anniversary cycle; it changes `period_month` into a period start date and the filters of section 7.1 |
| O7 | Can the manager mark an answer as handled or reply to it? | Later. First measure how the cards are used; a "Tratado" mark with a note would be a new column and an action |
| O8 | May the client edit an answer after sending? | No. An answer is a record of that moment (GOLD-8); a new month brings a new survey |
| O9 | A dashboard block with low scores? | Later, as a block of [dashboard.md](dashboard.md) once the page exists |

## Implementation status

2026-11-05: **Implemented (tasks F-02 to F-05), not seen in a browser and not applied to the linked project.**

Decisions taken while building (they refine the specification above): the policy key is `policies.feedback`; the notification severity is `info` and a low score is flagged in the body; the table has no `version` column (an answer is final and the rows change only through locked functions); `portal_feedback_prompt` returns no period label (the client formats the month) and there is no `feedback_get` (the cards already carry the full texts); the list `period` and `attention` filters were added to the shared `listSearchSchema` and `useListState` as `period` (`YYYY-MM`) and `attention` (`1`); the card states live in `FeedbackCardState`.

Migration: `supabase/migrations/20261105100000_feedback.sql` (table, CHECKs, guard trigger, RLS, two actions, one notification kind, the policy key in `organization_setting_save`, the two audit actions in the `audit_write` catalog, the functions of section 10). Not applied to the linked project: it needs `npx supabase db push` after a dry run.

Code: `src/lib/shared/feedback/*` (types, limits, questions, score tone, period, schemas, `feedback.test.ts`), `src/lib/portal/feedback/feedback.functions.ts`, `src/lib/marketing/feedback/feedback.functions.ts`, `src/hooks/portal/use-feedback-prompt.ts`, `src/hooks/portal/use-feedback-draft.ts`, `src/components/portal/feedback/*`, `src/components/marketing/feedback/*`, the route `src/routes/admin/_app/(marketing)/marketing/feedback/index.tsx`, the mount in `portal-feed-page.tsx`, the menu item in `nav-config.ts`, the policy fields (`schemas.ts`, `policy-fields.ts`), audit labels, notification kind info, `Action`, `AuditAction`, `FeedbackStatus`, `StoredKey`, `QueryKey`, `AppRoute`, `errors.ts`, `list-search.ts`, `use-list-state.ts`, `e2e/auth-guards.spec.ts` (the new route), `scripts/check-consistency.mjs` (the `feedback_responses.status` CHECK). Registries updated: data model, functions, routes, enums, error codes, actions and starting roles, notifications, audit, glossary, organization settings.

Validation performed: `npm run db:verify` (1153 assertions, 0 failures; 39 new in `supabase/tests/30_feedback.test.sql`: eligibility by brand age and by work shared in the month, the prompt states, snooze and the banner after three, validation of the answers, one answer per month, immutability, audit without text, the notification and who does not get it, the manager list, pending list and summary, brand A versus brand B, a collaborator, an external user and `anon`; `01_auth_roles_profiles.test.sql` counts moved from 53 to 55 actions), `npm run test` (314 Vitest tests, 13 new), `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run check:consistency`, `npm run check:docs`.

**Not tested**: any screen in a browser (the modal on a phone at 360 px and on desktop, the two-line layout of the rating fields, `FormInputRating` with keyboard only, the draft restored after a reload, the inline "dispensar" confirmation, the banner, the cards grid at 360 px, tablet and desktop, the detail panel); the Playwright flow answer then see the card (the guard list now includes the route, but the Playwright web server did not start within 120 s here, so even `auth-guards.spec.ts` was not run); the migration against a real Supabase project (only PGlite); the notification email and bell for a manager; the policies screen with the new group. **Types**: `database.types.ts` was not regenerated with `npm run db:types` (no Docker or linked project with this migration); the six public function signatures were added by hand in the generator's format and must be replaced by a real generation after the push (DATA-11). **Known limits**: a brand with feedback answers cannot be deleted (the foreign key blocks it, by design: history is preserved); `lost-ui` has no phone full-screen option wired in, so the modal uses `scrollable` and its default sizing.
