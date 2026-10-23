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
import { SelectField } from "@/components/shared/admin/form-fields";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { ContentObjective } from "@/lib/shared/enums";
import { contentObjectiveLabels } from "@/lib/shared/labels";

const NONE = "none";

const objectiveIcons = {
  [ContentObjective.Awareness]: <Eye aria-hidden="true" className="size-4" />,
  [ContentObjective.Engagement]: <Heart aria-hidden="true" className="size-4" />,
  [ContentObjective.Traffic]: <MousePointerClick aria-hidden="true" className="size-4" />,
  [ContentObjective.Leads]: <UserRoundPlus aria-hidden="true" className="size-4" />,
  [ContentObjective.Sales]: <ShoppingCart aria-hidden="true" className="size-4" />,
  [ContentObjective.Community]: <UsersRound aria-hidden="true" className="size-4" />,
  [ContentObjective.Other]: <Target aria-hidden="true" className="size-4" />,
};

export function ContentSettingsSection({
  draft,
  disabled,
  objectiveLocked,
  errors,
}: {
  draft: ContentDraft;
  disabled: boolean;
  objectiveLocked: boolean;
  errors: Record<string, string>;
}) {
  const { values, set } = draft;
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
            icon: objectiveIcons[objective],
          })),
        ]}
        error={errors["objectiveKind"]}
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
  );
}
