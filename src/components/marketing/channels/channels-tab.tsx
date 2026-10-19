import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  CircleCheck,
  ExternalLink,
  Pencil,
  Plus,
  Radio,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { ChannelEditor } from "@/components/marketing/channels/channel-editor";
import { PlatformIcon } from "@/components/marketing/channels/platform-icon";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { SectionCard } from "@/components/shared/admin/section-card";
import { StatusBadge } from "@/components/shared/admin/status-badge";
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

const tabs = [
  { value: ChannelStatusFilter.Active, label: "Ativos", icon: CircleCheck },
  { value: ChannelStatusFilter.Archived, label: "Arquivados", icon: Archive },
];

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
  const [status, setStatus] = useState<string>(ChannelStatusFilter.Active);
  const [deleting, setDeleting] = useState<ChannelRow | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | undefined>();
  const sheet = useEditorSheet<ChannelRow>(QueryKey.Channels.all(brandId));

  const filters = { status };
  const query = useQuery({
    queryKey: QueryKey.Channels.list(brandId, filters),
    queryFn: async () => unwrapResult(await listChannels({ data: { brandId, status } })).channels,
  });

  const canCreate = can(auth, Action.Channels.Create) && brand.data?.archived !== true;
  const canUpdate = can(auth, Action.Channels.Update);
  const invalidate = [QueryKey.Channels.all(brandId), QueryKey.Brands.detail(brandId)];

  const columns: DataTableColumn<ChannelRow>[] = [
    { id: "platform", label: "Plataforma", cell: (row) => platformLabels[row.platform] },
    {
      id: "name",
      label: "Perfil",
      cell: (row) =>
        row.profileUrl ? (
          <a
            href={row.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.profileName}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(abre em outra aba)</span>
          </a>
        ) : (
          <span className="font-medium">{row.profileName}</span>
        ),
    },
    {
      id: "status",
      label: "Situação",
      cell: (row) => (
        <StatusBadge
          tone={row.archived ? "neutral" : "success"}
          icon={row.archived ? Archive : CircleCheck}
        >
          {row.archived ? "Arquivado" : "Ativo"}
        </StatusBadge>
      ),
    },
  ];

  const actions = (row: ChannelRow): DataTableAction<ChannelRow>[] => {
    if (!canUpdate) return [];
    const list: DataTableAction<ChannelRow>[] = [
      { id: "edit", label: "Editar", icon: Pencil, onSelect: (item) => sheet.open(item) },
      {
        id: "archive",
        label: row.archived ? "Reativar" : "Arquivar",
        icon: row.archived ? Undo2 : Archive,
        onSelect: (item) =>
          void run(() => setChannelArchived({ data: { id: item.id, archived: !item.archived } }), {
            success: item.archived ? "Canal reativado." : "Canal arquivado.",
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
  const activeChannelsByPlatform = new Map(
    platformOrder.map((platform) => [
      platform,
      channels.filter((channel) => channel.platform === platform),
    ]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Perfis e destinos desta marca. Cadastrar um canal não conecta a plataforma.
        </p>
      </div>
      <ListToolbar
        search=""
        onSearchChange={() => undefined}
        searchLabel="Buscar"
        statusOptions={tabs}
        status={status}
        onStatusChange={setStatus}
        hideSearch
      />
      {status === ChannelStatusFilter.Active ? (
        query.error ? (
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {platformOrder.map((platform) => {
              const platformChannels = activeChannelsByPlatform.get(platform) ?? [];
              const configured = platformChannels.length > 0;
              const canOpen = configured ? canUpdate : canCreate;
              return (
                <SectionCard key={platform} as="div" padding="none" className="overflow-hidden">
                  {platformChannels.length > 1 ? (
                    <div className="flex aspect-square h-full flex-col gap-2 overflow-y-auto p-4">
                      <div className="flex items-center gap-3 border-b border-border pb-3">
                        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground">
                          <PlatformIcon platform={platform} className="size-6" />
                        </span>
                        <div>
                          <h2 className="font-medium text-foreground">
                            {platformLabels[platform]}
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            Mais de um perfil cadastrado
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {platformChannels.map((channel) => (
                          <button
                            key={channel.id}
                            type="button"
                            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => sheet.open(channel)}
                            disabled={!canUpdate}
                          >
                            <span className="truncate font-medium text-foreground">
                              {channel.profileName}
                            </span>
                            <Pencil
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex aspect-square w-full flex-col items-start justify-between gap-5 p-5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canOpen || query.isPending}
                      onClick={() => {
                        const channel = platformChannels[0];
                        if (channel) sheet.open(channel);
                        if (!channel) {
                          setSelectedPlatform(platform);
                          sheet.open();
                        }
                      }}
                    >
                      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-secondary text-foreground">
                        <PlatformIcon platform={platform} className="size-7" />
                      </span>
                      <span className="space-y-1">
                        <span className="block font-medium text-foreground">
                          {platformLabels[platform]}
                        </span>
                        <span className="block max-w-full truncate text-sm text-muted-foreground">
                          {configured ? platformChannels[0]?.profileName : "Adicionar canal"}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                        {configured ? (
                          <Pencil className="size-4" aria-hidden="true" />
                        ) : (
                          <Plus className="size-4" aria-hidden="true" />
                        )}
                        {configured ? "Editar canal" : "Configurar canal"}
                      </span>
                    </button>
                  )}
                </SectionCard>
              );
            })}
          </div>
        )
      ) : (
        <DataTable
          caption="Canais arquivados"
          rows={channels}
          columns={columns}
          rowKey={(row) => row.id}
          rowLabel={(row) => row.profileName}
          actions={actions}
          loading={query.isPending}
          error={query.error?.message ?? null}
          onRetry={() => void query.refetch()}
          empty={
            <EmptyState
              icon={Radio}
              title="Nenhum canal arquivado"
              description="Canais arquivados aparecerão aqui."
            />
          }
        />
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
