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
import type { ContentTypeRow } from "@/lib/shared/content-types/content-types.functions";
import { StoredKey, writeStored } from "@/lib/shared/stored-keys";

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
  typeOptions,
  onPublishDateChange,
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
  typeOptions: ContentTypeRow[];
  onPublishDateChange: (day: string | null) => void;
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
    <SectionCard title="Selecione os canais" icon={Radio}>
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <SectionCard
        title="Briefing"
        icon={ClipboardList}
        tip={{
          label: "Sobre o briefing",
          content: state.planRequired
            ? "Reúna a ideia do conteúdo. O cliente aprova o planejamento por aqui. Depois da aprovação, a data, os canais e os formatos ficam travados enquanto as artes são produzidas."
            : "Reúna a ideia do conteúdo para quem vai produzir. Depois da aprovação, a data, os canais e os formatos ficam travados.",
        }}
      >
        <PlanSection
          draft={draft}
          disabled={!editable || saving || state.planLocked}
          typesDisabled={settingsDisabled}
          typeOptions={typeOptions}
          onPublishDateChange={onPublishDateChange}
          errors={errors}
        />
      </SectionCard>
      <div className="space-y-6">
        {identity}
        {channelsCard}
      </div>
    </div>
  );
}
