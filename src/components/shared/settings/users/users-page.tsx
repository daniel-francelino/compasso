import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Ban,
  CircleCheck,
  Clock,
  MailPlus,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  UserCog,
} from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import {
  type DataTableAction,
  type DataTableColumn,
  DataTable,
} from "@/components/shared/admin/data-table";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { ListToolbar } from "@/components/shared/admin/list-toolbar";
import { PageHeader } from "@/components/shared/admin/page-header";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { ChangeRoleDialog } from "@/components/shared/settings/users/change-role-dialog";
import { InviteDialog } from "@/components/shared/settings/users/invite-dialog";
import { Button } from "@/components/shared/ui/button";
import { useListState } from "@/hooks/shared/use-list-state";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { Action } from "@/lib/shared/auth/actions";
import { revokeInvitation, resendInvitation } from "@/lib/shared/auth/invitations.functions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import {
  type InvitationRow,
  type UserRow,
  UsersTab,
  listInvitations,
  listUsers,
  setUserAccess,
} from "@/lib/shared/auth/users.functions";
import { InvitationStatus, ProfileStatus } from "@/lib/shared/enums";
import { formatDate } from "@/lib/shared/format";
import { invitationStatusLabels, profileStatusLabels } from "@/lib/shared/labels";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const INVITATIONS_TAB = "invitations";

const statusTone: Record<ProfileStatus, StatusTone> = {
  [ProfileStatus.Pending]: "warning",
  [ProfileStatus.Approved]: "success",
  [ProfileStatus.Rejected]: "negative",
  [ProfileStatus.Suspended]: "neutral",
};

const invitationTone: Record<InvitationStatus, StatusTone> = {
  [InvitationStatus.Pending]: "warning",
  [InvitationStatus.Accepted]: "success",
  [InvitationStatus.Revoked]: "neutral",
  [InvitationStatus.Expired]: "neutral",
};

const tabs = [
  { value: UsersTab.Active, label: "Ativos" },
  { value: INVITATIONS_TAB, label: "Convites" },
  { value: UsersTab.Inactive, label: "Suspensos" },
];

export function UsersPage() {
  const auth = useAuth();
  const list = useListState<string>(UsersTab.Active);
  const { run, busy } = useServerAction();
  const [inviting, setInviting] = useState(false);
  const [changing, setChanging] = useState<UserRow | null>(null);
  const [toggling, setToggling] = useState<UserRow | null>(null);
  const [revoking, setRevoking] = useState<InvitationRow | null>(null);

  const showInvitations = list.status === INVITATIONS_TAB;
  const filters = { search: list.debouncedSearch, page: list.page, status: list.status };

  const users = useQuery({
    queryKey: QueryKey.Users.list(filters),
    queryFn: async () => unwrapResult(await listUsers({ data: filters })),
    placeholderData: keepPreviousData,
    enabled: !showInvitations,
  });
  const invitations = useQuery({
    queryKey: QueryKey.Users.invitations(filters),
    queryFn: async () => unwrapResult(await listInvitations({ data: filters })),
    placeholderData: keepPreviousData,
    enabled: showInvitations,
  });

  const canManage = can(auth, Action.Users.Manage);
  const canInvite = can(auth, Action.Invitations.Create);

  const userColumns: DataTableColumn<UserRow>[] = [
    {
      id: "name",
      label: "Nome",
      cell: (row) => <span className="font-medium">{row.fullName}</span>,
    },
    { id: "email", label: "E-mail", cell: (row) => row.email },
    { id: "role", label: "Perfil", cell: (row) => row.roleName ?? "—" },
    {
      id: "status",
      label: "Situação",
      cell: (row) => (
        <StatusBadge
          tone={statusTone[row.status]}
          icon={row.status === ProfileStatus.Approved ? CircleCheck : Ban}
        >
          {profileStatusLabels[row.status]}
        </StatusBadge>
      ),
    },
    { id: "created", label: "Desde", cell: (row) => formatDate(row.createdAt) },
  ];

  const invitationColumns: DataTableColumn<InvitationRow>[] = [
    {
      id: "email",
      label: "E-mail",
      cell: (row) => <span className="font-medium">{row.email}</span>,
    },
    { id: "role", label: "Perfil", cell: (row) => row.roleName ?? "—" },
    {
      id: "status",
      label: "Situação",
      cell: (row) => (
        <StatusBadge
          tone={invitationTone[row.status]}
          icon={row.status === InvitationStatus.Pending ? Clock : Ban}
        >
          {invitationStatusLabels[row.status]}
        </StatusBadge>
      ),
    },
    { id: "by", label: "Convidado por", cell: (row) => row.invitedByName ?? "—" },
    { id: "expires", label: "Expira em", cell: (row) => formatDate(row.expiresAt) },
  ];

  const userActions = (row: UserRow): DataTableAction<UserRow>[] => {
    if (!canManage || row.id === auth.user?.id) return [];
    const suspended = row.status !== ProfileStatus.Approved;
    return [
      { id: "role", label: "Alterar perfil", icon: UserCog, onSelect: setChanging },
      {
        id: "toggle",
        label: suspended ? "Reativar" : "Suspender",
        icon: suspended ? Play : Pause,
        destructive: !suspended,
        onSelect: setToggling,
      },
    ];
  };

  const invitationActions = (row: InvitationRow): DataTableAction<InvitationRow>[] => {
    if (!canInvite || row.status === InvitationStatus.Revoked) return [];
    const actions: DataTableAction<InvitationRow>[] = [
      {
        id: "resend",
        label: "Reenviar",
        icon: RefreshCw,
        onSelect: (item) =>
          void run(() => resendInvitation({ data: { id: item.id } }), {
            success: "Novo convite enviado.",
            invalidate: [QueryKey.Users.all()],
          }),
      },
    ];
    if (row.status === InvitationStatus.Pending) {
      actions.push({
        id: "revoke",
        label: "Revogar",
        icon: Trash2,
        destructive: true,
        onSelect: setRevoking,
      });
    }
    return actions;
  };

  const activeQuery = showInvitations ? invitations : users;
  const errorMessage = activeQuery.error?.message ?? null;
  const pagination = {
    page: list.page,
    pageSize: PAGE_SIZE,
    total: activeQuery.data?.total ?? 0,
    onPageChange: list.setPage,
  };
  const empty = (
    <EmptyState
      icon={showInvitations ? MailPlus : UserCog}
      title={list.debouncedSearch ? "Nada encontrado" : "Nada por aqui ainda"}
      description={
        list.debouncedSearch
          ? "Tente outro termo de busca."
          : "Quando houver registros, eles aparecem aqui."
      }
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pessoas e acessos"
        description="Quem usa o Compasso e o que cada pessoa pode fazer."
        breadcrumbs={[{ label: "Configurações" }, { label: "Pessoas" }]}
        actions={
          canInvite ? (
            <Button onClick={() => setInviting(true)}>
              <MailPlus aria-hidden="true" />
              Convidar pessoa
            </Button>
          ) : null
        }
      />
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchLabel="Buscar por nome ou e-mail"
        statusOptions={tabs}
        status={list.status}
        onStatusChange={list.setStatus}
      />
      {showInvitations ? (
        <DataTable
          caption="Convites"
          rows={invitations.data?.rows ?? []}
          columns={invitationColumns}
          rowKey={(row) => row.id}
          rowLabel={(row) => row.email}
          actions={invitationActions}
          loading={invitations.isPending}
          refreshing={invitations.isFetching}
          error={errorMessage}
          onRetry={() => void invitations.refetch()}
          empty={empty}
          pagination={pagination}
        />
      ) : (
        <DataTable
          caption="Pessoas"
          rows={users.data?.rows ?? []}
          columns={userColumns}
          rowKey={(row) => row.id}
          rowLabel={(row) => row.fullName}
          actions={userActions}
          loading={users.isPending}
          refreshing={users.isFetching}
          error={errorMessage}
          onRetry={() => void users.refetch()}
          empty={empty}
          pagination={pagination}
        />
      )}

      {inviting ? (
        <InviteDialog
          open
          onOpenChange={setInviting}
          onCreated={() => void users.refetch().then(() => invitations.refetch())}
        />
      ) : null}
      <ChangeRoleDialog user={changing} onOpenChange={(open) => !open && setChanging(null)} />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.status === ProfileStatus.Approved ? "Suspender acesso" : "Reativar acesso"}
        description={
          toggling?.status === ProfileStatus.Approved
            ? `${toggling.fullName} perde o acesso agora, mas o histórico fica guardado.`
            : `${toggling?.fullName ?? ""} volta a acessar o Compasso com o perfil atual.`
        }
        confirmLabel={toggling?.status === ProfileStatus.Approved ? "Suspender" : "Reativar"}
        destructive={toggling?.status === ProfileStatus.Approved}
        busy={busy}
        onConfirm={async () => {
          if (toggling === null) return false;
          const next =
            toggling.status === ProfileStatus.Approved
              ? ProfileStatus.Suspended
              : ProfileStatus.Approved;
          const result = await run(
            () => setUserAccess({ data: { profileId: toggling.id, status: next } }),
            { success: "Acesso atualizado.", invalidate: [QueryKey.Users.all()] },
          );
          return result.ok;
        }}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revogar convite"
        description={`O link enviado para ${revoking?.email ?? ""} deixa de funcionar.`}
        confirmLabel="Revogar"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (revoking === null) return false;
          const result = await run(() => revokeInvitation({ data: { id: revoking.id } }), {
            success: "Convite revogado.",
            invalidate: [QueryKey.Users.all()],
          });
          return result.ok;
        }}
      />
    </div>
  );
}
