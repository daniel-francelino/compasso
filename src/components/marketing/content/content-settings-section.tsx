import {
  CircleHelp,
  Eye,
  Heart,
  MousePointerClick,
  ShoppingCart,
  Target,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { RichTextEditor } from "@/components/shared/admin/rich-text-editor";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { ContentObjective } from "@/lib/shared/enums";
import { contentObjectiveLabels } from "@/lib/shared/labels";

const NONE = "none";

export function ContentSettingsSection({
  draft,
  assignees,
  disabled,
  objectiveLocked = false,
  showBriefing = false,
  errors,
}: {
  draft: ContentDraft;
  assignees: { id: string; name: string }[];
  disabled: boolean;
  objectiveLocked?: boolean;
  showBriefing?: boolean;
  errors: Record<string, string>;
}) {
  const { values, set } = draft;
  if (showBriefing) {
    return (
      <RichTextEditor
        id="content-briefing"
        label="Briefing (interno)"
        value={values.briefing}
        disabled={disabled}
        onValueChange={(value) => set("briefing", value)}
        error={errors["briefing"]}
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="content-objective-kind"
          label="Objetivo"
          value={values.objectiveKind ?? NONE}
          disabled={disabled || objectiveLocked}
          onValueChange={(value) => {
            const match = Object.values(ContentObjective).find((objective) => objective === value);
            set("objectiveKind", match ?? null);
          }}
          options={[
            {
              value: NONE,
              label: "Sem objetivo definido",
              icon: <CircleHelp aria-hidden="true" className="size-4" />,
            },
            ...Object.values(ContentObjective).map((objective) => ({
              value: objective,
              label: contentObjectiveLabels[objective],
              icon: {
                [ContentObjective.Awareness]: <Eye aria-hidden="true" className="size-4" />,
                [ContentObjective.Engagement]: <Heart aria-hidden="true" className="size-4" />,
                [ContentObjective.Traffic]: (
                  <MousePointerClick aria-hidden="true" className="size-4" />
                ),
                [ContentObjective.Leads]: <UserRoundPlus aria-hidden="true" className="size-4" />,
                [ContentObjective.Sales]: <ShoppingCart aria-hidden="true" className="size-4" />,
                [ContentObjective.Community]: <UsersRound aria-hidden="true" className="size-4" />,
                [ContentObjective.Other]: <Target aria-hidden="true" className="size-4" />,
              }[objective],
            })),
          ]}
          error={errors["objectiveKind"]}
        />
        <TextField
          id="content-objective"
          label="Detalhe do objetivo"
          value={values.objective}
          disabled={disabled || objectiveLocked}
          onValueChange={(value) => set("objective", value)}
          maxLength={2000}
          error={errors["objective"]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="content-assignee"
          label="Responsável"
          value={values.assigneeId ?? NONE}
          disabled={disabled || values.brandId === ""}
          emptyText={assignees.length === 0 ? "Nenhuma pessoa disponível" : undefined}
          onValueChange={(value) => set("assigneeId", value === NONE ? null : value)}
          options={[
            { value: NONE, label: "Sem responsável" },
            ...assignees.map((person) => ({ value: person.id, label: person.name })),
          ]}
          error={errors["assigneeId"]}
        />
        <DatePickerField
          id="content-due"
          label="Prazo de produção"
          value={values.productionDueDate ?? ""}
          onChange={(value) => set("productionDueDate", value === "" ? null : value)}
          disabled={disabled}
          clearable
          error={errors["productionDueDate"]}
        />
      </div>
    </div>
  );
}
