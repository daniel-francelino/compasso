import { ContentTypeChip } from "@/components/shared/content/content-type-chip";
import { FieldGroup } from "@/components/shared/admin/field-group";
import { TextField } from "@/components/shared/admin/form-fields";
import { CONTENT_TYPE_EMOJI_MAX, CONTENT_TYPE_NAME_MAX } from "@/lib/shared/content-types/schemas";
import type { ContentTypeDraft } from "@/lib/shared/content-types/draft";
import { ContentTypeColor } from "@/lib/shared/enums";
import { contentTypeColorLabels } from "@/lib/shared/labels";
import { cn } from "@/lib/shared/utils";

export function ContentTypeFields({
  draft,
  onChange,
  errors,
}: {
  draft: ContentTypeDraft;
  onChange: (draft: ContentTypeDraft) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <TextField
        id="content-type-name"
        label="Nome"
        required
        value={draft.name}
        maxLength={CONTENT_TYPE_NAME_MAX}
        onValueChange={(name) => onChange({ ...draft, name })}
        error={errors["name"]}
      />
      <TextField
        id="content-type-emoji"
        label="Emoji"
        value={draft.emoji}
        maxLength={CONTENT_TYPE_EMOJI_MAX}
        placeholder="Opcional"
        hint="Aparece antes do nome. Deixe em branco para usar só a cor."
        onValueChange={(emoji) => onChange({ ...draft, emoji })}
        error={errors["emoji"]}
      />
      <FieldGroup legend="Cor" gap="sm">
        <div className="flex flex-wrap gap-2">
          {Object.values(ContentTypeColor).map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={draft.color === color}
              aria-label={contentTypeColorLabels[color]}
              onClick={() => onChange({ ...draft, color })}
              className={cn(
                "cursor-pointer rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                draft.color === color && "ring-2 ring-primary",
              )}
            >
              <ContentTypeChip
                type={{ name: contentTypeColorLabels[color], color, emoji: null }}
                className="min-h-8"
              />
            </button>
          ))}
        </div>
        {errors["color"] ? <p className="text-xs text-destructive">{errors["color"]}</p> : null}
      </FieldGroup>
    </>
  );
}
