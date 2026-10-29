import { Building2, Radio, UserRound } from "lucide-react";
import { ChannelPicker } from "@/components/marketing/content/channel-picker";
import { ContentAssigneeField } from "@/components/marketing/content/content-assignee-field";
import { ContentTitleField } from "@/components/marketing/content/content-title-field";
import { PlanningFormats } from "@/components/marketing/content/planning-formats";
import { PlanBody, PlanDateRow, PlanTypesRow } from "@/components/marketing/content/plan-section";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { PropertyRow, propertyControlClass } from "@/components/shared/admin/property-row";
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
  const planDisabled = !editable || saving || state.planLocked;
  const bodyTip = state.planRequired
    ? "Reúna a ideia do conteúdo. O cliente aprova o planejamento por aqui. Depois da aprovação, a data, os canais e os formatos ficam travados enquanto as artes são produzidas."
    : "Reúna a ideia do conteúdo para quem vai produzir. Depois da aprovação, a data, os canais e os formatos ficam travados.";
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <ContentTitleField draft={draft} disabled={settingsDisabled} error={errors["title"]} />
      <div className="space-y-0.5 border-y border-border py-2">
        {isNew ? (
          <PropertyRow icon={Building2} label="Marca">
            <BrandSelect
              id="content-brand"
              label="Marca"
              hideLabel
              triggerClassName={propertyControlClass}
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
          </PropertyRow>
        ) : null}
        <PropertyRow icon={UserRound} label="Responsável">
          <ContentAssigneeField
            draft={draft}
            assignees={assignees}
            disabled={settingsDisabled}
            error={errors["assigneeId"]}
          />
        </PropertyRow>
        <PlanTypesRow
          draft={draft}
          disabled={settingsDisabled}
          typeOptions={typeOptions}
          error={errors["typeIds"]}
        />
        <PlanDateRow
          draft={draft}
          disabled={planDisabled}
          onPublishDateChange={onPublishDateChange}
          error={errors["publishDate"]}
        />
        <PropertyRow icon={Radio} label="Canais">
          <div className="space-y-4 py-1">
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
          </div>
        </PropertyRow>
      </div>
      <PlanBody draft={draft} disabled={planDisabled} tip={bodyTip} errors={errors} />
    </div>
  );
}
