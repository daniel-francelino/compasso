import { Plus, Trash2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { type BrandDetail, saveBrand } from "@/lib/marketing/brands/brands.functions";
import { saveBrandSchema } from "@/lib/marketing/brands/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";

type ColorDraft = { name: string; hex: string };

function IdentityForm({ brand, canEdit }: { brand: BrandDetail; canEdit: boolean }) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [description, setDescription] = useState(brand.description ?? "");
  const [audience, setAudience] = useState(brand.targetAudience ?? "");
  const [tone, setTone] = useState(brand.toneOfVoice ?? "");
  const [objectives, setObjectives] = useState(brand.objectives ?? "");
  const [references, setReferences] = useState(brand.referencesNotes ?? "");
  const [colors, setColors] = useState<ColorDraft[]>(brand.visualIdentity.colors);
  const [fonts, setFonts] = useState(brand.visualIdentity.fonts.join(", "));
  const [guidelines, setGuidelines] = useState(brand.visualIdentity.guidelinesUrl);

  const dirty =
    description !== (brand.description ?? "") ||
    audience !== (brand.targetAudience ?? "") ||
    tone !== (brand.toneOfVoice ?? "") ||
    objectives !== (brand.objectives ?? "") ||
    references !== (brand.referencesNotes ?? "") ||
    JSON.stringify(colors) !== JSON.stringify(brand.visualIdentity.colors) ||
    fonts !== brand.visualIdentity.fonts.join(", ") ||
    guidelines !== brand.visualIdentity.guidelinesUrl;
  useUnsavedChanges(dirty && !busy);

  const updateColor = (index: number, patch: Partial<ColorDraft>) =>
    setColors((current) =>
      current.map((color, position) => (position === index ? { ...color, ...patch } : color)),
    );

  return (
    <SectionCard
      as="form"
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          saveBrandSchema,
          {
            id: brand.id,
            clientId: brand.clientId,
            name: brand.name,
            timezone: brand.timezone,
            expectedVersion: brand.version,
            description,
            targetAudience: audience,
            toneOfVoice: tone,
            objectives,
            referencesNotes: references,
            visualIdentity: {
              colors,
              fonts: fonts
                .split(",")
                .map((font) => font.trim())
                .filter((font) => font !== ""),
              guidelinesUrl: guidelines,
            },
          },
          (data) => saveBrand({ data }),
          () => {
            toast.success("Identidade salva.");
          },
        );
      }}
      className="max-w-3xl space-y-4"
    >
      <TextAreaField
        id="brand-description"
        label="Sobre a marca"
        value={description}
        onValueChange={setDescription}
        maxLength={2000}
        rows={3}
        disabled={!canEdit}
      />
      <TextAreaField
        id="brand-audience"
        label="Público"
        value={audience}
        onValueChange={setAudience}
        maxLength={2000}
        rows={3}
        disabled={!canEdit}
      />
      <TextAreaField
        id="brand-tone"
        label="Tom de voz"
        value={tone}
        onValueChange={setTone}
        maxLength={2000}
        rows={3}
        disabled={!canEdit}
      />
      <TextAreaField
        id="brand-objectives"
        label="Objetivos"
        value={objectives}
        onValueChange={setObjectives}
        maxLength={2000}
        rows={3}
        disabled={!canEdit}
      />
      <TextAreaField
        id="brand-references"
        label="Referências"
        value={references}
        onValueChange={setReferences}
        maxLength={4000}
        rows={3}
        disabled={!canEdit}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">Cores da marca</p>
        <p className="text-xs text-muted-foreground">
          Servem de referência para a equipe. Não alteram as cores do Compasso.
        </p>
        {colors.map((color, index) => (
          <div key={index} className="flex items-end gap-2">
            <span
              className="mb-2 size-6 shrink-0 rounded-full border border-border"
              style={{
                backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color.hex) ? color.hex : undefined,
              }}
              aria-hidden="true"
            />
            <TextField
              id={`color-name-${index}`}
              label="Nome"
              value={color.name}
              onValueChange={(value) => updateColor(index, { name: value })}
              disabled={!canEdit}
              maxLength={40}
            />
            <TextField
              id={`color-hex-${index}`}
              label="Valor (#RRGGBB)"
              value={color.hex}
              onValueChange={(value) => updateColor(index, { hex: value })}
              disabled={!canEdit}
              maxLength={7}
            />
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Remover cor ${color.name}`}
                onClick={() =>
                  setColors((current) => current.filter((_, position) => position !== index))
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        ))}
        {canEdit && colors.length < 12 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setColors((current) => [...current, { name: "", hex: "" }])}
          >
            <Plus aria-hidden="true" /> Adicionar cor
          </Button>
        ) : null}
        {errors["visualIdentity"] ? (
          <p className="text-xs text-destructive">{errors["visualIdentity"]}</p>
        ) : null}
      </div>

      <TextField
        id="brand-fonts"
        label="Fontes"
        value={fonts}
        onValueChange={setFonts}
        disabled={!canEdit}
        hint="Separe por vírgula."
      />
      <TextField
        id="brand-guidelines"
        label="Link do manual da marca"
        value={guidelines}
        onValueChange={setGuidelines}
        disabled={!canEdit}
        placeholder="https://"
      />
      <FormError message={error} />
      {canEdit ? (
        <Button type="submit" loading={busy} disabled={busy || !dirty}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
      ) : null}
    </SectionCard>
  );
}

export function BrandIdentityTab({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const query = useBrand(brandId);
  if (!query.data) return <PageSkeleton rows={3} />;
  return (
    <IdentityForm
      key={query.data.version}
      brand={query.data}
      canEdit={can(auth, Action.Brands.Update) && !query.data.archived}
    />
  );
}
