import type { ZodTypeAny, z } from "zod";
import { sectionContentSchemas } from "@/lib/shared/content/schemas";
import type { DraftSection } from "@/lib/shared/content/schemas";
import { SectionKind } from "@/lib/shared/enums";

export const SectionCategory = {
  Opening: "opening",
  Text: "text",
  Image: "image",
  Collection: "collection",
  Invite: "invite",
} as const;
export type SectionCategory = (typeof SectionCategory)[keyof typeof SectionCategory];

export type ComponentDef = {
  kind: SectionKind;
  category: SectionCategory;
  label: string;
  description: string;
  schemaVersion: number;
  schema: ZodTypeAny;
  anchor: boolean;
};

export const componentRegistry: Record<SectionKind, ComponentDef> = {
  [SectionKind.Hero]: {
    kind: SectionKind.Hero,
    category: SectionCategory.Opening,
    label: "Abertura",
    description: "Título principal, subtítulo, imagem e botões.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.Hero],
    anchor: true,
  },
  [SectionKind.ServicesGrid]: {
    kind: SectionKind.ServicesGrid,
    category: SectionCategory.Collection,
    label: "Serviços",
    description: "Os serviços cadastrados, em cartões.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.ServicesGrid],
    anchor: true,
  },
  [SectionKind.PortfolioGrid]: {
    kind: SectionKind.PortfolioGrid,
    category: SectionCategory.Collection,
    label: "Portfólio",
    description: "Cases autorizados e publicados.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.PortfolioGrid],
    anchor: true,
  },
  [SectionKind.Testimonials]: {
    kind: SectionKind.Testimonials,
    category: SectionCategory.Collection,
    label: "Depoimentos",
    description: "Frases de clientes, com autor e cargo.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.Testimonials],
    anchor: true,
  },
  [SectionKind.RichText]: {
    kind: SectionKind.RichText,
    category: SectionCategory.Text,
    label: "Texto",
    description: "Títulos, parágrafos e listas.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.RichText],
    anchor: true,
  },
  [SectionKind.ImageText]: {
    kind: SectionKind.ImageText,
    category: SectionCategory.Image,
    label: "Imagem e texto",
    description: "Uma imagem ao lado de um texto curto.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.ImageText],
    anchor: true,
  },
  [SectionKind.Gallery]: {
    kind: SectionKind.Gallery,
    category: SectionCategory.Image,
    label: "Galeria",
    description: "De 1 a 12 imagens.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.Gallery],
    anchor: true,
  },
  [SectionKind.Faq]: {
    kind: SectionKind.Faq,
    category: SectionCategory.Text,
    label: "Perguntas frequentes",
    description: "Perguntas e respostas.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.Faq],
    anchor: true,
  },
  [SectionKind.ContactForm]: {
    kind: SectionKind.ContactForm,
    category: SectionCategory.Invite,
    label: "Formulário de contato",
    description: "Recebe mensagens de visitantes.",
    schemaVersion: 1,
    schema: sectionContentSchemas[SectionKind.ContactForm],
    anchor: true,
  },
};

export const parseSectionContent = (
  kind: SectionKind,
  content: unknown,
): Record<string, unknown> => {
  const parsed = componentRegistry[kind].schema.safeParse(content);
  return parsed.success
    ? (parsed.data as z.infer<ZodTypeAny>)
    : componentRegistry[kind].schema.parse({});
};

export const newSection = (kind: SectionKind, id: string): DraftSection => ({
  id,
  component: kind,
  schemaVersion: componentRegistry[kind].schemaVersion,
  content: parseSectionContent(kind, {}),
  appearance: {},
  visible: true,
});
