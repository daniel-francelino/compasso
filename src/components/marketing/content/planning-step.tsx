import { ClipboardList, Radio, Settings2 } from "lucide-react";
import { ChannelPicker } from "@/components/marketing/content/channel-picker";
import { ContentSettingsSection } from "@/components/marketing/content/content-settings-section";
import { PlanSection } from "@/components/marketing/content/plan-section";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import type { StageState } from "@/lib/marketing/content/stage-state";
import type { BrandOption } from "@/lib/shared/brands/brand-options.functions";
import { StoredKey, writeStored } from "@/lib/shared/stored-keys";

export function PlanningStep({
  draft,
  isNew,
  brands,
  channels,
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
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      {isNew ? (
        <SectionCard title="Marca" icon={Radio}>
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
        </SectionCard>
      ) : null}
      <SectionCard title="1. Selecione os canais" icon={Radio}>
        <ChannelPicker
          brandId={values.brandId}
          channels={channels}
          selected={selected}
          locked={locked}
          disabled={!editable || state.planLocked}
          onToggle={onToggleChannel}
          error={errors["channels"]}
        />
      </SectionCard>
      {state.planRequired ? (
        <SectionCard
          title="2. Planejamento"
          icon={ClipboardList}
          tip={{
            label: "Sobre o planejamento",
            content:
              "O cliente aprova primeiro o planejamento. Depois da aprovação, canais, formatos e datas ficam travados e começam as artes.",
          }}
        >
          <PlanSection
            draft={draft}
            disabled={!editable || saving || state.planLocked}
            errors={errors}
          />
        </SectionCard>
      ) : null}
      <SectionCard title="Organização" icon={Settings2}>
        <ContentSettingsSection
          draft={draft}
          assignees={assignees}
          disabled={settingsDisabled}
          objectiveLocked={state.planLocked}
          errors={errors}
        />
      </SectionCard>
    </div>
  );
}
