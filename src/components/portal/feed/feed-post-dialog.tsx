import { X } from "lucide-react";
import { useRef, useState } from "react";
import { PlanRequestSummary } from "@/components/portal/approvals/plan-request-summary";
import { FeedActions } from "@/components/portal/feed/feed-actions";
import { FeedComments } from "@/components/portal/feed/feed-comments";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { InstagramCaption } from "@/components/shared/preview/instagram/instagram-caption";
import { InstagramDetailLayout } from "@/components/shared/preview/instagram/instagram-detail-layout";
import { InstagramMedia } from "@/components/shared/preview/instagram/instagram-media";
import { InstagramPostHeader } from "@/components/shared/preview/instagram/instagram-post-header";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shared/ui/avatar";
import { Button } from "@/components/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shared/ui/dialog";
import { useDecisionDraft } from "@/hooks/portal/use-decision-draft";
import { FeedPostKind } from "@/lib/portal/approvals/feed";
import type { PortalChannel, PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalStage, ContentFormat, Platform } from "@/lib/shared/enums";
import { approvalStageLabels } from "@/lib/shared/labels";

const CHANGES_HINT = "Escreva o que precisa mudar para solicitar a alteração.";

export function FeedPostDialog({
  request,
  channel,
  kind,
  media,
  caption,
  logoUrl,
  date,
  urls,
  onClose,
}: {
  request: PortalRequest;
  channel: PortalChannel;
  kind: FeedPostKind;
  media: PreviewMedia[];
  caption: string;
  logoUrl: string | null;
  date: React.ReactNode;
  urls: Record<string, string> | undefined;
  onClose: () => void;
}) {
  const draft = useDecisionDraft(request.id);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [hint, setHint] = useState<string | undefined>();
  const [safeZones, setSafeZones] = useState(false);
  const format = channel.format as ContentFormat;
  const instagram = channel.platform === Platform.Instagram;
  const immersive = instagram && (format === ContentFormat.Reel || format === ContentFormat.Story);
  const plan = kind === FeedPostKind.Plan;
  const name = channel.profileName.replace(/^@/, "");

  const changeText = (value: string) => {
    setHint(undefined);
    draft.change(value);
  };
  const focusField = () => fieldRef.current?.focus();

  const mediaNode = plan ? (
    <div className="max-h-[88dvh] w-full overflow-y-auto bg-surface p-5">
      <PlanRequestSummary request={request} urls={urls} />
    </div>
  ) : instagram ? (
    <InstagramMedia
      format={format}
      media={media}
      caption={caption}
      profileName={channel.profileName}
      brandLogoUrl={logoUrl}
      showSafeZones={safeZones}
      fitScreen
    />
  ) : (
    <div className="w-full p-3">
      <ChannelPreview
        platform={channel.platform as Platform}
        profileName={channel.profileName}
        brandLogoUrl={logoUrl}
        format={format}
        caption={caption}
        callToAction={null}
        media={media}
        showMediaPlaceholder={kind === FeedPostKind.CaptionOnly}
      />
    </div>
  );

  const side = (
    <>
      <InstagramPostHeader
        profileName={channel.profileName}
        brandLogoUrl={logoUrl}
        ring={immersive}
        menu={
          immersive
            ? { safeZones: { checked: safeZones, onCheckedChange: setSafeZones } }
            : undefined
        }
        subtitle={
          plan ? (
            <>
              {approvalStageLabels[ApprovalStage.Plan]} · {date}
            </>
          ) : (
            date
          )
        }
      />
      <div className="min-h-0 max-h-72 flex-1 space-y-3 overflow-y-auto border-y border-border py-3 lg:max-h-none">
        {caption.trim() === "" ? null : (
          <div className="flex items-start gap-3 px-3">
            <Avatar className="size-9 shrink-0">
              {logoUrl ? <AvatarImage src={logoUrl} alt="" className="object-contain" /> : null}
              <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                {name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <InstagramCaption
              caption={caption}
              full
              className="min-w-0 flex-1 px-0"
              prefix={<span className="font-semibold">{name}</span>}
            />
          </div>
        )}
        <FeedComments
          part="thread"
          request={request}
          open
          onOpenChange={() => undefined}
          draft={draft}
          fieldRef={fieldRef}
          hint={hint}
          onTextChange={changeText}
        />
      </div>
      <FeedActions
        request={request}
        draft={draft}
        onToggleComments={focusField}
        onNeedText={() => {
          setHint(CHANGES_HINT);
          focusField();
        }}
      />
      <FeedComments
        part="field"
        request={request}
        open
        onOpenChange={() => undefined}
        draft={draft}
        fieldRef={fieldRef}
        hint={hint}
        onTextChange={changeText}
      />
    </>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className="left-0 top-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 items-start justify-center overflow-y-auto rounded-none border-0 bg-ink/90 p-3 sm:p-6 lg:items-center"
      >
        <DialogTitle className="sr-only">{request.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Conteúdo, comentários e ações para aprovar ou pedir alteração.
        </DialogDescription>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="fixed right-3 top-3 z-10 text-ivory hover:bg-ink/40 hover:text-ivory [&_svg]:size-6"
            aria-label="Fechar"
          >
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
        <InstagramDetailLayout media={mediaNode} side={side} />
      </DialogContent>
    </Dialog>
  );
}
