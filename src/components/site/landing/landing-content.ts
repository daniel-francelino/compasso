export const LandingAnchor = {
  Services: "servicos",
  Workspace: "metodo",
  Process: "processo",
  About: "sobre",
  Contact: "contato",
} as const;

export const navItems = [
  { label: "Serviços", anchor: LandingAnchor.Services },
  { label: "Método", anchor: LandingAnchor.Workspace },
  { label: "Processo", anchor: LandingAnchor.Process },
  { label: "Sobre", anchor: LandingAnchor.About },
] as const;

export const heroWords = ["aparece", "engaja", "conversa", "cresce"];

export const platforms = [
  "Instagram",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "Pinterest",
  "Facebook",
  "Threads",
  "WhatsApp Business",
];

export const heroFeed = [
  { title: "Pauta de março aprovada", detail: "12 ideias · 3 formatos", tone: "approved" },
  { title: "Reels agendado", detail: "Quinta, 18:30 · Instagram", tone: "planned" },
  { title: "Carrossel em revisão", detail: "Aguardando seu ok", tone: "review" },
  { title: "Relatório do mês pronto", detail: "Alcance, salvamentos e cliques", tone: "done" },
] as const;

export const services = [
  {
    key: "strategy",
    title: "Estratégia de conteúdo",
    text: "Posicionamento, pilares editoriais e tom de voz para a sua marca falar de forma única.",
  },
  {
    key: "calendar",
    title: "Calendário editorial",
    text: "Pauta mensal organizada por objetivo, formato e canal, sempre com antecedência.",
  },
  {
    key: "creation",
    title: "Criação de posts e reels",
    text: "Roteiros, legendas e direção de arte alinhados à identidade visual da marca.",
  },
  {
    key: "community",
    title: "Gestão de comunidade",
    text: "Resposta a comentários e mensagens com a voz da marca, no tempo certo.",
  },
  {
    key: "publishing",
    title: "Publicação e agendamento",
    text: "Tudo no ar nos melhores horários, sem você precisar lembrar de postar.",
  },
  {
    key: "reports",
    title: "Relatórios e ajustes",
    text: "Números que importam, leitura simples e próximos passos claros todo mês.",
  },
] as const;

export const workspaceSteps = [
  {
    key: "plan",
    label: "Planejar",
    page: "Pauta do mês",
    rows: [
      { name: "Status", value: "Em planejamento" },
      { name: "Canais", value: "Instagram, TikTok" },
      { name: "Objetivo", value: "Gerar conversas" },
    ],
    todos: ["Definir pilares do mês", "Mapear datas e lançamentos", "Montar a lista de pautas"],
  },
  {
    key: "produce",
    label: "Produzir",
    page: "Roteiros e artes",
    rows: [
      { name: "Status", value: "Em produção" },
      { name: "Formato", value: "Reels e carrossel" },
      { name: "Prazo", value: "Sexta" },
    ],
    todos: ["Escrever roteiros", "Criar artes e capas", "Revisar legendas e hashtags"],
  },
  {
    key: "approve",
    label: "Aprovar",
    page: "Revisão com você",
    rows: [
      { name: "Status", value: "Aguardando aprovação" },
      { name: "Responsável", value: "Você" },
      { name: "Prazo", value: "48 horas" },
    ],
    todos: ["Receber o link de aprovação", "Pedir ajustes, se houver", "Aprovar com um clique"],
  },
  {
    key: "publish",
    label: "Publicar",
    page: "Agenda de publicação",
    rows: [
      { name: "Status", value: "Agendado" },
      { name: "Horário", value: "Melhor janela do público" },
      { name: "Depois", value: "Relatório do mês" },
    ],
    todos: ["Agendar nos canais", "Acompanhar os primeiros comentários", "Registrar os resultados"],
  },
] as const;

export const slashCommands = ["Pauta", "Reels", "Carrossel", "Story", "Legenda"];

export const terminalLines = [
  "aura planejar --mes proximo",
  "Lendo objetivos e pilares da marca",
  "12 pautas sugeridas em 3 formatos",
  "Calendário editorial montado",
  "Enviado para sua aprovação",
];

export const aboutText =
  "Sou Rayana Vasconcelos, social media. Cuido das redes de marcas que querem presença com estratégia, e não apenas posts soltos: planejamento, criação, publicação e leitura de resultados em um só fluxo.";

export const principles = [
  { title: "Estratégia antes do post", text: "Cada conteúdo nasce de um objetivo." },
  { title: "Constância sem correria", text: "Pauta pronta com antecedência." },
  { title: "Transparência", text: "Você vê, aprova e acompanha tudo." },
] as const;

export const contactCopy = {
  title: "Vamos organizar as redes da sua marca?",
  intro:
    "Conte um pouco sobre o seu negócio e o que você espera das redes sociais. A resposta chega por e-mail ou telefone.",
  consentText:
    "Concordo em ser contatada(o) por Rayana Vasconcelos sobre este pedido, e que meus dados sejam usados apenas para isso.",
  successMessage: "Mensagem enviada. Em breve a Rayana entra em contato.",
};
