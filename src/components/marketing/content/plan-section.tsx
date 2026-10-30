import { CalendarDays, Plus, Shapes } from "lucide-react";
import { useRef, useState } from "react";
import { PlanEditor } from "@/components/marketing/content/plan-editor";
import { ContentTypeChip } from "@/components/shared/content/content-type-chip";
import { ContentTypeSheet } from "@/components/shared/content/content-type-sheet";
import { IconButton } from "@/components/shared/admin/icon-button";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { MultiSelectField } from "@/components/shared/admin/multi-select-field";
import { PropertyRow, propertyControlClass } from "@/components/shared/admin/property-row";
import { DatePickerField } from "@/components/shared/ui/date-picker-field";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import type { ContentTypeRow } from "@/lib/shared/content-types/content-types.functions";

export function PlanTypesRow({
  draft,
  disabled,
  typeOptions,
  error,
}: {
  draft: ContentDraft;
  disabled: boolean;
  typeOptions: ContentTypeRow[];
  error: string | undefined;
}) {
  const { values } = draft;
  const auth = useAuth();
  const [creating, setCreating] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const canCreate = can(auth, Action.Content.ManageTypes) && !disabled;
  return (
    <PropertyRow
      icon={Shapes}
      label="Tipo de conteúdo"
      tip={{
        label: "Sobre os tipos",
        content:
          "Diga para que serve este conteúdo. Dá para escolher vários. Quem administra a conta cria e arquiva tipos em Configurações.",
      }}
    >
      <MultiSelectField
        id="content-types"
        label="Tipo de conteúdo"
        hideLabel
        triggerClassName={propertyControlClass}
        options={typeOptions.map((type) => ({
          value: type.id,
          label: type.archived ? `${type.name} (arquivado)` : type.name,
          display: <ContentTypeChip type={type} />,
        }))}
        value={values.typeIds}
        onValueChange={(ids) => draft.set("typeIds", ids)}
        placeholder="Escolha os tipos"
        searchLabel="Buscar tipo"
        emptyText="Nenhum tipo encontrado."
        disabled={disabled}
        error={error}
        trailing={
          canCreate ? (
            <IconButton
              variant="outline"
              label="Novo tipo de conteúdo"
              icon={Plus}
              onClick={() => {
                opener.current = document.activeElement as HTMLElement | null;
                setCreating(true);
              }}
            />
          ) : null
        }
      />
      <ContentTypeSheet
        open={creating}
        onClose={() => setCreating(false)}
        restoreFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
        onCreated={(typeId) => draft.set("typeIds", [...values.typeIds, typeId])}
      />
    </PropertyRow>
  );
}

export function PlanDateRow({
  draft,
  disabled,
  onPublishDateChange,
  error,
}: {
  draft: ContentDraft;
  disabled: boolean;
  onPublishDateChange: (day: string | null) => void;
  error: string | undefined;
}) {
  return (
    <PropertyRow
      stacked
      icon={CalendarDays}
      label="Data de publicação"
      tip={{
        label: "Sobre a data de publicação",
        content:
          "Todos os canais e formatos começam nesta data e cada um pode ser mudado depois. O horário de cada publicação continua separado.",
      }}
    >
      <DatePickerField
        id="content-publish-date"
        label="Data de publicação"
        hideLabel
        hideIcon
        triggerClassName={propertyControlClass}
        value={draft.values.publishDate ?? ""}
        onChange={(value) => onPublishDateChange(value === "" ? null : value)}
        disabled={disabled}
        clearable
        error={error}
      />
    </PropertyRow>
  );
}

export function PlanBody({
  draft,
  disabled,
  tip,
  errors,
}: {
  draft: ContentDraft;
  disabled: boolean;
  tip: string;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <h2 className="font-display text-xl font-semibold">Briefing</h2>
        <InfoTip label="Sobre o briefing">{tip}</InfoTip>
      </div>
      <PlanEditor
        draft={draft}
        brandId={draft.values.brandId}
        disabled={disabled}
        error={errors["planSummary"] ?? errors["planMedia"]}
      />
    </div>
  );
}
