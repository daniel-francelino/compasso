import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { getPortalApproval, signPortalPreviewMedia } from "@/lib/portal/approvals/portal.functions";
import type { PortalApproval } from "@/lib/portal/approvals/types";
import type { GridItem } from "@/lib/shared/calendar/grid-item";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { approvalRequestStatusLabels } from "@/lib/shared/labels";
import { kindOfMime } from "@/lib/shared/media/limits";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const closeDelay = 160;

export function PortalCalendarEntryPreview({
  item,
  children,
}: {
  item: GridItem;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = item.key.split(":")[0] ?? item.key;
  const approval = useQuery({
    queryKey: QueryKey.Portal.approval(requestId),
    queryFn: async () =>
      unwrapResult(await getPortalApproval({ data: { id: requestId } })).approval,
    enabled: open,
    staleTime: 60_000,
  });
  const mediaUrls = useQuery({
    queryKey: QueryKey.Portal.previewUrls([
      {
        revisionId: approval.data?.revisionId ?? "",
        versionIds: approval.data?.media.map((media) => media.versionId) ?? [],
      },
    ]),
    queryFn: async () =>
      unwrapResult(
        await signPortalPreviewMedia({
          data: {
            requests: [
              {
                revisionId: approval.data?.revisionId ?? "",
                versionIds: approval.data?.media.map((media) => media.versionId) ?? [],
              },
            ],
          },
        }),
      ).urls,
    enabled: open && approval.data !== undefined && approval.data.media.length > 0,
    staleTime: 60_000,
  });

  const scheduleClose = () => {
    timer.current = setTimeout(() => setOpen(false), closeDelay);
  };
  const cancelClose = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const preview = (data: PortalApproval) => {
    const channel = data.request.channels[0];
    if (channel === undefined) return null;
    return (
      <div className="max-h-[min(75vh,38rem)] space-y-2 overflow-y-auto p-2">
        <div className="px-2 pt-1">
          <p className="truncate text-sm font-semibold">{data.request.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.subtitle} · {approvalRequestStatusLabels[data.request.status]}
          </p>
        </div>
        <ChannelPreview
          platform={channel.platform as Platform}
          profileName={channel.profileName}
          format={channel.format as ContentFormat}
          caption={channel.caption ?? data.caption}
          callToAction={data.callToAction}
          media={data.media.map((media) => ({
            versionId: media.versionId,
            kind: kindOfMime(media.mimeType),
            altText: media.altText,
            url: mediaUrls.data?.[media.versionId] ?? null,
          }))}
        />
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
        }}
      >
        <PopoverTrigger asChild>
          <span className="block">{children}</span>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="start"
        side="right"
        className="w-[min(23rem,calc(100vw-2rem))] p-0"
        onFocusCapture={cancelClose}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {approval.isPending ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="aspect-[4/5] w-full rounded-xl" />
          </div>
        ) : approval.data ? (
          preview(approval.data)
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Não foi possível carregar a prévia.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
