export const LandingAnchor = {
  Audience: "para-quem",
  Services: "servicos",
  Process: "processo",
  Method: "metodo",
  About: "sobre",
  Faq: "duvidas",
  Contact: "contato",
} as const;

export const navItems = [
  { label: "Serviços", anchor: LandingAnchor.Services },
  { label: "Processo", anchor: LandingAnchor.Process },
  { label: "Sobre", anchor: LandingAnchor.About },
  { label: "Dúvidas", anchor: LandingAnchor.Faq },
] as const;

export const hero = {
  eyebrow: "Marketing • Social Media • Comunicação",
  titleStart: "Estratégia e criatividade para marcas",
  titleAccessible: "Estratégia e criatividade para marcas com personalidade.",
  text: "Planejo, crio e acompanho o conteúdo da sua marca para você ter um perfil coerente, constante e com resultados que dá para medir.",
  cta: "Quero conversar sobre minha marca",
  proof: [
    "Formada em Gestão de Marketing",
    "Projetos pontuais ou mensais",
    "Você aprova antes de publicar",
  ],
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

export const audience = {
  eyebrow: "Para quem é",
  title: "Postar sem estratégia cansa e não traz resultado.",
  text: "Se alguma dessas situações é familiar, seu perfil pode trabalhar mais por você.",
  pains: [
    {
      key: "results",
      title: "Você posta, mas não sabe se funciona",
      text: "Falta leitura de resultados para decidir o que manter e o que mudar.",
    },
    {
      key: "time",
      title: "Falta tempo para manter a constância",
      text: "Planejar, criar e publicar todo mês vira mais uma tarefa pendente.",
    },
    {
      key: "voice",
      title: "Seu perfil não tem uma voz clara",
      text: "Cada publicação parece de uma marca diferente.",
    },
  ] as const,
  solution:
    "Eu cuido do planejamento, da criação e da análise, e você acompanha e aprova cada etapa.",
};

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

export const method = {
  title: "Do plano ao post",
  text: "Cada ciclo segue quatro etapas simples, e você acompanha todas.",
  steps: [
    {
      key: "plan",
      label: "Planejar",
      text: "Defino pilares, datas e pautas do mês.",
      todos: ["Definir pilares do mês", "Mapear datas e lançamentos", "Montar a lista de pautas"],
    },
    {
      key: "produce",
      label: "Produzir",
      text: "Escrevo os roteiros e crio as artes.",
      todos: ["Escrever roteiros", "Criar artes e capas", "Revisar legendas e hashtags"],
    },
    {
      key: "approve",
      label: "Validar",
      text: "Você revisa e aprova antes de publicar.",
      todos: ["Receber os conteúdos", "Pedir ajustes, se houver", "Aprovar para publicar"],
    },
    {
      key: "publish",
      label: "Publicar",
      text: "Agendo, acompanho e registro os resultados.",
      todos: ["Agendar nos canais", "Acompanhar os comentários", "Registrar os resultados"],
    },
  ],
} as const;

export const about = {
  title: "Prazer, sou a Rayana.",
  paragraphs: [
    "Sou formada em Gestão de Marketing e atuo com gestão de redes sociais, criação de conteúdo e comunicação para marcas e pequenos negócios.",
    "Meu trabalho combina planejamento, sensibilidade visual e histórias reais para construir uma presença digital coerente com cada negócio.",
  ],
  principles: [
    { title: "Branding e Posicionamento", text: "Uma marca com voz própria e direção clara." },
    {
      title: "Relação entre marcas e pessoas",
      text: "Conteúdo que aproxima e conversa com o público.",
    },
    { title: "Aprendizado contínuo", text: "Cada projeto ensina e melhora o próximo." },
  ],
};

export const faq = {
  eyebrow: "Dúvidas",
  title: "Antes de conversar",
  items: [
    {
      question: "Para quem você trabalha?",
      answer:
        "Para marcas e pequenos negócios que querem uma presença digital coerente com a sua identidade.",
    },
    {
      question: "Posso contratar só um serviço?",
      answer: "Sim. Cada serviço pode ser contratado de forma pontual ou mensal.",
    },
    {
      question: "O que acontece depois da primeira conversa?",
      answer:
        "Preparo uma proposta com entregas, prazos e investimento. Aprovada a proposta, organizamos temas, formatos e calendário.",
    },
    {
      question: "Eu preciso aprovar os conteúdos?",
      answer: "Sim. Você valida cada conteúdo antes de ir ao ar e pode pedir ajustes.",
    },
    {
      question: "Como acompanho os resultados?",
      answer: "Analiso os resultados e conversamos sobre os próximos passos para ajustar a rota.",
    },
  ],
};

export const ctaLabel = "Quero uma proposta para minha marca";

export const contact = {
  title: "Vamos criar algo juntos?",
  text: "Toda marca tem uma história. Vamos descobrir a melhor forma de contar a sua.",
  detail:
    "Trabalho com projetos pontuais e com acompanhamento mensal. Depois de uma conversa inicial, preparo uma proposta sob medida, com entregas, prazos e investimento claros para o seu negócio.",
  instagram: { label: "@rayanavasconceloss", href: "https://instagram.com/rayanavasconceloss" },
  email: { label: "rayana.vass@gmail.com", href: "mailto:rayana.vass@gmail.com" },
};
