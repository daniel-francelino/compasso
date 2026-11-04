import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import { RichTextView } from "@/components/shared/admin/rich-text-view";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { getContentItem } from "@/lib/marketing/content/content.functions";
import type { CalendarEntry } from "@/lib/shared/calendar/types";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { mediaUnavailable } from "@/lib/shared/preview/media-urls";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { isRichDocEmpty, richDocImages } from "@/lib/shared/rich-text/types";

const CLOSE_DELAY_MS = 160;
const STALE_MS = 60_000;

export function CalendarEntryPreview({
  entry,
  brandLogoUrl,
  children,
}: {
  entry: CalendarEntry;
  brandLogoUrl: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const content = useQuery({
    queryKey: QueryKey.Content.item(entry.itemId ?? ""),
    queryFn: async () =>
      unwrapResult(await getContentItem({ data: { id: entry.itemId ?? "" } })).item,
    enabled: open && entry.itemId !== null,
    staleTime: STALE_MS,
  });
  const urls = useSignedUrls(
    (content.data?.media ?? []).map((media) => media.mediaVersionId),
    MediaVariant.Display,
  );

  const planImageIds = richDocImages(content.data?.planSummary ?? null).map(
    (image) => image.mediaVersionId,
  );
  const planUrls = useSignedUrls(planImageIds, MediaVariant.Display);

  const cancelClose = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const row = content.data?.channels.find((channel) => channel.id === entry.channelRowId);

  const body = () => {
    if (content.isPending) {
      return (
        <div className="space-y-2 p-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        </div>
      );
    }
    if (content.data === undefined || row === undefined) {
      return (
        <p className="p-4 text-sm text-muted-foreground">Não foi possível carregar a prévia.</p>
      );
    }
    const caption = row.caption === "" ? content.data.caption : row.caption;
    const noPreview = content.data.media.length === 0 && caption === "";
    if (noPreview && !isRichDocEmpty(content.data.planSummary)) {
      return (
        <div className="max-h-[min(75vh,38rem)] space-y-2 overflow-y-auto p-4">
          <p className="text-xs font-medium text-muted-foreground">Planejamento</p>
          <RichTextView doc={content.data.planSummary} images={planUrls.data} />
        </div>
      );
    }
    return (
      <div className="max-h-[min(75vh,38rem)] overflow-y-auto p-2">
        <ChannelPreview
          platform={row.platform}
          profileName={row.profileName}
          format={row.format}
          caption={caption}
          callToAction={content.data.callToAction}
          brandLogoUrl={brandLogoUrl}
          showMediaPlaceholder
          media={content.data.media.map((media) => ({
            versionId: media.mediaVersionId,
            kind: media.kind,
            altText: media.altText,
            url: urls.data?.[media.mediaVersionId] ?? null,
            unavailable: mediaUnavailable(urls.data, media.mediaVersionId),
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
        {body()}
      </PopoverContent>
    </Popover>
  );
}
