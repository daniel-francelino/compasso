export const LandingAnchor = {
  Services: "servicos",
  Process: "processo",
  Workspace: "metodo",
  About: "sobre",
  Contact: "contato",
} as const;

export const navItems = [
  { label: "Serviços", anchor: LandingAnchor.Services },
  { label: "Processo", anchor: LandingAnchor.Process },
  { label: "Sobre", anchor: LandingAnchor.About },
] as const;

export const hero = {
  eyebrow: "Marketing • Social Media • Comunicação",
  titleStart: "Estratégia e criatividade para marcas",
  titleAccessible: "Estratégia e criatividade para marcas com personalidade.",
  text: "Gestão de redes sociais, criação de conteúdo e comunicação para marcas e pequenos negócios, com planejamento, sensibilidade visual e histórias reais.",
};

export const heroWords = [
  "com personalidade.",
  "que se destacam.",
  "que conversam.",
  "que crescem.",
];

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

export const heroPhoto = { src: "/landing/rayana.webp", alt: "Rayana Vasconcelos" };

export const heroFeed = [
  { title: "Pauta do mês aprovada", detail: "Temas, formatos e calendário", tone: "approved" },
  { title: "Reels agendado", detail: "Quinta, 18:30 · Instagram", tone: "planned" },
  { title: "Carrossel em validação", detail: "Aguardando seu ok", tone: "review" },
  { title: "Análise de resultados", detail: "Próximos passos definidos", tone: "done" },
] as const;

export const services = [
  {
    key: "social",
    title: "Gestão de Redes Sociais",
    text: "Planejamento, calendário editorial, publicações e análise de resultados.",
  },
  {
    key: "content",
    title: "Criação de Conteúdo",
    text: "Posts, carrosséis, legendas, roteiros, Reels e edição.",
  },
  {
    key: "capture",
    title: "Captação de conteúdo",
    text: "Fotos e vídeos de produtos, ambientes, processos e bastidores.",
  },
  {
    key: "consulting",
    title: "Consultoria de Comunicação",
    text: "Análise de perfil, tom de voz, posicionamento e direcionamento.",
  },
] as const;

export const processSteps = [
  { number: "01", title: "Conversa inicial", text: "Entender marca, público e objetivos." },
  { number: "02", title: "Proposta", text: "Definimos prazos, entregas e investimento." },
  { number: "03", title: "Planejamento", text: "Organizamos temas, formatos e calendário." },
  { number: "04", title: "Criação e conteúdo", text: "Produzimos e validamos conteúdos." },
  { number: "05", title: "Acompanhamento", text: "Analisamos resultados e próximos passos." },
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
    label: "Validar",
    page: "Revisão com você",
    rows: [
      { name: "Status", value: "Aguardando validação" },
      { name: "Responsável", value: "Você" },
      { name: "Prazo", value: "48 horas" },
    ],
    todos: ["Receber os conteúdos", "Pedir ajustes, se houver", "Aprovar para publicar"],
  },
  {
    key: "publish",
    label: "Publicar",
    page: "Agenda de publicação",
    rows: [
      { name: "Status", value: "Agendado" },
      { name: "Horário", value: "Melhor janela do público" },
      { name: "Depois", value: "Análise de resultados" },
    ],
    todos: ["Agendar nos canais", "Acompanhar os primeiros comentários", "Registrar os resultados"],
  },
] as const;

export const slashCommands = ["Pauta", "Reels", "Carrossel", "Story", "Legenda"];

export const about = {
  title: "Prazer, sou a Rayana.",
  text: "Sou formada em Gestão de Marketing e atuo com gestão de redes sociais, criação de conteúdo e comunicação para marcas e pequenos negócios. Meu trabalho combina planejamento, sensibilidade visual e histórias reais para construir uma presença digital coerente com cada negócio.",
  principles: [
    { title: "Branding e Posicionamento", text: "Uma marca com voz própria e direção clara." },
    {
      title: "Relação entre marcas e pessoas",
      text: "Conteúdo que aproxima e conversa com o público.",
    },
    { title: "Aprendizado contínuo", text: "Cada projeto ensina e melhora o próximo." },
  ],
};

export const contact = {
  title: "Vamos criar algo juntos?",
  text: "Cada marca tem sua história, vamos encontrar a melhor forma de contá-la.",
  detail:
    "Atendo projetos pontuais e contratos mensais de comunicação e conteúdo. Após uma conversa inicial, preparo uma proposta com entregas, prazos e investimentos adequados às necessidades do seu negócio.",
  instagram: { label: "@rayanavasconceloss", href: "https://instagram.com/rayanavasconceloss" },
  email: { label: "rayana.vass@gmail.com", href: "mailto:rayana.vass@gmail.com" },
};
