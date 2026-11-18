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
| Settings | Configurações | Menu sub-item group for the rarely used settings screens: "Avançado" |
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
| Request changes | "Solicitar alteração" (the name of the action, used as the accessible name; the button in the portal feed shows the one word "Alterar"; the status stays "Alterações solicitadas"). In the portal feed the typed comment is sent as the guidance |
| Portal feed | "Feed" (menu item and breadcrumb of the brand page); filters "Todos", "Pendentes", "Aprovados", "Alterações solicitadas"; "Ver os N comentários" / "Ocultar comentários"; field "Adicione um comentário…" with "Publicar" |
| Missing art in a post | "Imagem ainda não enviada" |
| End of the portal feed, and a failed page | "Você viu todos os conteúdos."; button "Tentar novamente" |
| Emoji picker | Button "Inserir emoji"; search "Buscar emoji"; category names in pt-BR ("Frequentes", "Rostos e pessoas", "Animais e natureza", "Comidas e bebidas", "Viagens e lugares", "Atividades", "Objetos", "Símbolos", "Bandeiras") |
| Instagram preview video and story controls | "Reproduzir vídeo", "Pausar vídeo", "Ativar som", "Silenciar", "Posição do vídeo", "Pausar story", "Reproduzir story"; header menu items "Ver detalhes" and "Mostrar áreas cobertas" (the latter for Reel and Story only), button "Mais opções"; reply placeholder "Responder a {nome}…" |
| Time of a comment (social style) | `formatSocialTime` in `lib/shared/format.ts`: "agora", "N min", "N h", "N d", "N sem", then a short date such as "12 de nov" (with the year when it is not the current one); never "há 2 dias" in comment lists |
| Approve a planning | Confirmation "Aprovar este planejamento?"; word "Planejamento" before the date in the post header |
| Reopen | "Reabrir" |
| Move between statuses | drag the card on the board (no menu since 2026-10-30), "Iniciar produção", "Enviar para revisão interna", "Retomar produção" |
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
5. The client portal uses the client's vocabulary: "Publicação" (not "canal do conteúdo"), "Versão" (not "revisão"), "Aprovar", "Solicitar alteração".
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

## 4c. Client feedback

| Term (pt-BR) | Where | Meaning |
|---|---|---|
| Feedbacks | Marketing menu | The page where the manager reads the monthly answers of the clients |
| Pesquisa mensal | Portal, policies | The survey the client answers once a month about the previous month |
| Responder depois / Agora não quero responder / Enviar respostas | Portal modal | Postpone for 3 days, dismiss the month, send |
| Prefiro não avaliar | Portal modal | Leave one subject without a score (stored empty, never zero) |
| Precisa de atenção / Dentro do esperado / Positivo | Cards | Tone of the overall score (1–2, 3, 4–5) |
| Não avaliou | Cards | A subject the client chose not to rate |
| Respondidos / Sem resposta | Feedbacks tabs | Answers received / contacts who did not answer, postponed or dismissed |
| Dispensou este mês | Cards | The contact dismissed the survey of the month |

## 4d. Image editor

| Term (pt-BR) | Where | Meaning |
|---|---|---|
| Designs | Marketing menu, list | The images made in the editor; one "design" is one editable image of a brand |
| Formato | List, creation | The page size preset: "Feed quadrado (1080 × 1080)", "Feed retrato (1080 × 1350)", "Story ou Reel (1080 × 1920)" |
| Texto / Imagem / Retângulo / Elipse | Editor toolbar, layers | The element kinds |
| Camadas | Editor | The list of the elements of the page, the top one first |
| Trazer para frente / Enviar para trás | Layers | Move an element one position up or down in the stack |
| Bloquear / Desbloquear | Layers | A locked element cannot be moved or changed on the canvas |
| Salvar versão | Editor | Freeze the current state as a numbered version that never changes |
| Salvando… / Rascunho salvo / Alterações não salvas / Não foi salvo | Editor | State of the automatic saving of the draft |
| Enviando pixels… / Pixels não enviados | Editor top bar | Pixel flush of raster layers running / failed (alert with "Tentar de novo") |
| Pixels indisponíveis | Editor layers row | A raster layer whose file could not be loaded (the layer shows empty; the editor keeps working) |
| Rasterizar imagem | Editor menu "Camada" and layers context menu | Converts the selected image into a raster layer of the same frame in one undo step |
| Alterado em outra aba / Recarregar design | Editor | The draft was saved elsewhere (`conflict`); autosave stops, the work stays on screen until the person reloads |
| Cor de fundo | Editor, page properties | Off means a transparent page (shown as a checkerboard) |
| Espelhar na horizontal / Espelhar na vertical | Editor, image properties | Flip an image |
| Somente leitura | Editor | Shown without `design.update`, for a design in the trash and below 768 px |
| Páginas / Nova página / Duplicar página | Editor | The pages of a design (a carousel has up to 10) |
| Linha | Editor toolbar | A straight line element |
| Agrupar / Desagrupar | Editor | Join the selected elements so they move together / separate them |
| Propriedades / Marca | Editor docked panels | The section with the settings of the selection / the brand kit (logo, colors, fonts of the brand) |
| Transformar / Manter proporção | Editor docked panels | Position, size and rotation of the selection in pixels / change width and height together |
| Painéis | Editor top bar (below `xl`) | Open the docked panels in a sheet |
| Voltar para designs | Editor top bar | Leave the full-screen editor for the list |
| Mover / Mão / Zoom (ferramentas) | Editor tool rail | Select and move elements / pan the view / zoom in on a click (Alt zooms out) |
| Alinhar à esquerda / Centralizar na horizontal / Alinhar à direita / Alinhar ao topo / Centralizar na vertical / Alinhar à base | Editor options bar | Align the selection (one element or group: to the page) |
| Distribuir na horizontal / Distribuir na vertical | Editor options bar | Equal gaps between three or more elements |
| Trazer para a frente / Enviar para trás de tudo | Editor options bar | Put the element on top of / below every other one |
| Ajustar à tela / 100% / Aumentar zoom / Diminuir zoom | Editor status bar | Zoom of the view (never changes the design) |
| Atalhos | Editor status bar | The list of keyboard shortcuts |
| Mistura / Opacidade / Preenchimento | Editor, properties panel | Blend mode of the selected element (Normal, Multiplicar, Tela, Sobrepor, Escurecer, Clarear, Subexposição de cores, Superexposição de cores, Luz direta, Luz suave, Diferença, Exclusão, Matiz, Saturação, Cor, Luminosidade) / opacity of the whole element / opacity of its content only |
| Seleção retangular / Laço / Varinha mágica / Cortar / Conta-gotas / Pincel / Carimbo / Borracha / Balde de tinta | Editor tool rail (not shown until the phase that gives them behavior; "Cortar" is enabled in P9) | Photoshop-like tools, keys M, L, W, C, I, B, S, E, G |
| Seleção retangular / Laço / Varinha mágica (enabled in P7) | Editor tool rail and options bar | Pixel selections. Options: Nova / Adicionar / Subtrair / Interseção, Retangular / Elíptica, "Suavizar bordas (px)", "Tolerância", "Contíguo", "Aplicar" (numeric X, Y, L, A). Menu "Selecionar": Todos, Desmarcar, Inverter, "Suavizar bordas…", "Expandir…", "Contrair…". History step "Limpar seleção" (Delete with a selection). Notices: "Selecione uma camada de pixels para usar a varinha mágica.", "A seleção é complexa demais para mostrar todo o contorno. Ela continua ativa." |
| Balde de tinta / Gradiente (enabled in P8) | Editor tool rail (group G, Shift+G alternates) and options bar | Fill the selected raster layer. Bucket options: "Tolerância", "Contíguo", "Opacidade", "Mistura" (blend modes of the properties panel); the region is the same as the magic wand, limited by the pixel selection. Gradient options: "Tipo" ("Linear", "Radial"), "Inverter cores" (swaps the foreground and background colors), "Opacidade", "Mistura"; drag from the start to the end point, from the foreground to the background color. History steps "Balde de tinta" and "Gradiente". Reason shown when no layer is usable: "Selecione uma camada de pixels visível e desbloqueada para pintar." |
| Filtro (menu) | Editor menu bar | Items "Desfoque gaussiano…", "Nitidez…", "Ruído…", "Mosaico…" on the selected raster layer, limited by the pixel selection. Non-modal dialog with the parameters ("Raio (px)", "Quantidade (%)", "Limiar", "Monocromático", "Tamanho da célula (px)"), live preview, "Cancelar" and "Aplicar" (one history step named after the filter); messages "Processando…" and "Não foi possível aplicar o filtro. Tente de novo."; reason "Selecione uma camada de pixels visível e desbloqueada para aplicar o filtro." |
| Carimbo / Subexposição / Superexposição (enabled in P11) | Editor tool rail (S; O, Shift+O alternates) and options bar | Brush options plus "Pressão no tamanho" and "Pressão na opacidade" on every brush-like tool. Carimbo: "Alinhado", hint "Alt+clique para definir a origem.", status "Origem definida.". Dodge/burn: "Intervalo" ("Sombras", "Tons médios", "Realces"), "Exposição". Shift+click on the brush or eraser draws a straight line from the last point. History steps "Carimbo", "Subexposição", "Superexposição" and the filter names |
| Ajustes (menu and panel) | Editor menu bar, dock tab "Ajustes" | Create and edit adjustment layers: "Brilho/contraste", "Níveis", "Curvas", "Matiz/saturação", "Equilíbrio de cores", "Preto e branco", "Inverter", "Limiar". Panel: "Adicionar ajuste", the parameters of the selected adjustment, "Restaurar valores" (reset), channel and tone selectors ("RGB", "Vermelho", "Verde", "Azul"; "Sombras", "Tons médios", "Realces"), curve points "Adicionar ponto" and "Remover ponto" with numeric "Entrada" and "Saída", "Preservar luminosidade". Hint: "O ajuste atua nas camadas de pixels logo abaixo dele, sem passar por texto, formas ou imagens. Use Camada > Rasterizar imagem para ajustar uma foto." Document steps keep the generic history label. |
| Criar máscara de corte / Liberar máscara de corte (Alt+Ctrl+G) | Editor menu "Camada", layer context menu | Toggles `clipToBelow` of a raster or adjustment layer so it only shows where the layer below has pixels. Disabled reason: "Disponível para camadas de pixels e ajustes logo acima de outra camada de pixels ou ajuste." The layers panel shows a corner arrow mark "Cortada na camada de baixo" on clipped rows. |
| Miniatura da camada | Editor layers panel | 32 px cached preview of a raster layer (checkerboard behind, redrawn after a short pause when its pixels change); other kinds keep their kind icon |
| Pincel / Borracha / Conta-gotas (enabled in P5b1) | Editor tool rail and options bar | Paint on the selected raster layer (session-only until the pixel flush); each stroke is one history step named "Pincel" or "Borracha" |
| Tamanho / Dureza / Opacidade / Fluxo / Suavização / Amostrar | Editor options bar of the paint tools | Brush size in px (1 to 1000), hardness, opacity, flow and smoothing in %; keys: `[` and `]` (or the physical bracket keys, or `,` and `.`) change the size, with Shift (or `{`, `}`, `<`, `>`) the hardness, digits the opacity (AltGr combinations work on ABNT2); "Amostrar" of the eyedropper reads "Camada atual" or "Camadas de pixels" (the composite of the raster and adjustment layers, without text, shapes or images) |
| Cor de frente / Cor de fundo / Trocar cores (X) / Cores padrão (D) / Cores da marca | Editor tool rail, bottom | Foreground and background chips with a color picker (the brand colors are the swatches), swap and reset buttons |
| Selecione uma camada de pixels visível e desbloqueada para pintar. | Editor options bar of the paint tools | Why painting is unavailable (no raster layer selected, or it is hidden or locked); no layer is created automatically |
| Pintar exige permissão para enviar arquivos à biblioteca de mídia. | Editor options bar of the paint tools | Why painting is unavailable to a user with `design.update` but without `media.upload` (the pixel files are uploaded as hidden media) |
| Transformação livre (Ctrl+T) | Editor menu "Editar", options bar | Scale, rotate and move the selected raster layer with the handles; buttons "Aplicar" (Enter) and "Cancelar" (Esc); the whole session is one history step "Transformação livre". Hint: "Arraste as alças para escalar e girar. Enter aplica, Esc cancela." Disabled reason: "Selecione uma camada de pixels visível e desbloqueada." |
| Cortar (tool, C) / Proporção / Aplicar corte / Cancelar | Editor tool rail and options bar | Crop box over the page; "Proporção": "Livre", "Original", "1:1", "4:5", "9:16", "16:9"; "Aplicar corte" (Enter) resizes the page and moves the content in one step "Cortar"; "Cancelar" (Esc). Hint: "Arraste na página para desenhar o corte. Enter aplica, Esc cancela." Reason: "O corte precisa ter pelo menos 64 × 64 px." The pixels outside the box are kept in the layers (non-destructive) |
| Copiar / Recortar / Colar / Colar no lugar | Editor menu "Editar" (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+Shift+V) | Copy or cut the selected pixels of the selected raster layer (the whole layer without a selection); paste creates a new raster layer. Reasons: "Selecione uma camada de pixels para copiar.", "Nada para colar.", "A imagem colada passa de 4096 px em um dos lados." |
| Camada via cópia / Camada via recorte | Editor menu "Camada" (Ctrl+J with a pixel selection, Ctrl+Shift+J) | New raster layer from the selected pixels, in the same place; "via recorte" also clears them in the source layer (two history steps) |
| Revelar tudo / Ocultar tudo / Revelar seleção / Ocultar seleção / Excluir máscara / Desativar máscara / Ativar máscara / Adicionar máscara | Editor menu "Camada" and the "Camadas" panel (button "Máscara") | Layer mask (P10): reveal or hide the whole layer, or reveal or hide by the active pixel selection; paints in gray on the mask thumbnail (black hides, white reveals). Click on the mask thumbnail targets it, Alt+click shows the mask alone on the canvas, Shift+click disables or enables it. History step labels: "Máscara: Revelar tudo" and so on, "Excluir máscara", "Desativar máscara", "Ativar máscara". Messages: "Selecione uma camada de pixels ou de ajuste.", "A camada já tem máscara.", "Não há seleção de pixels." |
| Passos do histórico / Estado inicial / Alteração | Editor, tab "Histórico" | List of the steps (unnamed document steps read "Alteração"; named steps read "Pincel", "Borracha", "Balde de tinta", "Gradiente", "Limpar seleção", "Transformação livre", "Cortar", "Recortar", "Colar", "Camada via cópia", "Camada via recorte"); the current step is marked and clicking a step (or "Estado inicial") moves the design to that state (P9) |
| Arquivo / Editar / Exibir / Camada / Ajuda | Editor menu bar (one "Menu" button below `lg`) | The menus of the editor; every item runs the same handler as its button or shortcut |
| Nova camada | Editor, menu "Camada" | Adds an empty raster layer (transparent pixels, the size of the page) on top of the stack; session-only until the pixel flush of P5b |
| Selecionar tudo / Nova camada de texto / Nova camada de forma / Ordem | Editor menu bar | Select every unlocked element / add a text or a shape in the middle of the page / stack order items (Trazer para a frente, Avançar, Recuar, Enviar para trás de tudo); the panel items of "Exibir" read "Painel: Camadas" and so on |
| Importar… | Editor menu "Arquivo" | Choose a file and add it to the page (PSD, AI, PDF first page, PNG, JPEG, WebP in Phase 0; later formats add their own rows). PSD keeps layers, groups, names, visibility, opacity and blend modes; every other format becomes one layer. Picker accept list comes from the handler registry |
| Importando arquivo… / <Formato> importado. / Cancelar importação | Editor toast and its cancel control | Progress toast while the import runs (with the cancel action), success toast "PSD importado.", "AI importado.", "PDF importado.", "PNG importado.", "JPEG importado." or "WebP importado." with the notes of "Observações da importação" as description. History step "Importar <Formato>" |
| Observações da importação | Editor success toast (and panel if approved) | What the import could not keep, one sentence per note kind: "Texto convertido em pixels (%n camadas)." (`text_as_pixels`), "Objetos inteligentes convertidos em pixels (%n)." (`smart_object_as_pixels`), "Estilos de camada ignorados (%n)." (`layer_style_dropped`), "Camadas de ajuste ignoradas (%n)." (`adjustment_layer_dropped`), "Modos de mesclagem sem equivalente (%n camadas)." (`blend_mode_fallback`), "Máscaras de corte aplicadas só em parte (%n)." (`clipping_partial`), "Grupos muito profundos foram achatados (%n)." (`groups_flattened`), "O arquivo só tinha a imagem final, sem camadas." (`flattened_image_only`), "Cores CMYK convertidas para RGB." (`cmyk_converted`), "Profundidade de cor reduzida para 8 bits." (`depth_reduced`), "Só a primeira página foi importada." (`first_page_only`), "Imagem reduzida para caber na página (%n)." (`downscaled`), "Animação ignorada: só o primeiro quadro foi importado." (`animation_ignored`); `%n` is the count |
| Recusas da importação | Editor toast (`invalid` results, texts in `DESIGN_IMPORT_MESSAGE`) | File over the limit: "O arquivo passa de %limite. Exporte uma versão menor e tente de novo." (limit per format in image-editor 8h.3). Unsupported type: "Envie um arquivo PSD, AI, PDF, PNG, JPEG ou WebP." (the list grows with the handlers). Extension and content disagree: "O conteúdo do arquivo não corresponde à extensão. Confira o arquivo." PSB: "Arquivos PSB (documento grande) não são aceitos. Salve como PSD." PSD color mode: "O modo de cor deste PSD não é aceito. Converta para RGB, CMYK, tons de cinza ou indexado." Corrupt file: "Não foi possível ler o arquivo. Ele pode estar corrompido." Encrypted PDF or AI: "O arquivo tem senha. Salve uma cópia sem senha e tente de novo." AI without PDF compatibility: "Este arquivo .ai foi salvo sem compatibilidade com PDF. No Illustrator, salve de novo marcando “Criar arquivo compatível com PDF”." Canvas too large: "A tela do arquivo passa de 4096 px em um dos lados. Reduza o tamanho e tente de novo." Canvas too small: "A tela do arquivo é menor que 64 px. Use um arquivo maior." No visible layers: "O arquivo não tem camadas visíveis." Too many layers: "O arquivo tem camadas demais para esta página (limite %n)." Layer too large: "Uma camada do arquivo é grande demais para importar." Memory budget: "Não há memória livre para este arquivo. Remova camadas de pixels e tente de novo." Timed out: "A leitura do arquivo demorou demais e foi interrompida." Image corrupt: "Não foi possível ler a imagem. Ela pode estar corrompida." Image too large to decode: "A imagem é grande demais para abrir (%largura × %altura px)." Empty file: "O arquivo está vazio." Read failed: "Não foi possível ler o arquivo." AI could not be drawn: "Não foi possível desenhar este arquivo .ai. Exporte como PNG ou PSD e tente de novo." No permission: "Importar exige permissão para enviar arquivos à biblioteca de mídia." Cancelled import shows no toast |
| Réguas | Editor menu "Exibir" | Show or hide the rulers (a view setting, never stored in the design) |
| Camadas / Propriedades / Ajustes / Histórico / Marca | Editor docked panels (tabs) | The tabs of the panel dock; "Ajustes" and "Histórico" say they arrive with later phases until they have behavior |
| Ocultar / Mostrar camada, Visível, Bloqueada | Layers | The eye and lock buttons of a layer (pressed means visible / locked); hiding is a document change that can be undone |
| Renomear camada | Layers (double click or F2) | Give a layer its own name (up to 80 characters); an empty name goes back to the derived one |
| Camada movida para a posição X de Y | Layers (announcement) | Spoken after a layer is moved with Alt + arrow or by dragging; position 1 is the front |
| Ferramentas / Mais ferramentas | Editor tool rail | The tool rail; a group with more tools opens a flyout (long press, right click or Alt + arrow down) |
| Opções da ferramenta | Editor options bar (toolbar name) | The settings of the active tool: Negrito, Itálico, alignment, Cor, Preenchimento, Cor da linha |
| Zoom / Foco | Image properties | Enlarge the image inside its frame (the crop) and choose the visible part |
| Brilho / Contraste / Sombra / Texto alternativo | Image and text properties | Simple filters, the text shadow and the description of an image for screen readers |
| Versões / Restaurar no rascunho | Editor | The saved versions / copy one of them into the draft (the version itself never changes) |
| Exportar | Editor | Create PNG or JPEG files of every page in the media library |
| Modelos / Modelo da marca / Modelo | List, editor, "Usar modelo" | Designs marked as templates of a brand; a new design can start from one |
| Redimensionar | List | Create a copy of a design in another format; the source stays as it is |
| Mover para a lixeira / Restaurar | List | Archive a design / bring it back (nothing is deleted) |
| O que vamos criar hoje? / Buscar designs pelo nome | List (hero) | The heading and the search field of the design gallery |
| Continue criando / Modelos da marca | List | Title of the gallery in the tabs "Ativos" and "Modelos" |
| Design sem título | List, editor | Name of a design created from a format circle until the person renames it |
| Usar modelo | List (template card) | Create a new design as a copy of the template and open it |
| Carregar mais | List | Load the next designs (keyboard alternative to the infinite scroll) |
| Editado há … / Editado em … | List card | When the design last changed ("Editado há 9 h", "Editado em 3 de nov.") |

## 4e. Video editor

| Term (pt-BR) | Where | Meaning |
|---|---|---|
| Vídeos | Marketing menu, list | The video projects edited in the platform; one project is one editable video of a brand |
| Novo vídeo | List | Create a project (name, brand, format) |
| Clipe / Imagem / Texto / Música | Editor toolbar | Add a video or still image to the main track / an image over the video / a text / the sound of a library video |
| Principal / Sobreposição / Texto / Música | Timeline | The four tracks |
| Dividir | Editor | Cut the selected clip (or the main clip under the playhead) in two at the playhead |
| Preencher / Ajustar | Clip properties | Fill the frame (cropping) / show the whole clip on the background color |
| Volume / Aparecer / Desaparecer | Clip and project properties | Sound level / fade in / fade out |
| Início / Duração / Início no arquivo | Clip properties | Where the clip starts on the timeline / how long it lasts / which point of the file it starts from |
| Clipes | Editor side panel | Every clip of every track as a list; the keyboard alternative to the timeline |
| Mover para a esquerda / Mover para a direita | Clip list | Change the order of a main clip |
| Exportar / Cancelar / Tentar enviar de novo | Editor | Create the MP4 in the media library / stop the export / upload again the file already generated |
| Somente leitura | Editor | Shown without `video.update`, for a project in the trash and below 1024 px |
| Mover para a lixeira / Restaurar | List | Archive a project / bring it back (nothing is deleted) |

## 5. Adding a term

Add the row here, use it in the screen, and if it names a status or enum value also update [../reference/enums.md](../reference/enums.md). `review` checks new strings against this glossary.
