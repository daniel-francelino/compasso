import { Building2, Layers, Radio, UserRound } from "lucide-react";
import { ChannelPicker } from "@/components/marketing/content/channel-picker";
import { ContentAssigneeField } from "@/components/marketing/content/content-assignee-field";
import { ContentTitleField } from "@/components/marketing/content/content-title-field";
import { PlanningFormats } from "@/components/marketing/content/planning-formats";
import { PlanBody, PlanDateRow, PlanTypesRow } from "@/components/marketing/content/plan-section";
import { BrandSelect } from "@/components/shared/admin/brand-select";
import { PropertyRow, propertyControlClass } from "@/components/shared/admin/property-row";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
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
  editable: boolean;
  settingsDisabled: boolean;
  saving: boolean;
  errors: Record<string, string>;
  typeOptions: ContentTypeRow[];
  onPublishDateChange: (day: string | null) => void;
  onToggleChannel: (channelId: string) => void;
}) {
  const { values, set } = draft;
  const planDisabled = !editable || saving;
  const bodyTip =
    "Reúna a ideia do conteúdo para quem vai produzir. Você pode enviar para aprovação do cliente quando quiser, quantas vezes precisar.";
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <ContentTitleField draft={draft} disabled={settingsDisabled} error={errors["title"]} />
      <div className="space-y-2 border-y border-border py-3">
        <div className="grid gap-x-4 gap-y-3 grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))]">
          {isNew ? (
            <PropertyRow stacked icon={Building2} label="Marca">
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
          <PropertyRow stacked icon={UserRound} label="Responsável">
            <ContentAssigneeField
              draft={draft}
              assignees={assignees}
              disabled={settingsDisabled}
              error={errors["assigneeId"]}
            />
          </PropertyRow>
          <PlanDateRow
            draft={draft}
            disabled={planDisabled}
            onPublishDateChange={onPublishDateChange}
            error={errors["publishDate"]}
          />
        </div>
        <PlanTypesRow
          draft={draft}
          disabled={settingsDisabled}
          typeOptions={typeOptions}
          error={errors["typeIds"]}
        />
        <PropertyRow icon={Radio} label="Canais">
          <div className="py-1">
            <ChannelPicker
              brandId={values.brandId}
              channels={channels}
              loading={channelsLoading}
              selected={selected}
              locked={locked}
              disabled={!editable}
              onToggle={onToggleChannel}
              error={errors["channels"]}
            />
          </div>
        </PropertyRow>
        {values.rows.length > 0 ? (
          <PropertyRow icon={Layers} label="Formatos">
            <div className="py-1">
              <PlanningFormats
                draft={draft}
                channels={channels}
                disabled={!editable}
                errors={errors}
              />
            </div>
          </PropertyRow>
        ) : null}
      </div>
      <PlanBody draft={draft} disabled={planDisabled} tip={bodyTip} errors={errors} />
    </div>
  );
}
