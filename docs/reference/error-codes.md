# Error codes and messages

> Every expected failure in Compasso has a **code** (English, `lowercase_with_underscores`), raised in SQL with `raise exception 'code'` and/or returned by server functions through `fail(...)`, plus a **pt-BR message** shown to the person. The messages live in `src/lib/shared/auth/errors.ts` (`catalog` map); `npm run check:consistency` verifies that every code raised in SQL has a message and that no message is orphaned. Messages explain what happened and what to do, without internal details (rule UI-4, UI-12). Adding a code means: add the row here → raise it in SQL/TS → add the message → map it to an `ErrorCode` category → document it in the module.

## 1. Categories (`ErrorCode` in `Result`)

| Category | Meaning | Typical UI behavior |
|---|---|---|
| `denied` | Not allowed (missing action, brand link or ownership) | "Sem acesso"; hide the control; no details |
| `not_found` | The record does not exist **or** the person cannot see it (never distinguish) | Not-found state inside the layout |
| `conflict` | Version mismatch or concurrent change | Offer to reload; keep typed data |
| `in_use` | Blocked because something references it | Explain what references it (only what is visible) |
| `invalid` | Business or input validation failed (with `fields` when per field) | Show messages next to fields |
| `unavailable` | Temporary or external problem (storage, email, rate limit) | Retry action |
| `unknown` | Unexpected; logged with `logError` | Generic message and request id |

## 2. Codes

Columns: **Code** · **Category** · **pt-BR message** · **Raised by**.

### Generic

| Code | Category | Message (pt-BR) | Raised by |
|---|---|---|---|
| `denied` | denied | "Você não tem permissão para fazer isso." | any function |
| `not_found` | not_found | "Não encontramos este registro." | any function |
| `conflict` | conflict | "Este registro foi alterado por outra pessoa. Recarregue para continuar." | save functions (`version`) |
| `invalid_input` | invalid | "Confira os campos destacados." | server validation |
| `rate_limited` | unavailable | "Muitas tentativas. Tente novamente em alguns minutos." | public functions |
| `unknown` | unknown | "Algo deu errado. Tente novamente." | fallback |
| `audit_immutable` | denied | "Registros de auditoria não podem ser alterados." | audit trigger |

### Accounts, invitations and roles

| Code | Category | Message (pt-BR) | Raised by |
|---|---|---|---|
| `invalid_credentials` | denied | "E-mail ou senha incorretos." | login |
| `auth_link_invalid` | invalid | "Este link não vale mais. Peça um novo." | `exchangeAuthCode`, `resetPassword` |
| `invitation_invalid` | invalid | "Este convite expirou ou já foi usado. Peça um novo convite." | `accept_invitation` |
| `invitation_email_mismatch` | invalid | "O e-mail desta conta não é o do convite." | `accept_invitation` |
| `role_not_assignable` | denied | "Você não pode atribuir este perfil." | invite / role change |
| `last_owner` | invalid | "Precisa existir ao menos um Proprietário ativo." | profile / role guards |
| `self_change_forbidden` | denied | "Você não pode alterar o seu próprio acesso." | profile guards |
| `role_in_use` | in_use | "Este perfil está atribuído a pessoas e não pode ser excluído." | `role_delete` |
| `role_system_protected` | denied | "Este perfil do sistema não pode ser alterado." | role functions |
| `action_requires_read` | invalid | "Uma ação de escrita exige a ação de leitura correspondente." | `role_save` |
| `portal_role_internal_action` | invalid | "Perfis do portal só podem ter ações do portal." | `role_save`, role guards |
| `admin_only_action` | denied | "Esta ação é exclusiva do Proprietário." | `role_save`, role guards |

### Clients, brands and channels

| Code | Category | Message (pt-BR) | Raised by |
|---|---|---|---|
| `client_has_brands` | in_use | "Este cliente tem marcas. Arquive em vez de excluir." | `client_delete` |
| `contact_email_invalid` | invalid | "E-mail do contato inválido." | `client_contact_save` |
| `brand_name_taken` | invalid | "Já existe uma marca com este nome neste cliente." | `brand_save` |
| `brand_not_empty` | in_use | "Esta marca tem histórico. Arquive em vez de excluir." | `brand_delete` |
| `member_kind_mismatch` | invalid | "O tipo do vínculo não corresponde ao tipo do usuário." | `brand_member_set` |
| `last_internal_member` | invalid | "A marca precisa manter ao menos um membro interno." | `brand_member_set` |
| `approver_without_access` | invalid | "O aprovador designado não tem mais acesso. Escolha outro." | brand member changes, decide |
| `channel_duplicate` | invalid | "Este perfil já está cadastrado nesta marca." | `channel_save` |
| `channel_in_use` | in_use | "Este canal já foi usado. Arquive em vez de excluir." | `channel_delete` |
| `channel_archived` | invalid | "Este canal está arquivado e não aceita novos itens." | variant functions |
| `channel_brand_mismatch` | invalid | "O canal pertence a outra marca." | variant functions |
| `platform_change_forbidden` | invalid | "A plataforma de um canal em uso não pode ser alterada." | `channel_save` |

### Content and approvals

| Code | Category | Message (pt-BR) | Raised by |
|---|---|---|---|
| `transition_not_allowed` | invalid | "Esta mudança de estado não é permitida." | variant functions |
| `media_not_available` | invalid | "Há arquivos que ainda não estão disponíveis." | `submit_for_approval` |
| `approver_required` | invalid | "Escolha quem vai aprovar." | `submit_for_approval` |
| `not_approved` | invalid | "Só é possível registrar a publicação de uma versão aprovada." | `mark_published` |
| `requires_new_revision` | invalid | "Alterar isto exige uma nova versão e nova aprovação." | `reschedule_variant` |
| `reason_required` | invalid | "Informe o motivo." | `reopen_variant`, `cancel_request` |
| `request_not_pending` | conflict | "Este pedido não está mais pendente." | `portal_decide_approval` |
| `revision_superseded` | conflict | "Esta versão foi atualizada. Veja a versão atual." | `portal_decide_approval` |
| `comment_required` | invalid | "Escreva um comentário para pedir alterações." | `portal_decide_approval` |
| `not_designated_approver` | denied | "A decisão é de outra pessoa. Você pode comentar." | `portal_decide_approval` |
| `date_in_past` | invalid | "A data escolhida já passou." | `reschedule_variant` (as warning) |
| `local_time_nonexistent` | invalid | "Este horário não existe nesse dia (mudança de horário de verão)." | date conversion |
| `local_time_ambiguous` | invalid | "Este horário acontece duas vezes nesse dia. Escolha qual." | date conversion |

### Media

| Code | Category | Message (pt-BR) | Raised by |
|---|---|---|---|
| `upload_too_large` | invalid | "O arquivo é maior que o limite permitido." | `media_request_upload` |
| `upload_type_not_allowed` | invalid | "Este tipo de arquivo não é aceito." | `media_request_upload` |
| `upload_content_mismatch` | invalid | "O conteúdo do arquivo não corresponde ao tipo informado." | `confirmUpload` |
| `upload_size_mismatch` | invalid | "O tamanho do arquivo enviado é diferente do esperado." | `confirmUpload` |
| `quota_exceeded` | invalid | "O espaço de armazenamento acabou. Libere espaço ou ajuste o limite." | `media_request_upload` |
| `media_in_use` | in_use | "O arquivo tem usos que impedem a exclusão." | `media_delete_permanently` |
| `media_not_published` | invalid | "Há imagens que ainda não foram publicadas para o site." | `publish_site_page` |
| `storage_unavailable` | unavailable | "Não foi possível acessar o armazenamento. Tente novamente." | storage layer |

### Site and CMS

| Code | Category | Message (pt-BR) | Raised by |
|---|---|---|---|
| `slug_taken` | invalid | "Já existe uma página com este endereço." | `site_page_save` |
| `slug_reserved` | invalid | "Este endereço é reservado." | `site_page_save` |
| `page_system_protected` | denied | "Esta página do sistema não pode ser excluída nem mudar de endereço." | page functions |
| `publish_checks_failed` | invalid | "Corrija os itens destacados antes de publicar." | `publish_site_page` |
| `draft_changed` | conflict | "O conteúdo mudou desde a revisão. Revise de novo antes de publicar." | `publish_site_page` |
| `nothing_to_publish` | invalid | "Não há alterações para publicar." | `publish_site_page` |
| `schedule_pending` | invalid | "Já existe uma publicação agendada." | `publish_site_page` |
| `case_study_not_authorized` | invalid | "Este case não tem autorização para ser publicado." | `publish_site_page` |
| `redirect_invalid` | invalid | "Redirecionamento inválido (ciclo, endereço reservado ou destino inválido)." | `site_redirect_save` |
| `contact_consent_required` | invalid | "É preciso aceitar o consentimento para enviar a mensagem." | `site_contact_submit` |

## 3. Rules

1. SQL raises only codes from this table; TypeScript maps unknown database errors to `unknown` and logs them.
2. Never compare error **text**; compare `code`.
3. A message never includes ids, table names, SQL or stack traces.
4. `not_found` is returned both when a record does not exist and when the person cannot see it.
5. When a module document lists codes, it **links here** instead of redefining messages.
