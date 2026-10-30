import { Calendar, FileImage, Type } from "lucide-react";
import { CaptionSection } from "@/components/marketing/content/caption-section";
import { ChannelRowsSection } from "@/components/marketing/content/channel-rows-section";
import { FileStrip } from "@/components/marketing/content/file-strip";
import { PublishAutomationSection } from "@/components/marketing/content/publish-automation-section";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { ContentDraft, DraftRow } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import { mediaProblem } from "@/lib/shared/editorial/editorial";

export function ContentStep({
  draft,
  channels,
  zone,
  tab,
  onTab,
  editable,
  saving,
  canPublish,
  canCancelRow,
  itemId,
  canAutomate,
  errors,
  onPublishRow,
  onCancelRow,
}: {
  draft: ContentDraft;
  channels: ChannelRow[];
  zone: string;
  tab: string;
  onTab: (tab: string) => void;
  editable: boolean;
  saving: boolean;
  canPublish: boolean;
  canCancelRow: boolean;
  itemId: string | undefined;
  canAutomate: boolean;
  errors: Record<string, string>;
  onPublishRow: (row: DraftRow) => void;
  onCancelRow: (row: DraftRow) => void;
}) {
  const { values, set } = draft;
  const formats = values.rows.map((row) => row.format);
  const fileProblem = mediaProblem(formats, values.files.length);
  return (
    <>
      <SectionCard title="Texto do post" icon={Type}>
        <CaptionSection
          draft={draft}
          channels={channels}
          active={tab}
          onActive={onTab}
          disabled={!editable || saving}
          errors={errors}
        />
      </SectionCard>
      <SectionCard title="Artes e mídias" icon={FileImage}>
        <FileStrip
          items={values.files}
          onChange={(items) => set("files", items)}
          brandId={values.brandId}
          formats={formats}
          disabled={!editable || saving || values.brandId === ""}
          error={errors["media"] ?? (values.files.length > 0 ? fileProblem : null) ?? undefined}
        />
      </SectionCard>
      <SectionCard title="Programação das publicações" icon={Calendar}>
        <ChannelRowsSection
          draft={draft}
          channels={channels}
          brandTimezone={zone}
          disabled={!editable || saving}
          errors={errors}
          canPublish={canPublish}
          canCancel={canCancelRow}
          onPublish={onPublishRow}
          onCancelRow={onCancelRow}
        />
      </SectionCard>
      {itemId === undefined ? null : (
        <PublishAutomationSection
          itemId={itemId}
          rows={values.rows}
          channels={channels}
          zone={zone}
          canManage={canAutomate}
        />
      )}
    </>
  );
}
