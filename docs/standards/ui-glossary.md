# UI glossary (pt-BR)

> The Brazilian Portuguese terms and message patterns of the interface, so the same thing is always called the same thing (rule UI-12). Everything in the UI is Brazilian Portuguese; code and documents are English, so this glossary maps **English concept → pt-BR UI text**. When a term is missing, add it here **before** using it in a screen. Tone: clear, direct, calm; no internal codes; say what happened and what to do. Statuses and enum labels are in [../reference/enums.md](../reference/enums.md); error messages in [../reference/error-codes.md](../reference/error-codes.md).

## 1. Domain terms

| Concept | UI text (singular / plural) | Notes |
|---|---|---|
| Organization | Organização | |
| Client | Cliente / Clientes | The commercial relationship |
| Brand | Marca / Marcas | Unit of identity and planning |
| Channel | Canal / Canais | "Perfil" only inside the channel form |
| Platform profile collision | "Mais de um perfil cadastrado" | Shown only when legacy data has multiple active profiles on one platform |
| Content item | Conteúdo / Conteúdos | The idea; never "post" |
| Content channel | (no name on screen) | One row per channel, format and date of a content; people see the channel logo and name; in the client portal call it "Publicação" |
| Idea | Ideia / Ideias | A calendar note that can become a content |
| Date | Data / Datas | A calendar note for a day that matters (holiday, campaign day) |
| Revision | Versão / Versões | "Versão nº 3"; never "revisão" in the portal |
| Approval request | Pedido de aprovação / Pedidos de aprovação | |
| Approval (action/result) | Aprovação | |
| Approver | Aprovador(a) | |
| Activity (editor section) | Atividade | Tabs "Comentários" (with a count badge) and "Histórico"; collapsed comment box "Adicionar um comentário…"; buttons "Comentar" and "Cancelar" |
| Publication reminder (dashboard block) | "Marcar como publicado"; empty state "Nada a marcar"; item button "Registrar publicação" |
| Reply / edit a comment | "Responder", "Editar", "Excluir" (menu "⋯" of the author), mark "editado", placeholder "Comentário removido" |
| Profile photo | Foto de perfil | Buttons "Enviar foto", "Trocar foto", "Remover foto"; library scope "Fotos de perfil"; fallback is the initials of the name |
| Content name | Nome do conteúdo | Label of the internal title field |
| Duplicate content | Duplicar conteúdo | Creates a copy named "Cópia de …" without dates |
| Briefing | Briefing | Title of the large card of the "Planejamento" step (types, publication date, "Briefing"); the old "Briefing" step and its guided fields were removed on 2026-10-28 |
| Content type | Tipo de conteúdo / Tipos | Multi-select of the planning card, chips in the list, catalog screen "Tipos de conteúdo" in the settings; actions "Novo tipo", "Novo tipo de conteúdo" (icon button beside the multi-select, opens a side sheet), "Arquivar", "Reativar" |
| Publication date | Data de publicação | Date of the planning card that the publication rows inherit; the first column of the content list is "Data" |
| Planning reference files | Referências | Files of the planning step (label of the file list); the art files of the "Conteúdo" step stay "Arquivos" |
| Planning summary | Briefing | Rich text of the planning card that the client approves |
| Site / page / section | Site / Página / Seção | Menu of the space: "Páginas", "Serviços", "Depoimentos", "Portfólio", "Mensagens", "Menu e rodapé", "Configurações", "SEO", "Redirecionamentos", "Publicações" |
| Publish (site) | Publicar | "Publicar…", "Tirar do ar", "Voltar para esta versão"; states "Fora do site", "No ar", "Despublicada", "Sai na próxima publicação" |
| Anchor | Âncora | Name of a section used in links such as /pagina#ancora |
| Case authorization | Autorização do cliente | "Registrar autorização", "Retirar autorização" |
| Calendar | Calendário | Views: "Mês", "Semana", "Lista"; button "Hoje"; filter "Somente prazos" |
| Editorial status | Em planejamento, Em produção, Em aprovação, Alterações solicitadas, Aprovado, Publicado, Cancelado | The seven statuses of a content since 2026-10-30; "Rascunho", "Em revisão interna", "Planejamento em aprovação" and the other plan statuses no longer exist |
| Change the date | Alterar data… | Opens the confirmation dialog; confirm with "Confirmar nova data" |
| Deadline (production / approval) | Prazo de produção / Prazo de aprovação | |
| Planned date | Data prevista | "Planejada" for the status |
| Manual publication | Publicação manual | Button: "Registrar publicação" |
| Media Library | Biblioteca de Mídia | Menu: "Biblioteca" |
| File / version | Arquivo / Versão | |
| Collection (library) | Coleção / Pasta | Use "Pasta" in the UI |
| Site and CMS | Site e CMS | Space name |
| Marketing Management | Gestão de Marketing | Space name |
| Client Portal | Portal do Cliente | |
| Page / section | Página / Seção | |
| Case study | Case | "Estudo de caso" in long text |
| Testimonial | Depoimento | |
| Service | Serviço | |
| Settings | Configurações | |
| Users | Usuários | |
| Roles (profiles) | Perfis | The UI says "Perfil" (not "papel") |
| Invitation | Convite | |
| Notification | Notificação / Notificações | Preferences: "Avisos" |
| Audit | Auditoria | |
| Dashboard | Visão geral | Home of a space |
| Board (content by status) | Quadro | Alternative view of the content list; the list is "Lista" |
| Portal dashboard | Painel | Home of a brand in the client portal |
| Waiting for the client's decision | Aguardando aprovação (team) / Aguardando você (portal) | |
| Team (internal users) | Equipe | |
| External user | Cliente (usuário externo) | In Settings: "Externo" badge |

## 2. Actions (buttons and menu items)

Use the **verb + object** form for primary buttons; short verbs in row menus. One verb per concept across the product.

| Concept | UI text |
|---|---|
| Create | "Novo cliente", "Nova marca", "Novo canal", "Novo conteúdo", "Nova página" |
| Open record | "Abrir marca", "Abrir conteúdo" |
| Edit content | "Editar conteúdo" |
| Edit brand | "Editar marca" |
| Cancel content | "Cancelar conteúdo" |
| Delete content | "Excluir conteúdo" |
| Save | "Salvar" (while running: "Salvando…") |
| Cancel (close without saving) | "Cancelar" in forms; **"Voltar"** in dialogs |
| Confirm | The action verb itself ("Arquivar", "Excluir", "Reabrir"); never "OK" or "Sim" |
| Delete | "Excluir" (permanent) |
| Archive / reactivate | "Arquivar" / "Reativar" |
| Edit | "Editar" |
| Search | "Buscar" (placeholder: "Buscar por nome…") |
| Clear search / filters | "Limpar busca" / "Limpar filtros" |
| Retry | "Tentar novamente" |
| Send for approval | "Enviar para aprovação" |
| Approve | "Aprovar" |
| Request changes | "Pedir alterações" |
| Reopen | "Reabrir" |
| Move between statuses | "Mover para…" (menu), "Iniciar produção", "Enviar para revisão interna", "Retomar produção" |
| Add a publication to a channel | "Adicionar publicação" |
| Publication schedule (editor card) | "Programação das publicações"; date field "Selecionar data", time field "Selecionar hora" with its own label "Hora" |
| Convert a note | "Converter em conteúdo" |
| Calendar event / shoot / meeting | "Evento" / "Captação" / "Reunião" |
| Share an event with the client | "Visível para o cliente" |
| Remind the approvers | "Reenviar lembrete" |
| Planning / Art (approval stage) | "Planejamento" / "Artes" |
| Start planning / start the art | "Iniciar planejamento" / "Iniciar produção das artes" |
| Send the plan / the art for approval | "Enviar planejamento para aprovação" / "Enviar artes para aprovação" |
| Reopen the plan | "Reabrir planejamento" |
| Who can approve | "Quem pode aprovar" / "Quem será avisado" |
| Cancel an item | "Cancelar conteúdo" / "Cancelar pedido" |
| Resend | "Reenviar" |
| Brand switcher (portal) | "Suas marcas" / "Trocar de marca" (accessible name of the trigger) |
| Access link (invitation) | "Link de acesso" / "Gerar novo link" / "Reenviar por e-mail" |
| Invite | "Convidar" |
| Publish (site) | "Publicar" |
| Roll back | "Restaurar esta versão" |
| Upload | "Enviar arquivos" |
| Download | "Baixar" |
| Open | "Abrir" |
| Snooze | "Adiar" |
| Mark as read | "Marcar como lida" |
| Sign in / out | "Entrar" / "Sair" |
| Send a contact message (public site) | "Enviar mensagem" |

## 3. Message patterns

| Situation | Pattern | Example |
|---|---|---|
| Success | Past participle + object | "Cliente salvo.", "Pedido enviado para aprovação.", "Versão publicada." |
| Validation | What is wrong + expected format | "Informe um e-mail válido.", "Use até 80 caracteres." |
| Required field | "Campo obrigatório" under the field | |
| Empty list | Fact + next step | "Ainda não há clientes. Cadastre o primeiro." |
| No results | "Nenhum resultado para «{busca}»." + "Limpar busca" | |
| Loading | Skeleton; text only for long operations: "Enviando arquivos…" | |
| Destructive confirmation | Title: verb + object; body: what happens and what stays recorded | "Arquivar a marca «Café Aurora»? O histórico será mantido." |
| Reason required | "Informe o motivo" | |
| No permission | "Você não tem acesso a esta área." + way out | |
| Not found | "Não encontramos esta página." + way out | |
| Unsaved changes | "Há alterações não salvas. Sair mesmo assim?" | |
| Session expired | "Sua sessão expirou. Entre novamente para continuar." | |
| Time zones | Always show with the time: "10:00 (America/Sao_Paulo)" | Format via `format.ts` |

## 4. Writing rules

1. Use "você"; no jargon ("RPC", "RLS", "slug" → "endereço"), no internal codes.
2. Sentence case, no ALL CAPS, no exclamation marks except for real celebration.
3. Numbers and dates through `format.ts` (`pt-BR`): "18 de out. de 2026", "R$ 1.250,00".
4. Button text never changes meaning between screens; if two verbs exist for the same action, pick the one in this glossary.
5. The client portal uses the client's vocabulary: "Publicação" (not "canal do conteúdo"), "Versão" (not "revisão"), "Aprovar", "Pedir alterações".
6. Automatic publishing is mentioned only on a connected Instagram channel ("Publicar automaticamente"); everywhere else the product records **manual** publication and says "Registrar publicação".
7. Gender: use neutral forms where possible ("Pessoa responsável"), otherwise the form with parentheses only in short labels ("Aprovador(a)").

## 4b. Instagram connection, automatic publishing and metrics

| Term (pt-BR) | Where | Meaning |
|---|---|---|
| Conectar ao Instagram / Reconectar / Desconectar / Testar conexão | Channel connection panel | Authorize, renew, remove or check the account link |
| Publicar automaticamente | Connection panel (default) and content (per channel row) | The post goes out by itself at the planned time, after approval |
| Publicando agora / Falhou / Tentar de novo / Publicar agora | Content, channel rows | State and actions of an automatic publication |
| Publicado automaticamente | Content, calendar | A row published by the integration |
| Coletar métricas | Connection panel | Keep the account and post history for the metrics screen |
| Métricas / Análise / Relatórios | Brand tabs | The analysis screen and the reports list |
| Seguidores, Alcance médio por dia, Visualizações, Interações, Visitas ao perfil, Posts publicados | Metric tiles | See [../modules/metrics.md](../modules/metrics.md) section 9 for the plain explanation |
| Criar relatório / Publicar para o cliente / Corrigir / Retirar | Reports | Build, send, create a new version of, or hide a report |
| Resultados | Client portal menu | The published reports of the brand |
| Marca (de métricas) | Metrics | A dated note on the charts (campaign, viral post…); not the same as "Marca" (brand) |

## 5. Adding a term

Add the row here, use it in the screen, and if it names a status or enum value also update [../reference/enums.md](../reference/enums.md). `review` checks new strings against this glossary.
