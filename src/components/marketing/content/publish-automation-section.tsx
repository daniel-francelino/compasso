import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { PlatformMark } from "@/components/shared/preview/platform-mark";
import { Button } from "@/components/shared/ui/button";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { useServerAction } from "@/hooks/shared/use-server-action";
import type { DraftRow } from "@/hooks/marketing/use-content-draft";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import {
  type PublishInfo,
  getPublishInfo,
  publishNow,
  setPublishMode,
} from "@/lib/marketing/content/publishing.functions";
import { dbErrorMessage } from "@/lib/shared/auth/errors";
import { AutoPublishState, Platform, PublicationStatus, PublishMode } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const REFRESH_MS = 5000;

const isWorking = (rows: PublishInfo[] | undefined): boolean =>
  rows?.some((row) => row.state === AutoPublishState.Publishing) ?? false;

function RowStatus({ info, plannedLabel }: { info: PublishInfo; plannedLabel: string | null }) {
  if (info.publicationStatus === PublicationStatus.PublishedManually) {
    return (
      <StatusBadge tone="success" icon={CheckCircle2}>
        {info.publishedVia === null ? "Publicado" : "Publicado automaticamente"}
      </StatusBadge>
    );
  }
  if (info.state === AutoPublishState.Publishing) {
    return (
      <StatusBadge tone="info" icon={Loader2}>
        Publicando agora
      </StatusBadge>
    );
  }
  if (info.state === AutoPublishState.Failed) {
    return (
      <StatusBadge tone="negative" icon={AlertTriangle}>
        Falhou
      </StatusBadge>
    );
  }
  if (info.mode === PublishMode.Automatic) {
    return (
      <StatusBadge tone="draft" icon={Send}>
        {plannedLabel ? `Sai sozinho em ${plannedLabel}` : "Defina uma data"}
      </StatusBadge>
    );
  }
  return null;
}

export function PublishAutomationSection({
  itemId,
  rows,
  channels,
  zone,
  canManage,
}: {
  itemId: string;
  rows: DraftRow[];
  channels: ChannelRow[];
  zone: string;
  canManage: boolean;
}) {
  const { run, busy } = useServerAction();
  const invalidate = [QueryKey.Content.publishInfo(itemId), QueryKey.Content.item(itemId)];
  const query = useQuery({
    queryKey: QueryKey.Content.publishInfo(itemId),
    queryFn: async () => unwrapResult(await getPublishInfo({ data: { itemId } })).rows,
    refetchInterval: (current) => (isWorking(current.state.data) ? REFRESH_MS : false),
  });

  const entries = (query.data ?? []).flatMap((info) => {
    const row = rows.find((candidate) => candidate.id === info.rowId);
    const channel = channels.find((candidate) => candidate.id === info.channelId);
    return row && channel?.platform === Platform.Instagram ? [{ info, row, channel }] : [];
  });
  if (entries.length === 0) return null;

  return (
    <SectionCard title="6. Publicação automática" icon={Send}>
      <ul className="space-y-3">
        {entries.map(({ info, row, channel }) => {
          const plannedLabel = row.plannedAt
            ? formatInZone(row.plannedAt, row.plannedTimezone ?? zone, { includeZone: true })
            : null;
          const published = info.publicationStatus === PublicationStatus.PublishedManually;
          const working = info.state === AutoPublishState.Publishing;
          const automatic = info.mode === PublishMode.Automatic;
          return (
            <li key={info.rowId} className="space-y-3 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <PlatformMark platform={channel.platform} className="size-8" />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">
                      {platformLabels[channel.platform]} · {channel.profileName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {contentFormatLabels[row.format]}
                      {plannedLabel ? ` · ${plannedLabel}` : ""}
                    </span>
                  </span>
                </div>
                <RowStatus info={info} plannedLabel={plannedLabel} />
              </div>
              {published && info.publishedUrl ? (
                <a
                  href={info.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Abrir a publicação no Instagram
                </a>
              ) : null}
              {published ? null : (
                <>
                  {info.connected ? (
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor={`auto-${info.rowId}`} className="text-sm">
                        Publicar automaticamente
                      </Label>
                      <Switch
                        id={`auto-${info.rowId}`}
                        checked={automatic}
                        disabled={!canManage || busy || working}
                        onCheckedChange={(checked) =>
                          void run(
                            () =>
                              setPublishMode({
                                data: {
                                  rowId: info.rowId,
                                  mode: checked ? PublishMode.Automatic : PublishMode.Manual,
                                  expectedVersion: info.version,
                                },
                              }),
                            { invalidate },
                          )
                        }
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Conecte este canal ao Instagram para publicar automaticamente.
                    </p>
                  )}
                  {automatic && info.state === null ? (
                    <p className="text-xs text-muted-foreground">
                      Sai no horário planejado, só depois que o conteúdo estiver aprovado.
                    </p>
                  ) : null}
                  {info.state === AutoPublishState.Failed ? (
                    <p className="text-sm text-foreground" role="alert">
                      {dbErrorMessage({ message: info.lastErrorCode ?? "unknown" })} Se preferir,
                      registre a publicação à mão.
                    </p>
                  ) : null}
                  {canManage && automatic && !working ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            publishNow({
                              data: { rowId: info.rowId, expectedVersion: info.version },
                            }),
                          { invalidate, success: "Pedido enviado. A publicação sai em instantes." },
                        )
                      }
                    >
                      <Send aria-hidden="true" />
                      {info.state === AutoPublishState.Failed ? "Tentar de novo" : "Publicar agora"}
                    </Button>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
