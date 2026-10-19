import { Plus, Trash2 } from "lucide-react";
import { ImageField } from "@/components/cms/fields/image-field";
import { LinkField } from "@/components/cms/fields/link-field";
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/shared/admin/form-fields";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { Button } from "@/components/shared/ui/button";
import type { PageOption } from "@/lib/cms/pages.functions";
import { parseSectionContent } from "@/lib/shared/content/registry";
import type {
  GalleryContent,
  HeroContent,
  ImageTextContent,
  SiteCta,
} from "@/lib/shared/content/schemas";
import { ImageSide, PortfolioSource, SectionKind } from "@/lib/shared/enums";

type Props = {
  sectionId: string;
  kind: SectionKind;
  content: Record<string, unknown>;
  pages: PageOption[];
  onChange: (content: Record<string, unknown>) => void;
};

function CtaFields({
  id,
  label,
  value,
  pages,
  onChange,
}: {
  id: string;
  label: string;
  value: SiteCta;
  pages: PageOption[];
  onChange: (value: SiteCta) => void;
}) {
  return (
    <div className="space-y-3">
      <TextField
        id={`${id}-label`}
        label={`${label}: texto`}
        value={value.label}
        onValueChange={(next) => onChange({ ...value, label: next })}
        maxLength={40}
        counter
      />
      <LinkField
        id={`${id}-link`}
        label={`${label}: destino`}
        value={value.link}
        pages={pages}
        onChange={(link) => onChange({ ...value, link })}
      />
    </div>
  );
}

function HeroForm({ sectionId, content, pages, onChange }: Props) {
  const value = parseSectionContent(SectionKind.Hero, content) as HeroContent;
  const set = (patch: Partial<HeroContent>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <TextField
        id={`${sectionId}-eyebrow`}
        label="Chamada curta"
        value={value.eyebrow}
        onValueChange={(eyebrow) => set({ eyebrow })}
        maxLength={60}
        counter
      />
      <TextField
        id={`${sectionId}-headline`}
        label="Título"
        required
        value={value.headline}
        onValueChange={(headline) => set({ headline })}
        maxLength={80}
        counter
      />
      <TextAreaField
        id={`${sectionId}-sub`}
        label="Subtítulo"
        value={value.subheadline}
        onValueChange={(subheadline) => set({ subheadline })}
        maxLength={300}
        rows={3}
      />
      <ImageField
        id={`${sectionId}-image`}
        label="Imagem"
        value={value.image}
        onChange={(image) => set({ image })}
      />
      <CtaFields
        id={`${sectionId}-primary`}
        label="Botão principal"
        value={value.primaryCta}
        pages={pages}
        onChange={(primaryCta) => set({ primaryCta })}
      />
      <CtaFields
        id={`${sectionId}-secondary`}
        label="Botão secundário"
        value={value.secondaryCta}
        pages={pages}
        onChange={(secondaryCta) => set({ secondaryCta })}
      />
    </div>
  );
}

function LimitedCollectionForm({ sectionId, kind, content, onChange }: Props) {
  const value = parseSectionContent(kind, content) as {
    title: string;
    intro?: string;
    limit: number;
  };
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <TextField
        id={`${sectionId}-title`}
        label="Título"
        value={value.title}
        onValueChange={(title) => set({ title })}
        maxLength={80}
        counter
      />
      {kind === SectionKind.ServicesGrid ? (
        <TextAreaField
          id={`${sectionId}-intro`}
          label="Introdução"
          value={value.intro ?? ""}
          onValueChange={(intro) => set({ intro })}
          maxLength={300}
          rows={3}
        />
      ) : null}
      <NumberField
        id={`${sectionId}-limit`}
        label="Quantos itens mostrar"
        hint={`Os itens vêm das telas de ${kind === SectionKind.ServicesGrid ? "Serviços" : "Depoimentos"}.`}
        value={String(value.limit)}
        onValueChange={(limit) => set({ limit: Math.min(24, Math.max(1, Number(limit) || 6)) })}
      />
    </div>
  );
}

function PortfolioForm({ sectionId, content, pages, onChange }: Props) {
  const value = parseSectionContent(SectionKind.PortfolioGrid, content) as {
    title: string;
    source: PortfolioSource;
    caseStudyIds: string[];
    limit: number;
  };
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });
  const cases = pages.filter((page) => page.kind === "case_study");
  return (
    <div className="space-y-4">
      <TextField
        id={`${sectionId}-title`}
        label="Título"
        value={value.title}
        onValueChange={(title) => set({ title })}
        maxLength={80}
        counter
      />
      <SelectField
        id={`${sectionId}-source`}
        label="Quais cases mostrar"
        value={value.source}
        onValueChange={(source) => set({ source })}
        options={[
          { value: PortfolioSource.All, label: "Todos os cases autorizados" },
          { value: PortfolioSource.Manual, label: "Escolher à mão" },
        ]}
      />
      {value.source === PortfolioSource.Manual ? (
        <FieldGroup legend="Cases escolhidos (na ordem)" gap="sm">
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há páginas de case.</p>
          ) : (
            cases.map((page) => {
              const index = value.caseStudyIds.indexOf(page.id);
              return (
                <label key={page.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={index >= 0}
                    onChange={(event) =>
                      set({
                        caseStudyIds: event.target.checked
                          ? [...value.caseStudyIds, page.id]
                          : value.caseStudyIds.filter((item) => item !== page.id),
                      })
                    }
                  />
                  {page.title || page.slug}
                  {index >= 0 ? <span className="text-muted-foreground">#{index + 1}</span> : null}
                </label>
              );
            })
          )}
        </FieldGroup>
      ) : null}
      <NumberField
        id={`${sectionId}-limit`}
        label="Quantos itens mostrar"
        value={String(value.limit)}
        onValueChange={(limit) => set({ limit: Math.min(24, Math.max(1, Number(limit) || 6)) })}
      />
    </div>
  );
}

function RichTextForm({ sectionId, content, onChange }: Props) {
  const value = parseSectionContent(SectionKind.RichText, content) as { body: string };
  return (
    <TextAreaField
      id={`${sectionId}-body`}
      label="Texto"
      value={value.body}
      onValueChange={(body) => onChange({ body })}
      maxLength={6000}
      rows={12}
    />
  );
}

function ImageTextForm({ sectionId, content, pages, onChange }: Props) {
  const value = parseSectionContent(SectionKind.ImageText, content) as ImageTextContent;
  const set = (patch: Partial<ImageTextContent>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <ImageField
        id={`${sectionId}-image`}
        label="Imagem"
        value={value.image}
        onChange={(image) => set({ image })}
      />
      <SelectField
        id={`${sectionId}-side`}
        label="Lado da imagem"
        value={value.side}
        onValueChange={(side) => set({ side: side as ImageSide })}
        options={[
          { value: ImageSide.Left, label: "Esquerda" },
          { value: ImageSide.Right, label: "Direita" },
        ]}
      />
      <TextField
        id={`${sectionId}-title`}
        label="Título"
        required
        value={value.title}
        onValueChange={(title) => set({ title })}
        maxLength={80}
        counter
      />
      <TextAreaField
        id={`${sectionId}-text`}
        label="Texto"
        value={value.text}
        onValueChange={(text) => set({ text })}
        maxLength={600}
        rows={5}
      />
      <CtaFields
        id={`${sectionId}-cta`}
        label="Botão"
        value={value.cta}
        pages={pages}
        onChange={(cta) => set({ cta })}
      />
    </div>
  );
}

function GalleryForm({ sectionId, content, onChange }: Props) {
  const value = parseSectionContent(SectionKind.Gallery, content) as GalleryContent;
  const set = (patch: Partial<GalleryContent>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <TextField
        id={`${sectionId}-title`}
        label="Título"
        value={value.title}
        onValueChange={(title) => set({ title })}
        maxLength={80}
        counter
      />
      {value.images.map((image, index) => (
        <div key={index} className="space-y-2">
          <ImageField
            id={`${sectionId}-image-${index}`}
            label={`Imagem ${index + 1}`}
            value={image}
            onChange={(next) =>
              set({ images: value.images.map((item, at) => (at === index ? next : item)) })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => set({ images: value.images.filter((_, at) => at !== index) })}
          >
            <Trash2 aria-hidden="true" /> Remover imagem {index + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={value.images.length >= 12}
        onClick={() =>
          set({ images: [...value.images, { mediaVersionId: null, alt: "", decorative: false }] })
        }
      >
        <Plus aria-hidden="true" /> Adicionar imagem
      </Button>
    </div>
  );
}

function FaqForm({ sectionId, content, onChange }: Props) {
  const value = parseSectionContent(SectionKind.Faq, content) as {
    title: string;
    items: { question: string; answer: string }[];
  };
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });
  const change = (index: number, patch: Partial<{ question: string; answer: string }>) =>
    set({ items: value.items.map((item, at) => (at === index ? { ...item, ...patch } : item)) });
  return (
    <div className="space-y-4">
      <TextField
        id={`${sectionId}-title`}
        label="Título"
        value={value.title}
        onValueChange={(title) => set({ title })}
        maxLength={80}
        counter
      />
      {value.items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border p-3">
          <TextField
            id={`${sectionId}-q-${index}`}
            label={`Pergunta ${index + 1}`}
            value={item.question}
            onValueChange={(question) => change(index, { question })}
            maxLength={160}
          />
          <TextAreaField
            id={`${sectionId}-a-${index}`}
            label="Resposta"
            value={item.answer}
            onValueChange={(answer) => change(index, { answer })}
            maxLength={600}
            rows={3}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => set({ items: value.items.filter((_, at) => at !== index) })}
          >
            <Trash2 aria-hidden="true" /> Remover pergunta {index + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={value.items.length >= 30}
        onClick={() => set({ items: [...value.items, { question: "", answer: "" }] })}
      >
        <Plus aria-hidden="true" /> Adicionar pergunta
      </Button>
    </div>
  );
}

function ContactForm({ sectionId, content, onChange }: Props) {
  const value = parseSectionContent(SectionKind.ContactForm, content) as {
    title: string;
    intro: string;
    recipientEmail: string;
    consentText: string;
    successMessage: string;
  };
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <TextField
        id={`${sectionId}-title`}
        label="Título"
        value={value.title}
        onValueChange={(title) => set({ title })}
        maxLength={80}
        counter
      />
      <TextAreaField
        id={`${sectionId}-intro`}
        label="Introdução"
        value={value.intro}
        onValueChange={(intro) => set({ intro })}
        maxLength={300}
        rows={3}
      />
      <TextField
        id={`${sectionId}-recipient`}
        label="E-mail que recebe as mensagens"
        value={value.recipientEmail}
        onValueChange={(recipientEmail) => set({ recipientEmail })}
        maxLength={200}
        hint="Guardado para uso futuro: por enquanto as mensagens chegam só na caixa de entrada do CMS."
      />
      <TextAreaField
        id={`${sectionId}-consent`}
        label="Texto do consentimento"
        value={value.consentText}
        onValueChange={(consentText) => set({ consentText })}
        maxLength={300}
        rows={3}
      />
      <TextField
        id={`${sectionId}-success`}
        label="Mensagem de sucesso"
        required
        value={value.successMessage}
        onValueChange={(successMessage) => set({ successMessage })}
        maxLength={200}
      />
    </div>
  );
}

const forms: Record<SectionKind, (props: Props) => React.ReactNode> = {
  [SectionKind.Hero]: HeroForm,
  [SectionKind.ServicesGrid]: LimitedCollectionForm,
  [SectionKind.PortfolioGrid]: PortfolioForm,
  [SectionKind.Testimonials]: LimitedCollectionForm,
  [SectionKind.RichText]: RichTextForm,
  [SectionKind.ImageText]: ImageTextForm,
  [SectionKind.Gallery]: GalleryForm,
  [SectionKind.Faq]: FaqForm,
  [SectionKind.ContactForm]: ContactForm,
};

export function SectionForm(props: Props) {
  return <>{forms[props.kind](props)}</>;
}
