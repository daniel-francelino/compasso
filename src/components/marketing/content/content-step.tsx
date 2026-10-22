import { Calendar, FileImage, Settings2, Type } from "lucide-react";
import { CaptionSection } from "@/components/marketing/content/caption-section";
import { ChannelRowsSection } from "@/components/marketing/content/channel-rows-section";
import { ContentSettingsSection } from "@/components/marketing/content/content-settings-section";
import { FileStrip } from "@/components/marketing/content/file-strip";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { ContentDraft, DraftRow } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import type { StageState } from "@/lib/marketing/content/stage-state";
import { mediaProblem } from "@/lib/shared/editorial/editorial";

export function ContentStep({
  draft,
  channels,
  assignees,
  zone,
  state,
  tab,
  onTab,
  editable,
  settingsDisabled,
  saving,
  canPublish,
  canCancelRow,
  errors,
  onPublishRow,
  onCancelRow,
}: {
  draft: ContentDraft;
  channels: ChannelRow[];
  assignees: { id: string; name: string }[];
  zone: string;
  state: StageState;
  tab: string;
  onTab: (tab: string) => void;
  editable: boolean;
  settingsDisabled: boolean;
  saving: boolean;
  canPublish: boolean;
  canCancelRow: boolean;
  errors: Record<string, string>;
  onPublishRow: (row: DraftRow) => void;
  onCancelRow: (row: DraftRow) => void;
}) {
  const { values, set } = draft;
  const formats = values.rows.map((row) => row.format);
  const fileProblem = mediaProblem(formats, values.files.length);
  return (
    <>
      <SectionCard title="3. Texto do post" icon={Type}>
        <CaptionSection
          draft={draft}
          channels={channels}
          active={tab}
          onActive={onTab}
          disabled={!editable || saving}
          errors={errors}
        />
      </SectionCard>
      <SectionCard title="4. Artes e mídias" icon={FileImage}>
        <FileStrip
          items={values.files}
          onChange={(items) => set("files", items)}
          brandId={values.brandId}
          formats={formats}
          disabled={!editable || saving || values.brandId === ""}
          error={errors["media"] ?? (values.files.length > 0 ? fileProblem : null) ?? undefined}
        />
      </SectionCard>
      <SectionCard title="5. Data e horário das publicações" icon={Calendar}>
        <ChannelRowsSection
          draft={draft}
          channels={channels}
          brandTimezone={zone}
          disabled={!editable || saving || state.planLocked}
          errors={errors}
          canPublish={canPublish}
          canCancel={canCancelRow}
          onPublish={onPublishRow}
          onCancelRow={onCancelRow}
        />
      </SectionCard>
      <SectionCard title="6. Configurações" icon={Settings2}>
        <ContentSettingsSection
          draft={draft}
          assignees={assignees}
          disabled={settingsDisabled}
          objectiveLocked={state.planLocked}
          errors={errors}
        />
      </SectionCard>
    </>
  );
}
