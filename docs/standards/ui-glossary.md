# UI glossary (pt-BR)

> The Brazilian Portuguese terms and message patterns of the interface, so the same thing is always called the same thing (rule UI-12). Everything in the UI is Brazilian Portuguese; code and documents are English, so this glossary maps **English concept → pt-BR UI text**. When a term is missing, add it here **before** using it in a screen. Tone: clear, direct, calm; no internal codes; say what happened and what to do. Statuses and enum labels are in [../reference/enums.md](../reference/enums.md); error messages in [../reference/error-codes.md](../reference/error-codes.md).

## 1. Domain terms

| Concept | UI text (singular / plural) | Notes |
|---|---|---|
| Organization | Organização | |
| Client | Cliente / Clientes | The commercial relationship |
| Brand | Marca / Marcas | Unit of identity and planning |
| Channel | Canal / Canais | "Perfil" only inside the channel form |
| Content item | Conteúdo / Conteúdos | The idea; never "post" |
| Variant | Variante / Variantes | One per channel; in the client portal call it "Publicação" |
| Revision | Versão / Versões | "Versão nº 3"; never "revisão" in the portal |
| Approval request | Pedido de aprovação / Pedidos de aprovação | |
| Approval (action/result) | Aprovação | |
| Approver | Aprovador(a) | |
| Briefing | Briefing | |
| Calendar | Calendário | |
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
| Add a variant | "Adicionar variante" |
| Remind / reassign the approver | "Reenviar lembrete" / "Reatribuir aprovador" |
| Cancel an item | "Cancelar conteúdo" / "Cancelar pedido" |
| Resend | "Reenviar" |
| Invite | "Convidar" |
| Publish (site) | "Publicar" |
| Roll back | "Restaurar esta versão" |
| Upload | "Enviar arquivos" |
| Download | "Baixar" |
| Open | "Abrir" |
| Snooze | "Adiar" |
| Mark as read | "Marcar como lida" |
| Sign in / out | "Entrar" / "Sair" |

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
5. The client portal uses the client's vocabulary: "Publicação" (not "variante"), "Versão" (not "revisão"), "Aprovar", "Pedir alterações".
6. Do not mention automatic publishing: the product records **manual** publication; say "Registrar publicação".
7. Gender: use neutral forms where possible ("Pessoa responsável"), otherwise the form with parentheses only in short labels ("Aprovador(a)").

## 5. Adding a term

Add the row here, use it in the screen, and if it names a status or enum value also update [../reference/enums.md](../reference/enums.md). `review` checks new strings against this glossary.
