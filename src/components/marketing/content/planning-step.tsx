import { ClipboardList, Radio, Tag } from "lucide-react";
import { ChannelPicker } from "@/components/marketing/content/channel-picker";
import { ContentAssigneeField } from "@/components/marketing/content/content-assignee-field";
import { ContentTitleField } from "@/components/marketing/content/content-title-field";
import { PlanningFormats } from "@/components/marketing/content/planning-formats";
import { PlanSection } from "@/components/marketing/content/plan-section";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import type { StageState } from "@/lib/marketing/content/stage-state";
import type { BrandOption } from "@/lib/shared/brands/brand-options.functions";
import { StoredKey, writeStored } from "@/lib/shared/stored-keys";
import { cn } from "@/lib/shared/utils";

export function PlanningStep({
  draft,
  isNew,
  brands,
  channels,
  channelsLoading,
  selected,
  locked,
  assignees,
  state,
  editable,
  settingsDisabled,
  saving,
  errors,
  onToggleChannel,
}: {
  draft: ContentDraft;
  isNew: boolean;
  brands: BrandOption[] | undefined;
  channels: ChannelRow[];
  channelsLoading: boolean;
  selected: Set<string>;
  locked: Set<string>;
  assignees: { id: string; name: string }[];
  state: StageState;
  editable: boolean;
  settingsDisabled: boolean;
  saving: boolean;
  errors: Record<string, string>;
  onToggleChannel: (channelId: string) => void;
}) {
  const { values, set } = draft;
  const identity = (
    <SectionCard title="Identificação" icon={Tag}>
      <div className="grid gap-4 md:grid-cols-2">
        <ContentTitleField draft={draft} disabled={settingsDisabled} error={errors["title"]} />
        {isNew ? (
          <BrandSelect
            id="content-brand"
            required
            value={values.brandId}
            onValueChange={(value) => {
              set("brandId", value);
              writeStored(StoredKey.CalendarBrand, value);
              set("rows", []);
              set("assigneeId", null);
            }}
            placeholder="Escolha a marca"
            brands={brands}
            error={errors["brandId"]}
          />
        ) : null}
        <ContentAssigneeField
          draft={draft}
          assignees={assignees}
          disabled={settingsDisabled}
          error={errors["assigneeId"]}
        />
      </div>
    </SectionCard>
  );
  const channelsCard = (
    <SectionCard title="1. Selecione os canais" icon={Radio}>
      <ChannelPicker
        brandId={values.brandId}
        channels={channels}
        loading={channelsLoading}
        selected={selected}
        locked={locked}
        disabled={!editable || state.planLocked}
        onToggle={onToggleChannel}
        error={errors["channels"]}
      />
      <PlanningFormats
        draft={draft}
        channels={channels}
        disabled={!editable || state.planLocked}
        errors={errors}
      />
    </SectionCard>
  );
  return (
    <div className="space-y-6">
      {identity}
      <div className={cn("grid items-start gap-6", state.planRequired && "xl:grid-cols-2")}>
        <div className="space-y-6">{channelsCard}</div>
        {state.planRequired ? (
          <SectionCard
            title="2. Planejamento"
            icon={ClipboardList}
            tip={{
              label: "Sobre o planejamento",
              content:
                "Escreva o tema, a mensagem e a direção do texto para o cliente aprovar a ideia. Depois da aprovação, canais, formatos e datas ficam travados enquanto as artes são produzidas.",
            }}
          >
            <PlanSection
              draft={draft}
              disabled={!editable || saving || state.planLocked}
              errors={errors}
            />
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
