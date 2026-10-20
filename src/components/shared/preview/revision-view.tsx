import { CalendarClock, ExternalLink } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/shared/ui/tabs";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import type { MediaKind } from "@/lib/shared/media/limits";

export type RevisionViewMedia = {
  versionId: string;
  name: string;
  kind: MediaKind | null;
  altText: string | null;
  width?: number | null | undefined;
  height?: number | null | undefined;
};

export type RevisionViewChannel = {
  rowId: string;
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  caption: string | null;
  plannedAt: string | null;
  plannedTimezone: string | null;
};

export function RevisionView({
  title,
  channels,
  caption,
  callToAction,
  media,
  urls,
  brandLogoUrl,
  onOpenFile,
}: {
  title: string;
  channels: RevisionViewChannel[];
  caption: string;
  callToAction: string | null;
  media: RevisionViewMedia[];
  urls: Record<string, string> | undefined;
  brandLogoUrl?: string | null;
  onOpenFile: (versionId: string) => void | Promise<void>;
}) {
  const [active, setActive] = useState(channels[0]?.rowId ?? "");
  const current = channels.find((channel) => channel.rowId === active) ?? channels[0];
  const text = current?.caption ?? caption;
  return (
    <div className="space-y-4">
      {channels.length > 1 ? (
        <Tabs value={current?.rowId ?? ""} onValueChange={setActive}>
          <TabsList className="h-auto max-w-full flex-wrap justify-start">
            {channels.map((channel) => (
              <TabsTrigger key={channel.rowId} value={channel.rowId}>
                <PlatformIcon platform={channel.platform} />
                {platformLabels[channel.platform]} · {contentFormatLabels[channel.format]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <div className="grid gap-6 md:grid-cols-2">
        {current ? (
          <ChannelPreview
            platform={current.platform}
            profileName={current.profileName}
            brandLogoUrl={brandLogoUrl ?? null}
            format={current.format}
            caption={text}
            callToAction={callToAction}
            media={media.map((item) => ({
              versionId: item.versionId,
              kind: item.kind,
              altText: item.altText,
              width: item.width,
              height: item.height,
              url: urls?.[item.versionId] ?? null,
            }))}
          />
        ) : null}
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="heading-card text-foreground">{title}</h2>
            {current ? (
              <p className="text-sm text-muted-foreground">
                {platformLabels[current.platform]} · {current.profileName} ·{" "}
                {contentFormatLabels[current.format]}
              </p>
            ) : null}
          </div>
          {current ? (
            <p className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
              {current.plannedAt !== null && current.plannedTimezone !== null ? (
                <span className="inline-flex items-center gap-1.5">
                  Prevista para {formatInZone(current.plannedAt, current.plannedTimezone)}
                  <InfoTip label={`Fuso horário: ${current.plannedTimezone}`}>
                    Fuso horário: {current.plannedTimezone}
                  </InfoTip>
                </span>
              ) : (
                "Sem data prevista"
              )}
            </p>
          ) : null}
          <SectionCard title="Legenda completa" padding="sm">
            {text === "" ? (
              <p className="text-sm text-muted-foreground">-</p>
            ) : (
              <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
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
    </div>
  );
}
