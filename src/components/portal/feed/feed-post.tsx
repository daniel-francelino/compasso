import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useRef, useState } from "react";
import { PortalApprovalDialog } from "@/components/portal/approvals/portal-approval-dialog";
import { PlanRequestSummary } from "@/components/portal/approvals/plan-request-summary";
import { ResponseDeadlineBadge } from "@/components/portal/approvals/response-deadline-badge";
import { FeedActions } from "@/components/portal/feed/feed-actions";
import { FeedComments } from "@/components/portal/feed/feed-comments";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { RequestStatusBadge } from "@/components/shared/content/status-badges";
import { InstagramPost } from "@/components/shared/preview/instagram/instagram-post";
import { InstagramPostHeader } from "@/components/shared/preview/instagram/instagram-post-header";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { Button } from "@/components/shared/ui/button";
import { useDecisionDraft } from "@/hooks/portal/use-decision-draft";
import { usePortalPreviewUrls } from "@/hooks/portal/use-portal-preview-urls";
import { getPortalBrand } from "@/lib/portal/approvals/portal.functions";
import { FeedPostKind, channelCaption, feedPostKind } from "@/lib/portal/approvals/feed";
import type { PortalChannel, PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalStage, type ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { approvalStageLabels, contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { kindOfMime } from "@/lib/shared/media/limits";
import { mediaUnavailable } from "@/lib/shared/preview/media-urls";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const DEFAULT_ZONE = "America/Sao_Paulo";
const CHANGES_HINT = "Escreva o que precisa mudar para solicitar a alteração.";

const byPlannedDate = (a: PortalChannel, b: PortalChannel): number => {
  if (a.plannedAt === b.plannedAt) return 0;
  if (a.plannedAt === null) return 1;
  if (b.plannedAt === null) return -1;
  return a.plannedAt.localeCompare(b.plannedAt);
};

const toPreviewMedia = (
  request: PortalRequest,
  urls: Record<string, string> | undefined,
): PreviewMedia[] =>
  request.media.map((item) => ({
    versionId: item.versionId,
    kind: kindOfMime(item.mimeType),
    altText: item.altText,
    width: item.width,
    height: item.height,
    url: urls?.[item.versionId] ?? null,
    unavailable: mediaUnavailable(urls, item.versionId),
  }));

function PublicationDate({ request, channel }: { request: PortalRequest; channel: PortalChannel }) {
  if (!channel.plannedAt) return <>Publicação sem data definida</>;
  const zone = channel.plannedTimezone ?? request.brandTimezone ?? DEFAULT_ZONE;
  return (
    <span className="inline-flex items-center gap-1">
      Publicação: {formatInZone(channel.plannedAt, zone)}
      <InfoTip label={`Fuso horário: ${zone}`}>Fuso horário: {zone}</InfoTip>
    </span>
  );
}

export function FeedPost({ request, brandId }: { request: PortalRequest; brandId: string }) {
  const [dialog, setDialog] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [hint, setHint] = useState<string | undefined>();
  const draft = useDecisionDraft(request.id);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const brand = useQuery({
    queryKey: QueryKey.Portal.brand(brandId),
    queryFn: async () => unwrapResult(await getPortalBrand({ data: { brandId } })).brand,
  });
  const urls = usePortalPreviewUrls([request]);
  const kind = feedPostKind(request);
  const rows = [...request.channels].sort(byPlannedDate);
  const [activeRow, setActiveRow] = useState(rows[0]?.rowId ?? "");
  const channel = rows.find((row) => row.rowId === activeRow) ?? rows[0];
  const logo = brand.data?.logoUrl ?? null;

  const needText = () => {
    setHint(CHANGES_HINT);
    setCommentsOpen(true);
    fieldRef.current?.focus();
  };
  const changeText = (value: string) => {
    setHint(undefined);
    draft.change(value);
  };

  const actions = (
    <FeedActions
      request={request}
      draft={draft}
      onToggleComments={() => setCommentsOpen((value) => !value)}
      onNeedText={needText}
    />
  );
  const footer = (
    <FeedComments
      request={request}
      open={commentsOpen}
      onOpenChange={setCommentsOpen}
      draft={draft}
      fieldRef={fieldRef}
      hint={hint}
      onTextChange={changeText}
    />
  );

  const body = () => {
    if (channel === undefined) return null;
    const subtitle = <PublicationDate request={request} channel={channel} />;
    if (kind === FeedPostKind.Plan) {
      return (
        <div>
          <InstagramPostHeader
            profileName={channel.profileName}
            brandLogoUrl={logo}
            subtitle={subtitle}
          />
          <div className="px-3 pb-3">
            <PlanRequestSummary request={request} urls={urls.data} />
          </div>
          {actions}
          {footer}
        </div>
      );
    }
    const media = kind === FeedPostKind.CaptionOnly ? [] : toPreviewMedia(request, urls.data);
    const caption = channelCaption(request, channel);
    if (channel.platform === Platform.Instagram) {
      return (
        <InstagramPost
          format={channel.format as ContentFormat}
          profileName={channel.profileName}
          brandLogoUrl={logo}
          subtitle={subtitle}
          media={media}
          caption={caption}
          callToAction={null}
          actions={actions}
          footer={footer}
          onOpenMedia={() => setDialog(true)}
        />
      );
    }
    return (
      <div className="space-y-2 pb-1">
        <ChannelPreview
          platform={channel.platform as Platform}
          profileName={channel.profileName}
          brandLogoUrl={logo}
          format={channel.format as ContentFormat}
          caption={caption}
          callToAction={null}
          media={media}
          showMediaPlaceholder={kind === FeedPostKind.CaptionOnly}
        />
        {actions}
        {footer}
      </div>
    );
  };

  return (
    <SectionCard
      as="article"
      padding="none"
      className="mx-auto w-full max-w-lg overflow-hidden"
      aria-label={`${request.title} · ${channel ? platformLabels[channel.platform as Platform] : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={() => setDialog(true)}
          className="min-h-11 rounded-md py-2 text-left font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {request.title}
        </button>
        <span className="flex flex-wrap items-center gap-1.5">
          <ResponseDeadlineBadge request={request} />
          {request.stage === ApprovalStage.Plan ? (
            <StatusBadge tone="neutral" icon={ClipboardList}>
              {approvalStageLabels[request.stage]}
            </StatusBadge>
          ) : null}
          <RequestStatusBadge status={request.status} />
        </span>
      </div>
      {rows.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 px-3 pt-1" role="group" aria-label="Canais">
          {rows.map((row) => (
            <Button
              key={row.rowId}
              type="button"
              size="sm"
              className="min-h-11"
              variant={row.rowId === channel?.rowId ? "default" : "outline"}
              aria-pressed={row.rowId === channel?.rowId}
              onClick={() => setActiveRow(row.rowId)}
            >
              {platformLabels[row.platform as Platform]} ·{" "}
              {contentFormatLabels[row.format as ContentFormat]}
            </Button>
          ))}
        </div>
      ) : null}
      {body()}
      {dialog ? (
        <PortalApprovalDialog
          brandId={brandId}
          requestId={request.id}
          onClose={() => setDialog(false)}
        />
      ) : null}
    </SectionCard>
  );
}
