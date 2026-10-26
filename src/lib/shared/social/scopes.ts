export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
] as const;

export const instagramScopeLabels: Record<(typeof INSTAGRAM_SCOPES)[number], string> = {
  instagram_business_basic: "Ler dados do perfil",
  instagram_business_content_publish: "Publicar conteúdos",
  instagram_business_manage_insights: "Ler métricas",
};
