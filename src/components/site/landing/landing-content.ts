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

export const PlatformKey = {
  Instagram: "instagram",
  TikTok: "tiktok",
  LinkedIn: "linkedin",
  YouTube: "youtube",
  Pinterest: "pinterest",
  Facebook: "facebook",
  Threads: "threads",
  WhatsApp: "whatsapp",
} as const;

export type PlatformKey = (typeof PlatformKey)[keyof typeof PlatformKey];

export const platforms = [
  { key: PlatformKey.Instagram, name: "Instagram" },
  { key: PlatformKey.TikTok, name: "TikTok" },
  { key: PlatformKey.LinkedIn, name: "LinkedIn" },
  { key: PlatformKey.YouTube, name: "YouTube" },
  { key: PlatformKey.Pinterest, name: "Pinterest" },
  { key: PlatformKey.Facebook, name: "Facebook" },
  { key: PlatformKey.Threads, name: "Threads" },
  { key: PlatformKey.WhatsApp, name: "WhatsApp Business" },
] as const;

export const heroPhoto = { src: "/landing/rayana.webp", alt: "Rayana Vasconcelos" };

export const services = [
  {
    key: "social",
    title: "Gestão de Redes Sociais",
    text: "Planejo, publico e acompanho seu perfil com calendário editorial e leitura dos resultados.",
  },
  {
    key: "content",
    title: "Criação de Conteúdo",
    text: "Posts, carrosséis, legendas, roteiros e Reels pensados para a voz da sua marca.",
  },
  {
    key: "capture",
    title: "Captação de Conteúdo",
    text: "Fotos e vídeos de produtos, ambientes e bastidores, com o olhar da sua marca.",
  },
  {
    key: "consulting",
    title: "Consultoria de Comunicação",
    text: "Análise do perfil, tom de voz e posicionamento para você saber para onde ir.",
  },
] as const;

export const processSteps = [
  {
    number: "01",
    title: "Conversa inicial",
    text: "Conheço sua marca, seu público e o que você quer alcançar.",
  },
  {
    number: "02",
    title: "Proposta",
    text: "Combinamos prazos, entregas e investimento, tudo às claras.",
  },
  {
    number: "03",
    title: "Planejamento",
    text: "Defino temas, formatos e calendário editorial do mês.",
  },
  {
    number: "04",
    title: "Criação e aprovação",
    text: "Crio os conteúdos e você aprova antes de ir ao ar.",
  },
  {
    number: "05",
    title: "Acompanhamento",
    text: "Analiso os resultados e ajustamos a rota juntas.",
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
  text: "Toda marca tem uma história. Vamos descobrir a melhor forma de contar a sua.",
  detail:
    "Trabalho com projetos pontuais e com acompanhamento mensal. Depois de uma conversa inicial, preparo uma proposta sob medida, com entregas, prazos e investimento claros para o seu negócio.",
  instagram: { label: "@rayanavasconceloss", href: "https://instagram.com/rayanavasconceloss" },
  email: { label: "rayana.vass@gmail.com", href: "mailto:rayana.vass@gmail.com" },
};
