import { useQuery } from "@tanstack/react-query";
import { Archive, Pencil, Radio, Trash2 } from "lucide-react";
import { useState } from "react";
import { ChannelEditor } from "@/components/marketing/channels/channel-editor";
import { PlatformIcon } from "@/components/marketing/channels/platform-icon";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { type DataTableAction, DataTableRowActions } from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useEditorSheet } from "@/hooks/shared/use-editor-sheet";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type ChannelRow,
  deleteChannel,
  listChannels,
  setChannelArchived,
} from "@/lib/marketing/channels/channels.functions";
import { ChannelStatusFilter } from "@/lib/marketing/channels/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { Platform } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const platformOrder = [
  Platform.Instagram,
  Platform.Tiktok,
  Platform.Facebook,
  Platform.Youtube,
  Platform.Linkedin,
  Platform.X,
  Platform.Threads,
  Platform.Pinterest,
  Platform.Email,
  Platform.Blog,
  Platform.Other,
];

export function ChannelsTab({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const brand = useBrand(brandId);
  const { run, busy } = useServerAction();
  const [deleting, setDeleting] = useState<ChannelRow | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | undefined>();
  const sheet = useEditorSheet<ChannelRow>(QueryKey.Channels.all(brandId));

  const filters = { status: ChannelStatusFilter.Active };
  const query = useQuery({
    queryKey: QueryKey.Channels.list(brandId, filters),
    queryFn: async () =>
      unwrapResult(await listChannels({ data: { brandId, ...filters } })).channels,
  });

  const canCreate = can(auth, Action.Channels.Create) && brand.data?.archived !== true;
  const canUpdate = can(auth, Action.Channels.Update);
  const invalidate = [QueryKey.Channels.all(brandId), QueryKey.Brands.detail(brandId)];

  const actions = (): DataTableAction<ChannelRow>[] => {
    if (!canUpdate) return [];
    const list: DataTableAction<ChannelRow>[] = [
      { id: "edit", label: "Editar", icon: Pencil, onSelect: (item) => sheet.open(item) },
      {
        id: "archive",
        label: "Arquivar",
        icon: Archive,
        onSelect: (item) =>
          void run(() => setChannelArchived({ data: { id: item.id, archived: true } }), {
            success: "Canal arquivado.",
            invalidate,
          }),
      },
    ];
    if (can(auth, Action.Channels.Delete)) {
      list.push({
        id: "delete",
        label: "Excluir",
        icon: Trash2,
        destructive: true,
        onSelect: setDeleting,
      });
    }
    return list;
  };

  const channels = query.data ?? [];
  const activeChannelByPlatform = new Map(
    platformOrder.map((platform) => [
      platform,
      channels.find((channel) => channel.platform === platform),
    ]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Perfis e destinos desta marca. Cadastrar um canal não conecta a plataforma.
        </p>
      </div>
      {query.error ? (
        <EmptyState
          icon={Radio}
          title="Não foi possível carregar os canais"
          description={query.error.message}
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {platformOrder.map((platform) => {
            const channel = activeChannelByPlatform.get(platform);
            const configured = channel !== undefined;
            const canOpen = configured ? canUpdate : canCreate;
            return (
              <SectionCard
                key={platform}
                as="div"
                padding="none"
                className="relative aspect-square overflow-hidden"
              >
                {channel && canUpdate ? (
                  <div className="absolute right-2 top-2 z-10">
                    <DataTableRowActions
                      row={channel}
                      label={channel.profileName}
                      actions={actions()}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="flex size-full flex-col items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canOpen || query.isPending}
                  onClick={() => {
                    if (channel) sheet.open(channel);
                    if (!channel) {
                      setSelectedPlatform(platform);
                      sheet.open();
                    }
                  }}
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <PlatformIcon platform={platform} className="size-6" />
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {platformLabels[platform]}
                    </span>
                    <span className="block max-w-full truncate text-xs text-muted-foreground">
                      {channel?.profileName ?? "-"}
                    </span>
                  </span>
                </button>
              </SectionCard>
            );
          })}
        </div>
      )}
      {sheet.editor ? (
        <ChannelEditor
          brandId={brandId}
          channel={sheet.editor.item}
          {...(sheet.editor.item || !selectedPlatform ? {} : { initialPlatform: selectedPlatform })}
          onClose={() => void sheet.close()}
          onDirtyChange={sheet.setFormState}
          onSaved={() => void sheet.saved()}
          restoreFocus={sheet.restoreFocus}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir canal"
        description={`${deleting?.profileName ?? ""} será excluído. Só é possível excluir canais que nunca foram usados.`}
        confirmLabel="Excluir"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (deleting === null) return false;
          const result = await run(() => deleteChannel({ data: { id: deleting.id } }), {
            success: "Canal excluído.",
            invalidate,
          });
          return result.ok;
        }}
      />
    </div>
  );
}
