import { SectionCard } from "@/components/shared/admin/section-card";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import type { StageState } from "@/lib/marketing/content/stage-state";
import { ApprovalStage } from "@/lib/shared/enums";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { mediaUnavailable } from "@/lib/shared/preview/media-urls";

export function EditorPreview({
  draft,
  channels,
  tab,
  state,
  brandLogoUrl,
}: {
  draft: ContentDraft;
  channels: ChannelRow[];
  tab: string;
  state: StageState;
  brandLogoUrl: string | null;
}) {
  const { values } = draft;
  const files = state.stage === ApprovalStage.Plan ? values.planFiles : values.files;
  const urls = useSignedUrls(
    files.map((file) => file.mediaVersionId),
    MediaVariant.Display,
  );
  const row = values.rows.find((candidate) => candidate.key === tab) ?? values.rows[0];
  const channel = channels.find((candidate) => candidate.id === row?.channelId);
  if (row === undefined || channel === undefined) {
    return (
      <SectionCard title="Pré-visualização">
        <p className="text-sm text-muted-foreground">
          Escolha um canal e escreva o texto para ver como o post vai aparecer.
        </p>
      </SectionCard>
    );
  }
  return (
    <ChannelPreview
      platform={channel.platform}
      profileName={channel.profileName}
      format={row.format}
      caption={row.caption === "" ? values.caption : row.caption}
      callToAction={values.callToAction === "" ? null : values.callToAction}
      brandLogoUrl={brandLogoUrl}
      showCounter
      media={files.map((file) => ({
        versionId: file.mediaVersionId,
        kind: file.kind,
        altText: file.altText === "" ? null : file.altText,
        url: urls.data?.[file.mediaVersionId] ?? null,
        unavailable: mediaUnavailable(urls.data, file.mediaVersionId),
      }))}
    />
  );
}
