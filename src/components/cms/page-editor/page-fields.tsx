import { ImageField } from "@/components/cms/fields/image-field";
import { TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import type { DraftPage } from "@/lib/shared/content/schemas";

export function PageFields({
  draft,
  slug,
  slugLocked,
  canEdit,
  onDraft,
  onSlug,
}: {
  draft: DraftPage;
  slug: string;
  slugLocked: boolean;
  canEdit: boolean;
  onDraft: (draft: DraftPage) => void;
  onSlug: (slug: string) => void;
}) {
  const setSeo = (patch: Partial<DraftPage["seo"]>) =>
    onDraft({ ...draft, seo: { ...draft.seo, ...patch } });
  return (
    <div className="space-y-4">
      <TextField
        id="page-title"
        label="Título da página"
        value={draft.title}
        onValueChange={(title) => onDraft({ ...draft, title })}
        maxLength={120}
        disabled={!canEdit}
      />
      <TextField
        id="page-slug"
        label="Endereço"
        value={slug}
        onValueChange={onSlug}
        maxLength={120}
        disabled={slugLocked}
        hint={
          slugLocked
            ? "O endereço desta página não pode ser mudado."
            : "Letras minúsculas, números e hífens. Mudar o endereço de uma página no ar cria um redirecionamento."
        }
      />
      <TextField
        id="seo-title"
        label="Título para buscadores"
        value={draft.seo.title}
        onValueChange={(title) => setSeo({ title })}
        maxLength={70}
        counter
        disabled={!canEdit}
      />
      <TextAreaField
        id="seo-description"
        label="Descrição para buscadores"
        value={draft.seo.description}
        onValueChange={(description) => setSeo({ description })}
        maxLength={170}
        rows={3}
        disabled={!canEdit}
      />
      <ImageField
        id="seo-og"
        label="Imagem de compartilhamento"
        value={{ mediaVersionId: draft.seo.ogImage ?? null, alt: "", decorative: true }}
        onChange={(image) => setSeo({ ogImage: image.mediaVersionId })}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="seo-noindex"
          checked={draft.seo.noindex === true}
          disabled={!canEdit}
          onCheckedChange={(checked) => setSeo({ noindex: checked === true })}
        />
        <Label htmlFor="seo-noindex" className="font-normal">
          Não mostrar esta página nos buscadores
        </Label>
      </div>
    </div>
  );
}
