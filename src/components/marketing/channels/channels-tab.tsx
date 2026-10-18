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
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
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
import { platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const tabs = [
  { value: ChannelStatusFilter.Active, label: "Ativos" },
  { value: ChannelStatusFilter.Archived, label: "Arquivados" },
];

export function ChannelsTab({ brandId }: { brandId: string }) {
  const auth = useAuth();
  const brand = useBrand(brandId);
  const { run, busy } = useServerAction();
  const [status, setStatus] = useState<string>(ChannelStatusFilter.Active);
  const [deleting, setDeleting] = useState<ChannelRow | null>(null);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Perfis e destinos desta marca. Cadastrar um canal não conecta a plataforma.
        </p>
        {canCreate ? (
          <Button onClick={() => sheet.open()}>
            <Plus aria-hidden="true" /> Novo canal
          </Button>
        ) : null}
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
      <DataTable
        caption="Canais"
        rows={query.data ?? []}
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
            title="Nenhum canal"
            description="Cadastre os perfis onde esta marca publica."
          />
        }
      />
      {sheet.editor ? (
        <ChannelEditor
          brandId={brandId}
          channel={sheet.editor.item}
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
