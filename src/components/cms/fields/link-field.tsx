import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import type { PageOption } from "@/lib/cms/pages.functions";
import type { SiteLink } from "@/lib/shared/content/schemas";
import { LinkKind, SitePageKind } from "@/lib/shared/enums";
import { linkKindLabels, sitePageKindLabels } from "@/lib/shared/labels";

const NONE = "none";

const pageLabel = (page: PageOption): string =>
  `${page.title || sitePageKindLabels[page.kind]} (${page.slug === "" ? "/" : `/${page.slug}`})`;

const blank = (kind: LinkKind): SiteLink => {
  if (kind === LinkKind.Url) return { kind, url: "https://" };
  if (kind === LinkKind.Whatsapp) return { kind, message: "" };
  if (kind === LinkKind.Email) return { kind };
  if (kind === LinkKind.Phone) return { kind };
  return { kind, pageId: "" } as SiteLink;
};

export function LinkField({
  id,
  label,
  value,
  pages,
  onChange,
}: {
  id: string;
  label: string;
  value: SiteLink | null;
  pages: PageOption[];
  onChange: (value: SiteLink | null) => void;
}) {
  const kindOptions = [
    { value: NONE, label: "Sem botão" },
    ...Object.values(LinkKind).map((kind) => ({ value: kind, label: linkKindLabels[kind] })),
  ];
  const pageOptions = (kind: LinkKind) =>
    pages
      .filter((page) => (kind === LinkKind.CaseStudy ? page.kind === SitePageKind.CaseStudy : true))
      .map((page) => ({ value: page.id, label: pageLabel(page) }));

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <SelectField
        id={`${id}-kind`}
        label={label}
        value={value?.kind ?? NONE}
        onValueChange={(next) => onChange(next === NONE ? null : blank(next as LinkKind))}
        options={kindOptions}
      />
      {value?.kind === LinkKind.Page || value?.kind === LinkKind.CaseStudy ? (
        <SelectField
          id={`${id}-page`}
          label="Página"
          value={value.pageId}
          onValueChange={(pageId) => onChange({ ...value, pageId })}
          options={pageOptions(value.kind)}
          placeholder="Escolha a página"
        />
      ) : null}
      {value?.kind === LinkKind.Anchor ? (
        <>
          <SelectField
            id={`${id}-anchor-page`}
            label="Página"
            value={value.pageId}
            onValueChange={(pageId) => onChange({ ...value, pageId, sectionId: "" })}
            options={pageOptions(value.kind)}
            placeholder="Escolha a página"
          />
          <SelectField
            id={`${id}-anchor-section`}
            label="Seção (precisa ter âncora)"
            value={value.sectionId}
            onValueChange={(sectionId) => onChange({ ...value, sectionId })}
            options={(pages.find((page) => page.id === value.pageId)?.anchors ?? []).map(
              (item) => ({
                value: item.sectionId,
                label: `#${item.anchor}`,
              }),
            )}
            placeholder="Escolha a seção"
          />
        </>
      ) : null}
      {value?.kind === LinkKind.Url ? (
        <TextField
          id={`${id}-url`}
          label="Endereço"
          value={value.url}
          onValueChange={(url) => onChange({ ...value, url })}
          maxLength={500}
          hint="Comece com https:// ou com /"
        />
      ) : null}
      {value?.kind === LinkKind.Whatsapp ? (
        <TextField
          id={`${id}-message`}
          label="Mensagem pronta"
          value={value.message}
          onValueChange={(message) => onChange({ ...value, message })}
          maxLength={300}
          hint="Use {{page}} para o nome da página."
        />
      ) : null}
      {value?.kind === LinkKind.Email ? (
        <TextField
          id={`${id}-subject`}
          label="Assunto"
          value={value.subject ?? ""}
          onValueChange={(subject) => onChange({ ...value, subject })}
          maxLength={150}
        />
      ) : null}
    </div>
  );
}
