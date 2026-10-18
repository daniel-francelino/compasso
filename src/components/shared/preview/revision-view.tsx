import { CalendarClock, ExternalLink } from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { Button } from "@/components/shared/ui/button";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import type { MediaKind } from "@/lib/shared/media/limits";

export type RevisionViewMedia = {
  versionId: string;
  name: string;
  kind: MediaKind | null;
  altText: string | null;
};

export function RevisionView({
  title,
  platform,
  profileName,
  format,
  caption,
  callToAction,
  plannedAt,
  plannedTimezone,
  media,
  urls,
  onOpenFile,
}: {
  title: string;
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  caption: string;
  callToAction: string | null;
  plannedAt: string | null;
  plannedTimezone: string | null;
  media: RevisionViewMedia[];
  urls: Record<string, string> | undefined;
  onOpenFile: (versionId: string) => void | Promise<void>;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChannelPreview
        platform={platform}
        profileName={profileName}
        format={format}
        caption={caption}
        callToAction={callToAction}
        media={media.map((item) => ({
          versionId: item.versionId,
          kind: item.kind,
          altText: item.altText,
          url: urls?.[item.versionId] ?? null,
        }))}
      />
      <div className="min-w-0 space-y-4">
        <div>
          <h2 className="heading-card text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {platformLabels[platform]} · {contentFormatLabels[format]}
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
          {plannedAt !== null && plannedTimezone !== null
            ? `Prevista para ${formatInZone(plannedAt, plannedTimezone)}`
            : "Sem data prevista"}
        </p>
        <SectionCard title="Legenda completa" padding="sm">
          {caption === "" ? (
            <p className="text-sm text-muted-foreground">Sem legenda.</p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm">{caption}</p>
          )}
          {callToAction ? <p className="mt-2 text-sm font-medium">{callToAction}</p> : null}
        </SectionCard>
        <SectionCard title={`Arquivos (${media.length})`} padding="sm">
          {media.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo.</p>
          ) : (
            <ul className="space-y-2">
              {media.map((item, index) => (
                <li key={item.versionId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">
                    {index + 1}. {item.name}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onOpenFile(item.versionId)}
                    aria-label={`Abrir ${item.name}`}
                  >
                    <ExternalLink aria-hidden="true" />
                    Abrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
